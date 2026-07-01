import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
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
 */
export async function buildPurchaseTx(args: BuildPurchaseTxArgs): Promise<Transaction> {
  const mint = new PublicKey(args.mint);
  const seller = new PublicKey(args.sellerWallet);
  const treasury = new PublicKey(args.treasuryWallet);

  const buyerAta = await getAssociatedTokenAddress(mint, args.buyer);
  const sellerAta = await getAssociatedTokenAddress(mint, seller);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);

  const tx = new Transaction();

  // Create destination ATAs if they don't exist yet (idempotent).
  const [sellerInfo, treasuryInfo] = await Promise.all([
    args.connection.getAccountInfo(sellerAta),
    args.connection.getAccountInfo(treasuryAta),
  ]);

  if (!sellerInfo) {
    tx.add(createAssociatedTokenAccountInstruction(args.buyer, sellerAta, seller, mint));
  }
  if (!treasuryInfo) {
    tx.add(createAssociatedTokenAccountInstruction(args.buyer, treasuryAta, treasury, mint));
  }

  tx.add(createTransferInstruction(buyerAta, sellerAta, args.buyer, args.sellerBaseUnits));
  tx.add(createTransferInstruction(buyerAta, treasuryAta, args.buyer, args.feeBaseUnits));

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
