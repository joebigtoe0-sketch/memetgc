"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { market, type ListingKind } from "@/lib/market";
import { buildPurchaseTx, toBaseUnits } from "@/lib/solanaPay";

export type BuyPhase = "idle" | "reserving" | "signing" | "confirming" | "done" | "error";

export interface BuyState {
  phase: BuyPhase;
  message: string;
  error: string | null;
}

const CONFIRM_ATTEMPTS = 20;
const CONFIRM_INTERVAL_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function useBuyFlow() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [state, setState] = useState<BuyState>({ phase: "idle", message: "", error: null });

  const reset = useCallback(() => setState({ phase: "idle", message: "", error: null }), []);

  const buy = useCallback(
    async (kind: ListingKind, itemId: string): Promise<boolean> => {
      if (!publicKey || !sendTransaction) {
        setState({ phase: "error", message: "", error: "Connect your wallet first" });
        return false;
      }

      try {
        setState({ phase: "reserving", message: "Reserving listing…", error: null });
        const reservation = await market.reserve(
          kind === "card" ? { kind, cardId: itemId } : { kind, packType: itemId }
        );

        setState({ phase: "signing", message: "Approve the payment in your wallet…", error: null });
        const tx = await buildPurchaseTx({
          connection,
          buyer: publicKey,
          sellerWallet: reservation.sellerWallet,
          treasuryWallet: reservation.treasuryWallet,
          mint: reservation.mint,
          sellerBaseUnits: toBaseUnits(reservation.sellerAmount, reservation.decimals),
          feeBaseUnits: toBaseUnits(reservation.feeAmount, reservation.decimals),
        });

        const signature = await sendTransaction(tx, connection);

        setState({ phase: "confirming", message: "Confirming on-chain…", error: null });
        // Wait for on-chain confirmation, then poll our backend verifier.
        try {
          await connection.confirmTransaction(signature, "confirmed");
        } catch {
          /* fall through to polling; backend re-verifies anyway */
        }

        for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
          try {
            const res = await market.confirm({ listingId: reservation.listingId, signature });
            if (res.status === "sold") {
              setState({ phase: "done", message: "Purchase complete!", error: null });
              return true;
            }
          } catch (e) {
            const msg = (e as Error).message ?? "";
            // "pending" style errors: keep retrying. Anything else: abort.
            if (!/not confirmed|pending/i.test(msg)) {
              setState({ phase: "error", message: "", error: msg || "Purchase failed" });
              return false;
            }
          }
          await sleep(CONFIRM_INTERVAL_MS);
        }

        setState({ phase: "error", message: "", error: "Could not confirm the transaction in time" });
        return false;
      } catch (e) {
        setState({ phase: "error", message: "", error: (e as Error).message ?? "Purchase failed" });
        return false;
      }
    },
    [connection, publicKey, sendTransaction]
  );

  return { state, buy, reset };
}
