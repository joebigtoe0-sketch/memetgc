import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export interface BuildPurchaseTxArgs {
  connection: Connection;
  buyer: PublicKey;
  sellerWallet: string;
  treasuryWallet: string;
  mint: string;
  sellerBaseUnits: bigint;
  feeBaseUnits: bigint;
}

/**
 * Builds a single transaction with two SPL token transfers:
 *   - buyer -> seller   (95%)
 *   - buyer -> treasury (5%)
 * Idempotently creates the seller/treasury associated token accounts if missing
 * (buyer pays the rent). The buyer's own ATA is assumed to exist (they hold tokens).
 *
 * Detects whether the mint is owned by the legacy SPL Token program or Token-2022
 * and uses the matching program for ATA derivation, creation, and transfers.
 * Using the wrong program causes the on-chain instructions to revert with
 * `IncorrectProgramId`.
 */
export async function buildPurchaseTx(args: BuildPurchaseTxArgs): Promise<Transaction> {
  const mint = new PublicKey(args.mint);
  const seller = new PublicKey(args.sellerWallet);
  const treasury = new PublicKey(args.treasuryWallet);

  // The program that owns the mint account IS the token program to use
  // (TOKEN_PROGRAM_ID for classic SPL, TOKEN_2022_PROGRAM_ID for Token-2022).
  const mintInfo = await args.connection.getAccountInfo(mint);
  const tokenProgramId = mintInfo?.owner ?? TOKEN_PROGRAM_ID;

  const buyerAta = await getAssociatedTokenAddress(mint, args.buyer, false, tokenProgramId);
  const sellerAta = await getAssociatedTokenAddress(mint, seller, false, tokenProgramId);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury, false, tokenProgramId);

  const tx = new Transaction();

  // Create destination ATAs if they don't exist yet (idempotent).
  const [sellerInfo, treasuryInfo] = await Promise.all([
    args.connection.getAccountInfo(sellerAta),
    args.connection.getAccountInfo(treasuryAta),
  ]);

  if (!sellerInfo) {
    tx.add(createAssociatedTokenAccountInstruction(args.buyer, sellerAta, seller, mint, tokenProgramId));
  }
  if (!treasuryInfo) {
    tx.add(createAssociatedTokenAccountInstruction(args.buyer, treasuryAta, treasury, mint, tokenProgramId));
  }

  tx.add(createTransferInstruction(buyerAta, sellerAta, args.buyer, args.sellerBaseUnits, [], tokenProgramId));
  tx.add(createTransferInstruction(buyerAta, treasuryAta, args.buyer, args.feeBaseUnits, [], tokenProgramId));

  const { blockhash } = await args.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = args.buyer;

  return tx;
}

/** Convert a ui amount to base units (bigint) for the given decimals. */
export function toBaseUnits(uiAmount: number, decimals: number): bigint {
  const [whole, frac = ""] = uiAmount.toFixed(decimals).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}
