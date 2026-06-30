/**
 * Helius (Solana) integration for reading the on-chain $DEGEN token balance.
 * Configured via env:
 *   HELIUS_API_KEY  — your Helius API key
 *   DEGEN_MINT      — the $DEGEN SPL token mint address
 *   HELIUS_RPC_URL  — optional override (defaults to Helius mainnet RPC)
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const DEGEN_MINT = process.env.DEGEN_MINT ?? "";
const RPC_BASE = process.env.HELIUS_RPC_URL ?? "https://mainnet.helius-rpc.com";

export function isDegenConfigured(): boolean {
  return Boolean((HELIUS_API_KEY || RPC_BASE.includes("api-key")) && DEGEN_MINT);
}

/** Build the RPC URL, tolerating either a bare key or a full URL in HELIUS_API_KEY. */
function rpcUrl(): string {
  // If the user pasted a full URL (into either var), use it as-is.
  if (HELIUS_API_KEY.startsWith("http")) return HELIUS_API_KEY;
  if (RPC_BASE.includes("api-key")) return RPC_BASE;
  return `${RPC_BASE}/?api-key=${HELIUS_API_KEY}`;
}

interface TokenAccountsResponse {
  result?: {
    value?: Array<{
      account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } } };
    }>;
  };
}

/**
 * Returns the wallet's $DEGEN balance (ui amount). Returns 0 if not configured
 * or on any error so the caller never breaks.
 */
export async function getDegenBalance(walletAddress: string): Promise<number> {
  if (!isDegenConfigured() || !walletAddress) return 0;

  const url = rpcUrl();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "degen-balance",
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: DEGEN_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as TokenAccountsResponse;
    const accounts = json.result?.value ?? [];
    let total = 0;
    for (const acc of accounts) {
      total += acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    }
    return total;
  } catch {
    return 0;
  }
}
