"use client";

import React, { useEffect, useState } from "react";
import bs58 from "bs58";
import { market, buildListingMessage, type ListingKind } from "@/lib/market";
import { BRAND } from "@/lib/brand";
import { useMarketWallet } from "@/hooks/useMarketWallet";

interface Props {
  kind: ListingKind;
  itemId: string;
  title: string;
  onClose: () => void;
  onListed?: () => void;
}

const FEE_RATE = 0.05;

export default function SellModal({ kind, itemId, title, onClose, onListed }: Props) {
  const { accountWallet, activeWallet, canSign, walletMismatch, openConnect, signWalletError, signMessage } = useMarketWallet();
  const [price, setPrice] = useState("");
  const [lowest, setLowest] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    market
      .listings(kind, itemId)
      .then((r) => {
        setCount(r.count);
        setLowest(r.listings[0]?.price ?? null);
      })
      .catch(() => {});
  }, [kind, itemId]);

  useEffect(() => {
    if (canSign && !walletMismatch) setError("");
  }, [canSign, walletMismatch, activeWallet]);

  const priceNum = Number(price);
  const valid = priceNum > 0 && Number.isFinite(priceNum);
  const buyerPays = valid ? Math.round(priceNum * (1 + FEE_RATE) * 1e6) / 1e6 : 0;
  const needsConnect = !canSign || walletMismatch;

  async function confirm() {
    if (!valid) { setError("Enter a valid price"); return; }
    const err = signWalletError();
    if (err) { setError(err); return; }
    if (!canSign || !accountWallet || !signMessage) {
      openConnect();
      return;
    }
    setError("");
    setLoading(true);
    try {
      const rounded = Math.round(priceNum * 1e6) / 1e6;
      const message = buildListingMessage({ wallet: accountWallet, kind, itemId, price: rounded });
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);
      await market.list({
        kind,
        cardId: kind === "card" ? itemId : undefined,
        packType: kind === "pack" ? itemId : undefined,
        price: rounded,
        signature,
        message,
      });
      setDone(true);
      onListed?.();
    } catch (e) {
      setError((e as Error).message ?? "Failed to list");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ font: `900 18px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", marginBottom: 4 }}>
          {done ? "Listed for sale" : `Sell ${title}`}
        </div>

        {done ? (
          <>
            <p style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", lineHeight: 1.5, marginTop: 8 }}>
              Your {kind} is now on the marketplace and held in escrow until it sells or you cancel.
            </p>
            <button onClick={onClose} style={primaryBtn(false)}>Done</button>
          </>
        ) : (
          <>
            <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
              Set your asking price in {BRAND.ticker}. You&apos;ll receive this amount; buyers pay a {Math.round(FEE_RATE * 100)}% fee on top.
            </p>

            <label style={fieldLabel}>Your price ({BRAND.ticker})</label>
            <input
              autoFocus
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              style={input}
            />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
              <InfoRow label="Buyer pays" value={valid ? `${buyerPays.toLocaleString()} ${BRAND.ticker}` : "—"} accent="#7cc4ff" />
              <InfoRow label="On sale now" value={String(count)} accent="#cdd4df" />
              <InfoRow label="Lowest price" value={lowest != null ? `${lowest.toLocaleString()}` : "—"} accent="#ffe07a" />
            </div>

            {needsConnect && accountWallet && (
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(255,224,122,.06)", border: "1px solid rgba(255,224,122,.2)" }}>
                <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", lineHeight: 1.5, margin: 0 }}>
                  {walletMismatch
                    ? `Connected wallet doesn't match your account. Connect ${accountWallet.slice(0, 4)}…${accountWallet.slice(-4)} to list items.`
                    : `You're signed in, but your wallet needs to reconnect to sign this listing (${accountWallet.slice(0, 4)}…${accountWallet.slice(-4)}).`}
                </p>
              </div>
            )}

            {error && <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff6b6b", marginTop: 12 }}>{error}</p>}

            {needsConnect ? (
              <button onClick={openConnect} style={primaryBtn(false)}>Connect Wallet</button>
            ) : (
              <button onClick={confirm} disabled={loading || !valid} style={primaryBtn(loading || !valid)}>
                {loading ? "Waiting for signature…" : "List for sale"}
              </button>
            )}
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ flex: 1, padding: "9px 10px", borderRadius: 10, background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.08)", textAlign: "center" }}>
      <div style={{ font: `500 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: accent, marginTop: 5 }}>{value}</div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(4,6,12,.72)", backdropFilter: "blur(4px)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
};
const panel: React.CSSProperties = {
  width: "100%", maxWidth: 400, padding: 26, borderRadius: 18,
  background: "linear-gradient(150deg,rgba(255,255,255,.05),rgba(14,18,28,.92))",
  border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 60px rgba(0,0,0,.6)",
};
const fieldLabel: React.CSSProperties = { display: "block", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", color: "#f1f4f9", font: `700 15px var(--font-mono,'JetBrains Mono',monospace)`, outline: "none" };

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 11, border: "none",
    font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00",
    background: "linear-gradient(180deg,#ffe07a,#e0890f)",
    boxShadow: "0 8px 20px rgba(224,137,15,.35)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
  };
}
const ghostBtn: React.CSSProperties = {
  width: "100%", marginTop: 9, padding: "9px 0", borderRadius: 10,
  background: "transparent", border: "1px solid rgba(255,255,255,.12)",
  color: "#8a93a6", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, cursor: "pointer",
};
