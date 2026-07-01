"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import CardComponent from "@/components/Card/CardComponent";
import CardZoom from "@/components/Card/CardZoom";
import type { CardData } from "@/components/Card/CardComponent";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";
import { factionColor, FACTIONS } from "@/lib/factions";
import FactionIcon from "@/components/Faction/FactionIcon";
import SellModal from "@/components/Market/SellModal";

interface CollectionEntry { cardId: string; quantity: number; card: CardData; }
interface Deck { id: string; name: string; heroId: string; isStarter?: boolean; faction?: string; factionBonusActive?: boolean; cardCount: number; cards: { cardId: string; quantity: number }[]; }

const TYPES = ["", "minion", "spell", "weapon", "location", "hero"];
const TYPE_LABEL: Record<string, string> = { "": "All", minion: "Minion", spell: "Spell", weapon: "Weapon", location: "Location", hero: "Hero" };
const COPY_LIMIT: Record<string, number> = { common: 4, rare: 3, epic: 2, legendary: 1 };

export default function CollectionPage() {
  const { token, hasUsername } = useAuthStore();
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CardData>>(new Map());
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<{ card: CardData; source: "grid" | "deck" } | null>(null);
  const [sellCard, setSellCard] = useState<CardData | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [toast, setToast] = useState("");
  const [filterFaction, setFilterFaction] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const showToast = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 2600); }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<CollectionEntry[]>("/api/collection"),
      api.get<Deck[]>("/api/decks"),
      api.get<CardData[]>("/api/cards?collectible=false"),
    ]).then(([col, dks, cards]) => {
      setCollection(col);
      setDecks(dks);
      setCatalog(new Map(cards.map((c) => [c.id, c])));
      if (dks[0]) setSelectedDeck(dks[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (!token || !hasUsername) return <AuthModal />;

  const ownedMap = new Map(collection.map((e) => [e.cardId, e.quantity]));
  const cardOf = (id: string) => catalog.get(id) ?? collection.find((e) => e.cardId === id)?.card;
  const costOf = (id: string) => cardOf(id)?.cost ?? 0;

  const filtered = collection.filter((e) => {
    if (filterFaction && e.card.faction !== filterFaction) return false;
    if (filterType && e.card.type !== filterType) return false;
    if (filterSearch && !e.card.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const deck = decks.find((d) => d.id === selectedDeck);
  const deckFull = (deck?.cardCount ?? 0) >= 30;
  const deckComplete = (deck?.cardCount ?? 0) === 30;
  const isStarter = !!deck?.isStarter;
  const deckFac = deck ? factionColor(deck.faction ?? "degen") : "#9aa3b2";

  const copiesInDeck = (id: string) => deck?.cards.find((c) => c.cardId === id)?.quantity ?? 0;
  function canAdd(card: CardData): { ok: boolean; reason?: string } {
    if (!deck) return { ok: false, reason: "Create or select a deck first" };
    if (isStarter) return { ok: false, reason: "Starter decks can't be edited — make a New Deck" };
    if (deckFull) return { ok: false, reason: "Deck is full (30/30)" };
    const have = copiesInDeck(card.id);
    const limit = COPY_LIMIT[card.rarity] ?? 1;
    if (have + 1 > limit) return { ok: false, reason: `Max ${limit} copies of ${card.name}` };
    if ((ownedMap.get(card.id) ?? 0) < have + 1) return { ok: false, reason: `You don't own enough ${card.name}` };
    return { ok: true };
  }

  function applyDeck(updated: Deck) {
    setDecks((ds) => ds.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function addCard(card: CardData) {
    const check = canAdd(card);
    if (!check.ok) { showToast(check.reason!); return; }
    try {
      const updated = await api.post<Deck>(`/api/decks/${selectedDeck}/cards`, { cardId: card.id });
      applyDeck(updated);
    } catch (e) { showToast((e as Error).message); }
  }

  async function removeCard(cardId: string) {
    if (!deck || isStarter) { showToast("Starter decks can't be edited"); return; }
    try {
      const updated = await api.delete<Deck>(`/api/decks/${selectedDeck}/cards/${cardId}`);
      applyDeck(updated);
    } catch (e) { showToast((e as Error).message); }
  }

  async function newDeck() {
    try {
      const created = await api.post<Deck>("/api/decks/new", { name: "New Deck" });
      setDecks((ds) => [created, ...ds]);
      setSelectedDeck(created.id);
      setRenameValue(created.name);
      setRenaming(true);
    } catch (e) { showToast((e as Error).message); }
  }

  async function commitRename() {
    setRenaming(false);
    const name = renameValue.trim();
    if (!deck || !name || name === deck.name) return;
    try {
      const updated = await api.patch<Deck>(`/api/decks/${selectedDeck}`, { name });
      applyDeck(updated);
    } catch (e) { showToast((e as Error).message); }
  }

  async function deleteDeck() {
    if (!deck || isStarter) return;
    if (!confirm(`Delete deck "${deck.name}"?`)) return;
    try {
      await api.delete(`/api/decks/${selectedDeck}`);
      const remaining = decks.filter((d) => d.id !== selectedDeck);
      setDecks(remaining);
      setSelectedDeck(remaining[0]?.id ?? "");
    } catch (e) { showToast((e as Error).message); }
  }

  const curve = (() => {
    const b = new Array(8).fill(0);
    for (const c of deck?.cards ?? []) b[Math.min(7, costOf(c.cardId))] += c.quantity;
    return b;
  })();
  const maxBar = Math.max(1, ...curve);
  const deckCardEntries = (deck?.cards ?? [])
    .map((c) => ({ ...c, card: cardOf(c.cardId) }))
    .filter((c): c is { cardId: string; quantity: number; card: CardData } => !!c.card)
    .sort((a, b) => (a.card.cost - b.card.cost) || a.card.name.localeCompare(b.card.name));

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 30px", flexShrink: 0 }}>
        <button onClick={() => router.push("/")} style={chip}>‹ Back</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Collection</div>
        <span style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>{collection.length} unique</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => router.push("/market")} style={{ cursor: "pointer", height: 34, padding: "0 14px", borderRadius: 9, display: "flex", alignItems: "center", gap: 6, font: `800 12px var(--font-cinzel,'Cinzel',serif)`, color: "#04140d", background: "linear-gradient(180deg,#4ff0a8,#129c66)", border: "none", boxShadow: "0 4px 12px rgba(25,224,138,.3)" }}>Buy Cards</button>
          <button onClick={newDeck} style={{ cursor: "pointer", height: 34, padding: "0 14px", borderRadius: 9, display: "flex", alignItems: "center", gap: 6, font: `800 12px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", border: "none", boxShadow: "0 4px 12px rgba(224,137,15,.3)" }}>+ New Deck</button>
          <FacBtn active={filterFaction === ""} color="#cdd4df" onClick={() => setFilterFaction("")}>ALL</FacBtn>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,.1)", margin: "0 2px" }} />
          {FACTIONS.map((f) => (
            <FacBtn key={f} active={filterFaction === f} color={factionColor(f)} onClick={() => setFilterFaction(filterFaction === f ? "" : f)}>
              <FactionIcon faction={f} size={22} />
            </FacBtn>
          ))}
          <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Search cards…" style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#e7ecf3", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, width: 150, outline: "none" }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, padding: "0 30px 16px", minHeight: 0 }}>

        {/* Left — type pills + grid */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {TYPES.map((t) => {
              const on = filterType === t;
              return (
                <button key={t || "all"} onClick={() => setFilterType(t)} style={{ cursor: "pointer", padding: "7px 16px", borderRadius: 9, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: on ? "#2a1a00" : "#aeb6c4", background: on ? "linear-gradient(180deg,#ffe07a,#e0890f)" : "rgba(255,255,255,.04)", border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.1)"}` }}>{TYPE_LABEL[t]}</button>
              );
            })}
            <span style={{ marginLeft: "auto", alignSelf: "center", font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478" }}>Left-click to view · right-click to add to deck</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 28px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6a7488" }}>Loading collection…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#5a6478" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🃏</div>
                <p style={{ font: `700 15px var(--font-cinzel,'Cinzel',serif)`, color: "#aeb6c4" }}>{collection.length === 0 ? "You don't own any cards yet" : "No cards match your filters"}</p>
                {collection.length === 0 && <>
                  <p style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, marginTop: 8 }}>Open packs to start your collection. You can still play Practice & Casual with the ready-made decks.</p>
                  <button onClick={() => router.push("/shop")} style={{ marginTop: 18, cursor: "pointer", padding: "12px 24px", borderRadius: 11, border: "none", color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", font: `800 13px var(--font-cinzel,'Cinzel',serif)` }}>Open Shop ›</button>
                </>}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "34px 26px", justifyItems: "center" }}>
                {filtered.map((entry) => {
                  const inDeck = copiesInDeck(entry.cardId);
                  return (
                    <div key={entry.cardId} style={{ position: "relative", cursor: "pointer" }}
                      onClick={() => setZoom({ card: { ...entry.card, ownedCount: entry.quantity }, source: "grid" })}
                      onContextMenu={(e) => { e.preventDefault(); addCard(entry.card); }}
                    >
                      <CardComponent card={{ ...entry.card, ownedCount: entry.quantity }} size="md" interactive dimmed={inDeck > 0 && inDeck >= (COPY_LIMIT[entry.card.rarity] ?? 1)} />
                      <div style={{ position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)", padding: "2px 11px", borderRadius: 20, font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, background: "#0d1020", border: `1px solid ${factionColor(entry.card.faction)}`, color: factionColor(entry.card.faction), whiteSpace: "nowrap" }}>
                        ×{entry.quantity}{inDeck > 0 ? ` · ${inDeck} in deck` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — deck panel */}
        <div style={{ borderRadius: 16, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {deck ? <FactionIcon faction={deck.faction ?? "degen"} size={30} /> : <span style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>?</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                {renaming ? (
                  <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }} maxLength={50}
                    style={{ width: "100%", background: "rgba(0,0,0,.3)", border: `1px solid ${deckFac}`, borderRadius: 7, color: "#f1f4f9", font: `800 14px var(--font-cinzel,'Cinzel',serif)`, padding: "5px 8px", outline: "none" }} />
                ) : decks.length > 0 ? (
                  <select value={selectedDeck} onChange={(e) => setSelectedDeck(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", color: "#f1f4f9", font: `800 15px var(--font-cinzel,'Cinzel',serif)`, outline: "none", cursor: "pointer" }}>
                    {decks.map((d) => <option key={d.id} value={d.id} style={{ background: "#12161f" }}>{d.name}{d.isStarter ? " (Starter)" : ""}</option>)}
                  </select>
                ) : <div style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#8a93a6" }}>No deck — click + New Deck</div>}
              </div>
              {deck && !isStarter && !renaming && (
                <button title="Rename" onClick={() => { setRenameValue(deck.name); setRenaming(true); }} style={iconBtn}>✎</button>
              )}
              {deck && !isStarter && (
                <button title="Delete deck" onClick={deleteDeck} style={{ ...iconBtn, color: "#ff8a8a" }}>🗑</button>
              )}
              <span style={{ font: `800 12px var(--font-mono,'JetBrains Mono',monospace)`, color: deckFull ? "#19e08a" : "#e7c768" }}>{deck?.cardCount ?? 0}/30</span>
            </div>
            {isStarter && <div style={{ marginTop: 8, font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#caa24a" }}>★ Starter deck · read-only (playable in Practice/Casual)</div>}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 30, marginTop: 12 }}>
              {curve.map((v, i) => (
                <div key={i} style={{ flex: 1, height: `${(v / maxBar) * 100}%`, minHeight: 3, borderRadius: 2, background: `linear-gradient(180deg,${deckFac},${deckFac}66)`, opacity: v === 0 ? 0.18 : 1 }} title={`${i}${i === 7 ? "+" : ""}: ${v}`} />
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {deckCardEntries.map((c) => (
              <div key={c.cardId}
                onClick={() => setZoom({ card: { ...c.card, ownedCount: ownedMap.get(c.cardId) ?? 0 }, source: "deck" })}
                onContextMenu={(e) => { e.preventDefault(); removeCard(c.cardId); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 3, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.05)" }}>
                <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 38% 30%,#dcefff,#4a90e6 55%,#1f4f9e)", font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff" }}>{c.card.cost}</div>
                <span style={{ flex: 1, font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#dfe5ee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.card.name}</span>
                <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>×{c.quantity}</span>
              </div>
            ))}
            {deckCardEntries.length === 0 && <div style={{ textAlign: "center", padding: "24px 12px", color: "#6a7488", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, lineHeight: 1.5 }}>{deck ? "Empty deck. Right-click cards (or open them) to add." : "Make a New Deck to start building."}</div>}
          </div>

          <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <button onClick={() => router.push("/play")} disabled={!deckComplete} style={{ width: "100%", cursor: deckComplete ? "pointer" : "not-allowed", padding: "12px", borderRadius: 11, border: "none", color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 6px 16px rgba(224,137,15,.35)", font: `900 14px var(--font-cinzel,'Cinzel',serif)`, opacity: deckComplete ? 1 : 0.5 }}>SAVE & PLAY</button>
            {!deckComplete && deck && (
              <div style={{ marginTop: 8, textAlign: "center", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#caa24a" }}>Need 30 cards to play ({deck.cardCount}/30)</div>
            )}
          </div>
        </div>
      </div>

      {toast && <div style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", padding: "11px 20px", borderRadius: 11, background: "rgba(20,26,42,.95)", border: "1px solid rgba(247,147,26,.4)", color: "#ffce85", font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, zIndex: 60, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>{toast}</div>}

      <BottomNav active="collection" />
      <CardZoom
        card={zoom?.card ?? null}
        onClose={() => setZoom(null)}
        actions={
          zoom?.source === "grid"
            ? [
                { label: deck && !isStarter ? (canAdd(zoom.card).ok ? "Add to Deck" : (canAdd(zoom.card).reason ?? "Can't add")) : "Add to Deck", onClick: () => { addCard(zoom.card); setZoom(null); }, disabled: !canAdd(zoom.card).ok },
                { label: "Sell", variant: "ghost" as const, onClick: () => { setSellCard(zoom.card); setZoom(null); }, disabled: (ownedMap.get(zoom.card.id) ?? 0) < 1 },
              ]
            : zoom?.source === "deck"
            ? [{ label: "Remove from Deck", variant: "danger" as const, onClick: () => { removeCard(zoom.card.id); setZoom(null); }, disabled: isStarter }]
            : undefined
        }
      />
      {sellCard && (
        <SellModal
          kind="card"
          itemId={sellCard.id}
          title={sellCard.name}
          onClose={() => setSellCard(null)}
          onListed={() => { api.get<CollectionEntry[]>("/api/collection").then(setCollection).catch(() => {}); }}
        />
      )}
    </div>
  );
}

function FacBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ cursor: "pointer", minWidth: 34, height: 34, padding: "0 8px", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: active ? "#15101a" : color, background: active ? color : "rgba(255,255,255,.04)", border: `1px solid ${active ? color : "rgba(255,255,255,.1)"}`, boxShadow: active ? `0 0 12px ${color}66` : "none" }}>{children}</button>
  );
}

const chip: React.CSSProperties = { cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const iconBtn: React.CSSProperties = { cursor: "pointer", width: 26, height: 26, flexShrink: 0, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "#cdd4df", fontSize: 12 };
