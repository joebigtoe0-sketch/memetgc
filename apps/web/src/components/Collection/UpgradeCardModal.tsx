"use client";

import React, { useState } from "react";
import CardComponent, { type CardData } from "@/components/Card/CardComponent";
import { api } from "@/lib/api";
import { FRAME_UPGRADE_COST } from "@memetgc/types";

export type UpgradePath = "silver" | "gold_default" | "gold_silver";

interface Props {
  card: CardData;
  path: UpgradePath;
  defaultQuantity: number;
  silverQuantity: number;
  goldQuantity: number;
  onClose: () => void;
  onUpgraded: () => void;
}

const COPY: Record<UpgradePath, { title: string; cost: string; result: string; body: string }> = {
  silver: {
    title: "Upgrade to Silver",
    cost: `${FRAME_UPGRADE_COST.silverFromDefault} copies`,
    result: "1 silver-framed copy",
    body: `This will permanently destroy ${FRAME_UPGRADE_COST.silverFromDefault} regular copies of this card and create 1 silver-framed version. Copies assigned to decks are protected — only spare copies can be used.`,
  },
  gold_default: {
    title: "Upgrade to Gold",
    cost: `${FRAME_UPGRADE_COST.goldFromDefault} copies`,
    result: "1 gold-framed copy",
    body: `This will permanently destroy ${FRAME_UPGRADE_COST.goldFromDefault} regular copies of this card and create 1 gold-framed version. Copies assigned to decks are protected — only spare copies can be used.`,
  },
  gold_silver: {
    title: "Fuse to Gold",
    cost: `${FRAME_UPGRADE_COST.goldFromSilver} silver copies`,
    result: "1 gold-framed copy",
    body: `This will permanently destroy ${FRAME_UPGRADE_COST.goldFromSilver} silver-framed copies and create 1 gold-framed version. This cannot be undone.`,
  },
};

const PREVIEW_TIER: Record<UpgradePath, "silver" | "gold"> = {
  silver: "silver",
  gold_default: "gold",
  gold_silver: "gold",
};

export default function UpgradeCardModal({
  card,
  path,
  defaultQuantity,
  silverQuantity,
  goldQuantity,
  onClose,
  onUpgraded,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const info = COPY[path];
  const previewTier = PREVIEW_TIER[path];

  async function confirm() {
    setError("");
    setLoading(true);
    try {
      await api.post("/api/collection/upgrade", { cardId: card.id, path });
      onUpgraded();
      onClose();
    } catch (e) {
      setError((e as Error).message ?? "Upgrade failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ font: `900 20px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", textAlign: "center" }}>{info.title}</div>
        <div style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", textAlign: "center", marginTop: 6 }}>{card.name}</div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <CardComponent card={{ ...card, frameTier: previewTier }} size="md" glowing />
        </div>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "rgba(255,90,90,.08)", border: "1px solid rgba(255,90,90,.25)" }}>
          <div style={{ font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ff8a8a", letterSpacing: "1px" }}>PERMANENT — CANNOT BE UNDONE</div>
          <p style={{ font: `500 12px/1.55 var(--font-archivo,'Archivo',sans-serif)`, color: "#d8dde8", margin: "10px 0 0" }}>{info.body}</p>
          <div style={{ marginTop: 12, display: "grid", gap: 6, font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#aeb6c4" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cost</span><span style={{ color: "#ffce85" }}>{info.cost}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>You receive</span><span style={{ color: previewTier === "gold" ? "#e7c768" : "#cfd6e0" }}>{info.result}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Your copies</span><span>{defaultQuantity} regular · {silverQuantity} silver · {goldQuantity} gold</span></div>
          </div>
        </div>

        {error && <div style={{ marginTop: 12, font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff8a8a", textAlign: "center" }}>{error}</div>}

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button onClick={onClose} disabled={loading} style={ghostBtn}>Cancel</button>
          <button onClick={confirm} disabled={loading} style={confirmBtn}>{loading ? "Upgrading…" : "Confirm Upgrade"}</button>
        </div>
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
  width: "100%", maxWidth: 420, borderRadius: 16, padding: 22,
  background: "linear-gradient(150deg,#141a28,#0c0f18)",
  border: "1px solid rgba(255,255,255,.12)",
  boxShadow: "0 24px 60px rgba(0,0,0,.55)",
};

const ghostBtn: React.CSSProperties = {
  flex: 1, cursor: "pointer", padding: "12px 16px", borderRadius: 11,
  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)",
  color: "#cdd4df", font: `800 13px var(--font-cinzel,'Cinzel',serif)`,
};

const confirmBtn: React.CSSProperties = {
  flex: 1.4, cursor: "pointer", padding: "12px 16px", borderRadius: 11, border: "none",
  color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)",
  boxShadow: "0 8px 20px rgba(224,137,15,.35)",
  font: `800 13px var(--font-cinzel,'Cinzel',serif)`,
};
