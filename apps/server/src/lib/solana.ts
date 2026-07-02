/**
 * Solana helpers for the marketplace and access gate.
 *
 * Uses the Helius RPC (same config as lib/helius.ts) to:
 *   - read a wallet's $MEMEPOOL balance
 *   - fetch the mint decimals (cached)
 *   - verify a buyer-signed purchase transaction on-chain
 *
 * Env:
 *   HELIUS_API_KEY   — Helius API key (or a full RPC URL)
 *   DEGEN_MINT       — the $MEMEPOOL SPL token mint address
 *   HELIUS_RPC_URL   — optional RPC base override (defaults to Helius mainnet)
 *   TREASURY_WALLET  — wallet that collects the 5% fee
 *   MIN_PLAY_TOKENS  — minimum balance to play (default 1000)
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const DEGEN_MINT = process.env.DEGEN_MINT ?? "";
const RPC_BASE = process.env.HELIUS_RPC_URL ?? "https://mainnet.helius-rpc.com";

export const TREASURY_WALLET = process.env.TREASURY_WALLET ?? "";
export const MIN_PLAY_TOKENS = Number(process.env.MIN_PLAY_TOKENS ?? "1000");
export const MINT_ADDRESS = DEGEN_MINT;

export function isSolanaConfigured(): boolean {
  return Boolean((HELIUS_API_KEY || RPC_BASE.includes("api-key")) && DEGEN_MINT);
}

/** Non-secret config booleans for the /health diagnostics endpoint. */
export function getSolanaConfigStatus(): { rpc: boolean; mint: boolean; treasury: boolean } {
  return {
    rpc: Boolean(HELIUS_API_KEY || RPC_BASE.includes("api-key")),
    mint: Boolean(DEGEN_MINT),
    treasury: Boolean(TREASURY_WALLET),
  };
}

function rpcUrl(): string {
  if (HELIUS_API_KEY.startsWith("http")) return HELIUS_API_KEY;
  if (RPC_BASE.includes("api-key")) return RPC_BASE;
  return `${RPC_BASE}/?api-key=${HELIUS_API_KEY}`;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  if (!isSolanaConfigured()) {
    console.warn(`[solana] rpc(${method}) skipped — Solana not configured (HELIUS_API_KEY / DEGEN_MINT missing)`);
    return null;
  }
  try {
    const res = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
    });
    if (!res.ok) {
      console.warn(`[solana] rpc(${method}) HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    const json = (await res.json()) as { result?: T; error?: { code?: number; message?: string } };
    if (json.error) {
      console.warn(`[solana] rpc(${method}) RPC error ${json.error.code}: ${json.error.message}`);
    }
    return json.result ?? null;
  } catch (err) {
    console.warn(`[solana] rpc(${method}) fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

interface TokenAccountsResponse {
  value?: Array<{
    account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } } };
  }>;
}

/** Returns the wallet's $MEMEPOOL balance (ui amount). 0 on any error/not configured. */
export async function getTokenBalance(walletAddress: string): Promise<number> {
  if (!walletAddress) return 0;
  const result = await rpc<TokenAccountsResponse>("getTokenAccountsByOwner", [
    walletAddress,
    { mint: DEGEN_MINT },
    { encoding: "jsonParsed" },
  ]);
  const accounts = result?.value ?? [];
  let total = 0;
  for (const acc of accounts) {
    total += acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  }
  return total;
}

let cachedDecimals: number | null = null;
interface TokenSupplyResponse {
  value?: { decimals?: number };
}

/** Fetches the mint decimals once and caches. Falls back to 6 (common for pump.fun tokens). */
export async function getMintDecimals(): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;
  const result = await rpc<TokenSupplyResponse>("getTokenSupply", [DEGEN_MINT]);
  const dec = result?.value?.decimals;
  cachedDecimals = typeof dec === "number" ? dec : 6;
  return cachedDecimals;
}

interface ParsedTxResponse {
  meta?: {
    err?: unknown;
    preTokenBalances?: TokenBalanceEntry[];
    postTokenBalances?: TokenBalanceEntry[];
  };
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey: string; signer?: boolean }> | string[];
    };
  };
}

