"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CARD_BACK_RADIUS } from "@/lib/cardBacks";
import { DEFAULT_CARD_BACK_ID } from "@memetgc/types";

interface CardBackItem {
  id: string;
  name: string;
  image: string;
  description: string;
  gate: { type: "default" } | { type: "token"; mint: string; min: number; symbol: string } | { type: "cosmetic" };
  unlocked: boolean;
  balance?: number;
}
interface CardBacksResponse {
  equipped: string;
  cardBacks: CardBackItem[];
}

interface Props {
  onClose: () => void;
  onEquipped?: (id: string) => void;
}

export default function CardBacksModal({ onClose, onEquipped }: Props) {
  const [items, setItems] = useState<CardBackItem[]>([]);
  const [equipped, setEquipped] = useState<string>(DEFAULT_CARD_BACK_ID);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<CardBacksResponse>("/api/economy/card-backs")
      .then((r) => { setItems(r.cardBacks); setEquipped(r.equipped); })
      .catch(() => setError("Couldn't load card backs"))
      .finally(() => setLoading(false));
  }, []);

  async function select(item: CardBackItem) {
    if (!item.unlocked || busy) return;
    if (item.id === equipped) return;
    setBusy(item.id);
    setError("");
    try {
      await api.post("/api/economy/cosmetics/equip", { type: "card_back", value: item.id });
      setEquipped(item.id);
      onEquipped?.(item.id);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't equip card back");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ font: `900 20px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Card Backs</div>
            <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", marginTop: 3 }}>Pick the card back shown on your deck & hand.</div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {error && <div style={{ margin: "10px 0", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff8a8a", textAlign: "center" }}>{error}</div>}

        {loading ? (
          <div style={{ padding: "50px 0", textAlign: "center", color: "#6a7488" }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 16, marginTop: 16 }}>
            {items.map((item) => {
              const isSelected = item.id === equipped;
              const locked = !item.unlocked;
              return (
                <button
                  key={item.id}
                  onClick={() => select(item)}
                  disabled={locked || busy === item.id}
                  style={{
                    position: "relative",
                    cursor: locked ? "not-allowed" : isSelected ? "default" : "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    padding: 12, borderRadius: 14, textAlign: "center",
                    background: isSelected ? "linear-gradient(160deg,rgba(247,199,74,.14),rgba(20,26,42,.6))" : "rgba(255,255,255,.03)",
                    border: `1.5px solid ${isSelected ? "#e7c768" : "rgba(255,255,255,.09)"}`,
                    boxShadow: isSelected ? "0 0 18px rgba(231,199,104,.28)" : "none",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      draggable={false}
                      style={{
                        width: 96, height: 132, objectFit: "cover", borderRadius: CARD_BACK_RADIUS,
                        boxShadow: "0 6px 16px rgba(0,0,0,.5)",
                        filter: locked ? "grayscale(1) brightness(.5)" : "none",
                      }}
                    />
                    {locked && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🔒</div>
                    )}
                    {isSelected && (
                      <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", padding: "3px 12px", borderRadius: 20, background: "linear-gradient(180deg,#ffe07a,#e0890f)", color: "#2a1a00", font: `800 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: 1, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(224,137,15,.4)" }}>SELECTED</div>
                    )}
                  </div>
                  <div>
                    <div style={{ font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{item.name}</div>
                    <div style={{ font: `500 10px/1.4 var(--font-archivo,'Archivo',sans-serif)`, color: locked ? "#caa24a" : "#8a93a6", marginTop: 5 }}>{item.description}</div>
                    {item.gate.type === "token" && item.balance != null && (
                      <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: item.unlocked ? "#19e08a" : "#6a7488", marginTop: 5 }}>
                        You hold {Math.floor(item.balance).toLocaleString()} {item.gate.symbol}
                      </div>
                    )}
                    {busy === item.id && <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 5 }}>Equipping…</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100,
  background: "rgba(4,6,12,.78)", backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};

const panel: React.CSSProperties = {
  width: "100%", maxWidth: 620, maxHeight: "84vh", overflowY: "auto",
  borderRadius: 18, padding: 22,
  background: "linear-gradient(150deg,#141a28,#0c0f18)",
  border: "1px solid rgba(255,255,255,.12)",
  boxShadow: "0 24px 60px rgba(0,0,0,.55)",
};

const closeBtn: React.CSSProperties = {
  cursor: "pointer", width: 30, height: 30, flexShrink: 0, borderRadius: 8,
  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)",
  color: "#cdd4df", fontSize: 13,
};
