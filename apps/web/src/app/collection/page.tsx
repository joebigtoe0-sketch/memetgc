"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import CardComponent from "@/components/Card/CardComponent";
import CardZoom from "@/components/Card/CardZoom";
import type { CardData } from "@/components/Card/CardComponent";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";

interface CollectionEntry { cardId: string; quantity: number; card: CardData; }
interface Deck { id: string; name: string; heroId: string; faction?: string; cardCount: number; cards: { cardId: string; quantity: number }[]; }

const FAC: Record<string, string> = { bitcoin: "#f7931a", ethereum: "#7b8cf4", solana: "#19e08a", meme: "#ff5fae", stable: "#2bbd86", degen: "#9aa3b2" };
const GLYPH: Record<string, string> = { bitcoin: "₿", ethereum: "Ξ", solana: "◎", meme: "🐸", stable: "$", degen: "∞" };
const FACTIONS = ["bitcoin", "ethereum", "solana", "meme", "stable", "degen"];
const TYPES = ["", "minion", "spell", "weapon", "location", "hero"];
const TYPE_LABEL: Record<string, string> = { "": "All", minion: "Minion", spell: "Spell", weapon: "Weapon", location: "Location", hero: "Hero" };

export default function CollectionPage() {
  const { token } = useAuthStore();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);
  const [filterFaction, setFilterFaction] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<CollectionEntry[]>("/api/collection"),
      api.get<Deck[]>("/api/decks"),
    ]).then(([col, dks]) => {
      setCollection(col);
      setDecks(dks);
      if (dks[0]) setSelectedDeck(dks[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (!token) return <AuthModal />;

  const costOf = (id: string) => collection.find((e) => e.cardId === id)?.card.cost ?? 0;

  const filtered = collection.filter((e) => {
    if (filterFaction && e.card.faction !== filterFaction) return false;
    if (filterType && e.card.type !== filterType) return false;
    if (filterSearch && !e.card.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const deck = decks.find((d) => d.id === selectedDeck);
  const deckFac = deck ? (FAC[deck.faction ?? "degen"] ?? "#9aa3b2") : "#9aa3b2";
  const curve = (() => {
    const b = new Array(8).fill(0);
    for (const c of deck?.cards ?? []) b[Math.min(7, costOf(c.cardId))] += c.quantity;
    return b;
  })();
  const maxBar = Math.max(1, ...curve);
  const deckCardEntries = (deck?.cards ?? [])
    .map((c) => ({ ...c, card: collection.find((e) => e.cardId === c.cardId)?.card }))
    .filter((c) => c.card)
    .sort((a, b) => (a.card!.cost - b.card!.cost) || a.card!.name.localeCompare(b.card!.name));

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px", flexShrink: 0 }}>
        <button onClick={() => router.push("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>‹ Back</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Collection</div>
        <span style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>{collection.length} unique</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Faction icon filters */}
          <FacBtn active={filterFaction === ""} color="#cdd4df" onClick={() => setFilterFaction("")}>ALL</FacBtn>
          {FACTIONS.map((f) => (
            <FacBtn key={f} active={filterFaction === f} color={FAC[f]} onClick={() => setFilterFaction(filterFaction === f ? "" : f)}>{GLYPH[f]}</FacBtn>
          ))}
          <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Search cards…" style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#e7ecf3", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, width: 150, outline: "none" }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, padding: "0 26px 16px", minHeight: 0 }}>

        {/* Left — type pills + grid */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {TYPES.map((t) => {
              const on = filterType === t;
              return (
                <button key={t || "all"} onClick={() => setFilterType(t)} style={{ cursor: "pointer", padding: "7px 16px", borderRadius: 9, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: on ? "#2a1a00" : "#aeb6c4", background: on ? "linear-gradient(180deg,#ffe07a,#e0890f)" : "rgba(255,255,255,.04)", border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.1)"}` }}>{TYPE_LABEL[t]}</button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6a7488" }}>Loading collection…</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 18, justifyItems: "center" }}>
                {filtered.map((entry) => (
                  <div key={entry.cardId} style={{ position: "relative", cursor: "pointer" }} onClick={() => setZoomedCard(entry.card)}>
                    <CardComponent card={entry.card} size="md" interactive />
                    <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", padding: "2px 11px", borderRadius: 20, font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, background: "#0d1020", border: `1px solid ${FAC[entry.card.faction] ?? "#2a3560"}`, color: FAC[entry.card.faction] ?? "#9aa3b2" }}>×{entry.quantity}</div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px 0", color: "#3a4560" }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>🃏</div>
                    <p>No cards found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — deck panel */}
        <div style={{ borderRadius: 16, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 40% 30%,color-mix(in srgb,${deckFac} 35%,#2a2030),#15101a)`, border: `2px solid ${deckFac}`, font: `900 14px var(--font-cinzel,'Cinzel',serif)`, color: "#fff" }}>{deck ? GLYPH[deck.faction ?? "degen"] : "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {decks.length > 0 ? (
                  <select value={selectedDeck} onChange={(e) => setSelectedDeck(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", color: "#f1f4f9", font: `800 15px var(--font-cinzel,'Cinzel',serif)`, outline: "none", cursor: "pointer" }}>
                    {decks.map((d) => <option key={d.id} value={d.id} style={{ background: "#12161f" }}>{d.name}</option>)}
                  </select>
                ) : <div style={{ font: `800 15px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>No decks</div>}
              </div>
              <span style={{ font: `800 12px var(--font-mono,'JetBrains Mono',monospace)`, color: (deck?.cardCount ?? 0) === 30 ? "#19e08a" : "#e7c768" }}>{deck?.cardCount ?? 0}/30</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 30, marginTop: 12 }}>
              {curve.map((v, i) => (
                <div key={i} style={{ flex: 1, height: `${(v / maxBar) * 100}%`, minHeight: 3, borderRadius: 2, background: `linear-gradient(180deg,${deckFac},${deckFac}66)`, opacity: v === 0 ? 0.18 : 1 }} title={`${i}${i === 7 ? "+" : ""}: ${v}`} />
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {deckCardEntries.map((c) => (
              <div key={c.cardId} onClick={() => c.card && setZoomedCard(c.card)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 3, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.05)" }}>
                <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 38% 30%,#dcefff,#4a90e6 55%,#1f4f9e)", font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff" }}>{c.card!.cost}</div>
                <span style={{ flex: 1, font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#dfe5ee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.card!.name}</span>
                <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>×{c.quantity}</span>
              </div>
            ))}
            {deckCardEntries.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: "#6a7488", font: `500 12px var(--font-archivo,'Archivo',sans-serif)` }}>Empty deck.</div>}
          </div>

          <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", gap: 10 }}>
            <button onClick={() => router.push("/deck-builder")} style={{ cursor: "pointer", padding: "12px", borderRadius: 11, flex: "0 0 auto", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>Edit</button>
            <button onClick={() => router.push("/play")} style={{ cursor: "pointer", flex: 1, padding: "12px", borderRadius: 11, border: "none", color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 6px 16px rgba(224,137,15,.35)", font: `900 14px var(--font-cinzel,'Cinzel',serif)` }}>SAVE & PLAY</button>
          </div>
        </div>
      </div>

      <BottomNav active="collection" />
      <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} />
    </div>
  );
}

function FacBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ cursor: "pointer", minWidth: 34, height: 34, padding: "0 8px", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: active ? "#15101a" : color, background: active ? color : "rgba(255,255,255,.04)", border: `1px solid ${active ? color : "rgba(255,255,255,.1)"}`, boxShadow: active ? `0 0 12px ${color}66` : "none" }}>{children}</button>
  );
}