interface TokenBalanceEntry {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
}

export interface VerifyArgs {
  buyer: string;
  sellerWallet: string;
  treasury: string;
  sellerBaseUnits: bigint;
  feeBaseUnits: bigint;
}

/**
 * Verifies a purchase transaction on-chain:
 *  - transaction succeeded (meta.err == null)
 *  - buyer is a signer / fee payer
 *  - the seller's $MEMEPOOL balance increased by >= sellerBaseUnits
 *  - the treasury's $MEMEPOOL balance increased by >= feeBaseUnits
 * Returns true only if all conditions hold.
 */
export async function verifyPurchaseTx(signature: string, args: VerifyArgs): Promise<boolean> {
  if (!signature) return false;
  const tx = await rpc<ParsedTxResponse>("getTransaction", [
    signature,
    { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx || !tx.meta) {
    // Most common transient case: the tx isn't queryable by the RPC yet.
    console.warn(`[solana] verify ${signature.slice(0, 8)}… not found on RPC yet (retryable)`);
    return false;
  }
  if (tx.meta.err != null) {
    console.warn(`[solana] verify ${signature.slice(0, 8)}… on-chain tx FAILED:`, JSON.stringify(tx.meta.err));
    return false;
  }

  // Buyer must be a signer (fee payer is accountKeys[0])
  const keys = tx.transaction?.message?.accountKeys ?? [];
  const signerSet = new Set<string>();
  let feePayer: string | null = null;
  keys.forEach((k, i) => {
    if (typeof k === "string") {
      if (i === 0) feePayer = k;
    } else {
      if (k.signer) signerSet.add(k.pubkey);
      if (i === 0) feePayer = k.pubkey;
    }
  });
  const buyerIsSigner = signerSet.has(args.buyer) || feePayer === args.buyer;
  if (!buyerIsSigner) {
    console.warn(`[solana] verify ${signature.slice(0, 8)}… buyer ${args.buyer.slice(0, 8)}… is not a signer`);
    return false;
  }

  // Compute per-owner delta for the mint via pre/post token balances.
  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  const deltaFor = (owner: string): bigint => {
    let before = 0n;
    let after = 0n;
    for (const b of pre) {
      if (b.mint === DEGEN_MINT && b.owner === owner) before += BigInt(b.uiTokenAmount?.amount ?? "0");
    }
    for (const b of post) {
      if (b.mint === DEGEN_MINT && b.owner === owner) after += BigInt(b.uiTokenAmount?.amount ?? "0");
    }
    return after - before;
  };

  const sellerDelta = deltaFor(args.sellerWallet);
  const treasuryDelta = deltaFor(args.treasury);

  if (sellerDelta < args.sellerBaseUnits) {
    console.warn(
      `[solana] verify ${signature.slice(0, 8)}… seller delta ${sellerDelta} < expected ${args.sellerBaseUnits} ` +
      `(seller=${args.sellerWallet.slice(0, 8)}…, mint=${DEGEN_MINT.slice(0, 8)}…). ` +
      `Check DEGEN_MINT matches the traded token and seller wallet is correct.`
    );
    return false;
  }
  if (treasuryDelta < args.feeBaseUnits) {
    console.warn(
      `[solana] verify ${signature.slice(0, 8)}… treasury delta ${treasuryDelta} < expected ${args.feeBaseUnits} ` +
      `(treasury=${args.treasury.slice(0, 8)}…). Check TREASURY_WALLET is set to the fee-collecting wallet.`
    );
    return false;
  }

  console.log(`[solana] verify ${signature.slice(0, 8)}… OK (seller +${sellerDelta}, treasury +${treasuryDelta})`);
  return true;
}

/** Convert a ui amount (Decimal-string or number) to base units using the mint decimals. */
export function toBaseUnits(uiAmount: number, decimals: number): bigint {
  // Use string math to avoid float precision loss.
  const [whole, frac = ""] = uiAmount.toFixed(decimals).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}
