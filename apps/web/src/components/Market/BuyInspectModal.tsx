"use client";

import React, { useEffect, useState } from "react";
import { market, type ListingKind } from "@/lib/market";
import { useBuyFlow } from "@/hooks/useBuyFlow";
import { BRAND } from "@/lib/brand";

interface Props {
  kind: ListingKind;
  itemId: string;
  title: string;
  preview?: React.ReactNode;
  onClose: () => void;
  onBought?: () => void;
}

const FEE_RATE = 0.05;

export default function BuyInspectModal({ kind, itemId, title, preview, onClose, onBought }: Props) {
  const [listings, setListings] = useState<Array<{ id: string; price: number }>>([]);
  const [count, setCount] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const { state, buy, reset } = useBuyFlow();

  const refresh = () => {
    setLoadingList(true);
    market
      .listings(kind, itemId)
      .then((r) => {
        setListings(r.listings);
        setCount(r.count);
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  };

  useEffect(refresh, [kind, itemId]);

  const lowest = listings[0]?.price ?? null;
  const buyerPays = lowest != null ? Math.round(lowest * (1 + FEE_RATE) * 1e6) / 1e6 : null;
  const busy = state.phase !== "idle" && state.phase !== "error" && state.phase !== "done";

  async function handleBuy() {
    reset();
    const ok = await buy(kind, itemId);
    if (ok) onBought?.();
  }

  return (
    <div onClick={busy ? undefined : onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", gap: 18 }}>
          {preview && <div style={{ flexShrink: 0 }}>{preview}</div>}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `900 18px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", marginBottom: 2 }}>{title}</div>
            <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", marginBottom: 14 }}>
              {count} on sale
            </div>

            <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
              Lowest asks
            </div>

            {loadingList ? (
              <div style={{ color: "#6a7488", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, padding: "8px 0" }}>Loading…</div>
            ) : listings.length === 0 ? (
              <div style={{ color: "#6a7488", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, padding: "8px 0" }}>No listings available.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {listings.map((l, i) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 9, background: i === 0 ? "rgba(255,224,122,.08)" : "rgba(255,255,255,.03)", border: `1px solid ${i === 0 ? "rgba(255,224,122,.3)" : "rgba(255,255,255,.06)"}` }}>
                    <span style={{ font: `500 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>#{i + 1}</span>
                    <span style={{ font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: i === 0 ? "#ffe07a" : "#cdd4df" }}>
                      {l.price.toLocaleString()} {BRAND.ticker}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {buyerPays != null && (
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6" }}>You pay (incl. {Math.round(FEE_RATE * 100)}% fee)</span>
                <span style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>{buyerPays.toLocaleString()} {BRAND.ticker}</span>
              </div>
            )}

            {state.phase === "error" && state.error && (
              <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff6b6b", marginTop: 12 }}>{state.error}</p>
            )}
            {busy && (
              <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#7cc4ff", marginTop: 12 }}>{state.message}</p>
            )}
            {state.phase === "done" && (
              <p style={{ font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#19e08a", marginTop: 12 }}>Purchase complete! Added to your collection.</p>
            )}

            <button onClick={handleBuy} disabled={busy || listings.length === 0 || state.phase === "done"} style={primaryBtn(busy || listings.length === 0 || state.phase === "done")}>
              {state.phase === "done" ? "Bought" : busy ? "Processing…" : lowest != null ? `Buy for ${lowest.toLocaleString()} ${BRAND.ticker}` : "Unavailable"}
            </button>
            <button onClick={onClose} disabled={busy} style={ghostBtn}>{state.phase === "done" ? "Close" : "Cancel"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(4,6,12,.72)", backdropFilter: "blur(4px)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
};
const panel: React.CSSProperties = {
  width: "100%", maxWidth: 520, padding: 26, borderRadius: 18,
  background: "linear-gradient(150deg,rgba(255,255,255,.05),rgba(14,18,28,.92))",
  border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 60px rgba(0,0,0,.6)",
};

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
