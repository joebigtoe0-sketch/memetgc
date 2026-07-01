"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";
import Logo from "@/components/Brand/Logo";
import { BRAND } from "@/lib/brand";
import CardComponent, { type CardData } from "@/components/Card/CardComponent";

interface PackEntry { packType: string; quantity: number; }
interface OpenResult { cards: CardData[]; remaining: number; }

const PACK_META: Record<string, { name: string; color: string; tag: string }> = {
  standard: { name: "Standard Pack", color: "#7b8cf4", tag: "STANDARD" },
  faction: { name: "Faction Pack", color: "#f7931a", tag: "FACTION" },
  season: { name: "Season Pack", color: "#19e08a", tag: "SEASON" },
  legendary: { name: "Legendary Pack", color: "#e7c768", tag: "LEGENDARY" },
};

const RARITY_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

type View = "inventory" | "reveal";

export default function PacksPage() {
  const { token, hasUsername } = useAuthStore();
  const router = useRouter();

  const [inventory, setInventory] = useState<PackEntry[]>([]);
  const [view, setView] = useState<View>("inventory");
  const [openType, setOpenType] = useState<string>("standard");
  const [cards, setCards] = useState<CardData[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadInventory = useCallback(() => {
    api.get<PackEntry[]>("/api/economy/packs/inventory").then(setInventory).catch(() => {});
  }, []);

  useEffect(() => { if (token) loadInventory(); }, [token, loadInventory]);

  if (!token || !hasUsername) return <AuthModal />;

  async function openPack(type: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await api.post<OpenResult>("/api/economy/packs/open", { packType: type });
      setOpenType(type);
      setCards(res.cards);
      setRevealed(res.cards.map(() => false));
      setRemaining(res.remaining);
      setView("reveal");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const flip = (i: number) => setRevealed((r) => r.map((v, idx) => (idx === i ? true : v)));
  const revealAll = () => setRevealed((r) => r.map(() => true));
  const allRevealed = revealed.length > 0 && revealed.every(Boolean);
  const bestRarity = cards.reduce((best, c) => (RARITY_RANK[c.rarity] > RARITY_RANK[best] ? c.rarity : best), "common");

  const meta = PACK_META[openType] ?? PACK_META.standard;
  const totalPacks = inventory.reduce((s, p) => s + p.quantity, 0);

  // ── Reveal view ──────────────────────────────────────────────
  if (view === "reveal") {
    const headerColor = PACK_META[openType]?.color ?? "#e7c768";
    return (
      <div style={pageBg}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 26px" }}>
          <button onClick={() => { setView("inventory"); loadInventory(); }} style={backBtn}>‹ Packs</button>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", minHeight: 0 }}>
          <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "4px", color: headerColor, textTransform: "uppercase" }}>
            {meta.tag} PACK · GENESIS
          </div>
          <div style={{ font: `900 34px var(--font-cinzel,'Cinzel',serif)`, color: "#fff", marginTop: 8, textTransform: "uppercase", textAlign: "center" }}>
            {allRevealed ? `${rarityLabel(bestRarity)} Pull!` : "Reveal your cards"}
          </div>
          <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 6 }}>
            {allRevealed ? `${cards.length} cards added to your collection` : `${revealed.filter(Boolean).length} of ${cards.length} revealed`}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", margin: "30px 0 26px" }}>
            {cards.map((card, i) => (
              <div key={i} onClick={() => flip(i)} style={{ cursor: revealed[i] ? "default" : "pointer", transition: "transform .15s ease" }}>
                {revealed[i] ? (
                  <CardComponent card={card} size="md" glowing={RARITY_RANK[card.rarity] >= 2} />
                ) : (
                  <PackBack />
                )}
              </div>
            ))}
          </div>

          {allRevealed ? (
            <div style={{ display: "flex", gap: 14 }}>
              {remaining > 0 && (
                <button onClick={() => openPack(openType)} disabled={busy} style={secondaryBtn}>Open Another ({remaining})</button>
              )}
              <button onClick={() => router.push("/collection")} style={goldBtn}>Add to Collection ›</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={revealAll} style={goldBtn}>Reveal All ⚡</button>
              <span style={{ font: `500 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>Tap each card to flip</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Inventory view ───────────────────────────────────────────
  return (
    <div style={pageBg}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px" }}>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Your Packs</div>
        <button onClick={() => router.push("/shop")} style={{ ...goldBtn, marginLeft: "auto", padding: "10px 18px", fontSize: 12 }}>Buy more ›</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 26px 16px" }}>
        {error && <div style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff8a8a", marginBottom: 14 }}>{error}</div>}
        {totalPacks === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#6a7488" }}>
            <div style={{ fontSize: 54, marginBottom: 14 }}>🎁</div>
            <div style={{ font: `700 16px var(--font-cinzel,'Cinzel',serif)`, color: "#aeb6c4" }}>No packs yet</div>
            <div style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, marginTop: 8 }}>Head to the Shop to buy booster packs.</div>
            <button onClick={() => router.push("/shop")} style={{ ...goldBtn, marginTop: 20 }}>Open Shop ›</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 18, maxWidth: 940 }}>
            {inventory.map((p) => {
              const m = PACK_META[p.packType] ?? PACK_META.standard;
              return (
                <div key={p.packType} style={{ borderRadius: 16, padding: 20, background: `linear-gradient(155deg,color-mix(in srgb,${m.color} 14%,transparent),rgba(18,23,35,.6))`, border: `1px solid ${m.color}55`, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <PackBack small />
                    <div style={{ position: "absolute", top: -8, right: -8, minWidth: 26, height: 26, padding: "0 6px", borderRadius: 13, background: m.color, color: "#1a1206", font: `900 13px var(--font-mono,'JetBrains Mono',monospace)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.4)" }}>×{p.quantity}</div>
                  </div>
                  <div style={{ font: `800 15px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9", marginTop: 14 }}>{m.name}</div>
                  <button onClick={() => openPack(p.packType)} disabled={busy} style={{ ...goldBtn, width: "100%", marginTop: 12, background: `linear-gradient(180deg,${m.color},color-mix(in srgb,${m.color} 70%,#000))` }}>
                    {busy ? "Opening…" : "Open Pack"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="packs" />
    </div>
  );
}

function rarityLabel(r: string): string {
  return ({ common: "Solid", rare: "Rare", epic: "Epic", legendary: "Legendary" } as Record<string, string>)[r] ?? "Nice";
}

function PackBack({ small }: { small?: boolean }) {
  const w = small ? 110 : 195, h = small ? 160 : 285;
  return (
    <div style={{
      width: w, height: h, borderRadius: 14,
      background: "repeating-linear-gradient(125deg,#3a2c0c 0px,#3a2c0c 14px,#2b2008 14px,#2b2008 28px)",
      border: "2px solid #e7c768", boxShadow: "0 10px 26px rgba(0,0,0,.5), 0 0 24px rgba(231,199,104,.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Logo size={small ? 38 : 56} />
    </div>
  );
}

const pageBg: React.CSSProperties = {
  position: "fixed", inset: 0, display: "flex", flexDirection: "column",
  background: "radial-gradient(140% 90% at 50% -8%,#181206 0%,#0b0a09 55%,#06080d 100%)",
  fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
};
const backBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const goldBtn: React.CSSProperties = { cursor: "pointer", border: "none", padding: "13px 26px", borderRadius: 11, font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.35), inset 0 1px 0 rgba(255,255,255,.5)" };
const secondaryBtn: React.CSSProperties = { cursor: "pointer", padding: "13px 22px", borderRadius: 11, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", color: "#e7ecf3", font: `700 13px var(--font-cinzel,'Cinzel',serif)` };
