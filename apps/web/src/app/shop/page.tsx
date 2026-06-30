"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";

interface OpenResult { cards: { cardId: string; rarity: string }[]; newBalance: number; }
const PACKS = [
  { type: "standard", name: "Standard Pack", cost: 100, color: "#7b8cf4", desc: "5 cards · guaranteed Rare+" },
  { type: "faction", name: "Faction Pack", cost: 120, color: "#f7931a", desc: "5 cards from one faction" },
  { type: "legendary", name: "Legendary Pack", cost: 800, color: "#e7c768", desc: "5 cards · guaranteed Legendary" },
];

export default function ShopPage() {
  const { token, fragments, setFragments } = useAuthStore();
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (token) api.get<{ fragments: number }>("/api/economy/profile").then((p) => setFragments(p.fragments)).catch(() => {}); }, [token, setFragments]);
  if (!token) return <AuthModal />;

  async function openPack(type: string, cost: number) {
    if (busy || fragments < cost) { setMsg(fragments < cost ? "Not enough fragments." : ""); return; }
    setBusy(true); setMsg("");
    try {
      const res = await api.post<OpenResult>("/api/economy/packs/open", { packType: type });
      setFragments(res.newBalance);
      setMsg(`Opened ${res.cards.length} cards! Check your collection.`);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px" }}>
        <button onClick={() => router.push("/")} style={{ cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>‹ Back</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Shop</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "rgba(123,140,244,.1)", border: "1px solid rgba(123,140,244,.3)" }}>
          <span style={{ color: "#7b8cf4" }}>✦</span>
          <span style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c3ccff" }}>{fragments.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 26px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, maxWidth: 820 }}>
          {PACKS.map((p) => (
            <div key={p.type} style={{ borderRadius: 16, padding: 20, background: `linear-gradient(155deg,color-mix(in srgb,${p.color} 14%,transparent),rgba(18,23,35,.6))`, border: `1px solid ${p.color}55` }}>
              <div style={{ height: 96, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 50% 35%,color-mix(in srgb,${p.color} 30%,#1a1420),#0c0a12)`, border: `1px solid ${p.color}55`, font: `900 40px var(--font-cinzel,'Cinzel',serif)`, color: p.color }}>✦</div>
              <div style={{ font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9", marginTop: 14 }}>{p.name}</div>
              <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 5 }}>{p.desc}</div>
              <button onClick={() => openPack(p.type, p.cost)} disabled={busy || fragments < p.cost} style={{ width: "100%", marginTop: 14, cursor: busy || fragments < p.cost ? "not-allowed" : "pointer", padding: "12px", borderRadius: 11, border: "none", color: "#2a1a00", background: `linear-gradient(180deg,${p.color},color-mix(in srgb,${p.color} 70%,#000))`, font: `800 13px var(--font-cinzel,'Cinzel',serif)`, opacity: fragments < p.cost ? 0.5 : 1 }}>✦ {p.cost} · OPEN</button>
            </div>
          ))}
        </div>
        {msg && <div style={{ marginTop: 16, font: `600 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#7fe8bd" }}>{msg}</div>}
      </div>

      <BottomNav active="shop" />
    </div>
  );
}
