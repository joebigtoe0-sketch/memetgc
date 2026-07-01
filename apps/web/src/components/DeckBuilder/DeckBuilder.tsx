"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { FACTION_COLORS, RARITY_STYLE } from "@/lib/constants";
import CardComponent from "../Card/CardComponent";
import CardZoom from "../Card/CardZoom";
import GameIcon from "../UI/GameIcon";
import type { CardData } from "../Card/CardComponent";

const COPY_LIMITS: Record<string, number> = { common: 4, rare: 3, epic: 2, legendary: 1 };
const FACTIONS = ["bitcoin", "ethereum", "solana", "meme", "stable", "degen"];
const TYPES = ["minion", "spell", "weapon", "location", "hero"];
const RARITIES = ["common", "rare", "epic", "legendary"];

interface Hero {
  id: string;
  name: string;
  faction: string;
  description: string;
}

export default function DeckBuilder() {
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [deckCards, setDeckCards] = useState<CardData[]>([]);
  const [selectedHero, setSelectedHero] = useState<string>("");
  const [deckName, setDeckName] = useState("My Deck");
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterFaction, setFilterFaction] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterRarity, setFilterRarity] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCost, setFilterCost] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [cards, heroList] = await Promise.all([
        api.get<CardData[]>("/api/cards?collectible=true"),
        api.get<Hero[]>("/api/heroes"),
      ]);
      setAllCards(cards);
      setHeroes(heroList);
      setLoading(false);
    })();
  }, []);

  function getCardCount(cardId: string): number {
    return deckCards.filter((c) => c.id === cardId).length;
  }

  function addCard(card: CardData) {
    const count = getCardCount(card.id);
    const limit = COPY_LIMITS[card.rarity] ?? 1;
    if (count >= limit) return;
    if (deckCards.length >= 30) return;
    setDeckCards((prev) => [...prev, card].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)));
  }

  function removeCard(cardId: string) {
    const idx = deckCards.findLastIndex((c) => c.id === cardId);
    if (idx === -1) return;
    setDeckCards((prev) => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
  }

  async function saveDeck() {
    if (deckCards.length !== 30 || !selectedHero) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await api.post("/api/decks", {
        name: deckName,
        heroId: selectedHero,
        cardIds: deckCards.map((c) => c.id),
      });
      setSaveMsg("Deck saved!");
    } catch (e: unknown) {
      setSaveMsg((e as Error).message ?? "Failed to save deck");
    } finally {
      setSaving(false);
    }
  }

  const filteredCards = allCards.filter((c) => {
    if (filterFaction && c.faction !== filterFaction) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterRarity && c.rarity !== filterRarity) return false;
    if (filterCost !== null && c.cost !== filterCost) return false;
    if (filterSearch && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  // Detect faction bonus
  const nonDegenCards = deckCards.filter((c) => c.faction !== "degen");
  const primaryFaction = nonDegenCards.length > 0 ? nonDegenCards[0]!.faction : null;
  const factionBonusActive = primaryFaction !== null && nonDegenCards.every((c) => c.faction === primaryFaction);

  // Count unique cards with quantities for deck list
  const deckList = Array.from(
    deckCards.reduce((acc, card) => {
      const existing = acc.get(card.id);
      if (existing) existing.count++;
      else acc.set(card.id, { card, count: 1 });
      return acc;
    }, new Map<string, { card: CardData; count: number }>())
  ).map(([, v]) => v);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "#4060a0" }}>
        Loading cards...
      </div>
    );
  }

  return (
    <div className="flex h-full w-full" style={{ background: "#080b16", color: "#c8d0e0" }}>
      {/* Left — Card Collection */}
      <div className="flex flex-col" style={{ width: 520, borderRight: "1px solid #1a2040", flexShrink: 0 }}>
        {/* Filters */}
        <div className="p-3 border-b border-gray-800 space-y-2">
          <input
            className="w-full px-3 py-1.5 rounded text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
            placeholder="Search cards..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <select
              className="px-2 py-1 rounded text-xs"
              style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
              value={filterFaction}
              onChange={(e) => setFilterFaction(e.target.value)}
            >
              <option value="">All Factions</option>
              {FACTIONS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
            <select
              className="px-2 py-1 rounded text-xs"
              style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select
              className="px-2 py-1 rounded text-xs"
              style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
            >
              <option value="">All Rarities</option>
              {RARITIES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <div className="flex gap-1">
              {[null, 0, 1, 2, 3, 4, 5, 6, 7].map((cost) => (
                <button
                  key={cost ?? "all"}
                  className="w-7 h-7 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: filterCost === cost ? "#2040a0" : "#0d1020",
                    border: `1px solid ${filterCost === cost ? "#4060ff" : "#2a3560"}`,
                    color: filterCost === cost ? "#80a0ff" : "#6080a0",
                  }}
                  onClick={() => setFilterCost(filterCost === cost ? null : cost)}
                >
                  {cost === null ? "★" : cost === 7 ? "7+" : cost}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-wrap gap-3 justify-center">
            {filteredCards.map((card) => {
              const count = getCardCount(card.id);
              const limit = COPY_LIMITS[card.rarity] ?? 1;
              const atLimit = count >= limit;

              return (
                <div
                  key={card.id}
                  className="relative cursor-pointer group"
                  data-sound-skip-click
                  onClick={() => addCard(card)}
                  onContextMenu={(e) => { e.preventDefault(); setZoomedCard(card); }}
                >
                  <CardComponent
                    card={card}
                    size="sm"
                    interactive={!atLimit}
                    dimmed={atLimit}
                    glowing={false}
                  />
                  {count > 0 && (
                    <div
                      className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center font-black text-white text-xs"
                      style={{ background: "#2040a0", border: "1px solid #4060ff", fontSize: 8 }}
                    >
                      {count}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right — Deck Builder */}
      <div className="flex flex-col flex-1" style={{ minWidth: 300 }}>
        {/* Deck header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm font-bold"
              style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
            />
            <div
              className="px-2 py-1 rounded text-xs font-bold"
              style={{
                background: deckCards.length === 30 ? "rgba(40,100,40,0.5)" : "rgba(100,40,40,0.3)",
                border: `1px solid ${deckCards.length === 30 ? "#40e080" : "#804040"}`,
                color: deckCards.length === 30 ? "#40e080" : "#a06060",
              }}
            >
              {deckCards.length}/30
            </div>
          </div>

          {/* Faction bonus */}
          {factionBonusActive && primaryFaction && (
            <div
              className="text-xs px-2 py-1 rounded mb-2"
              style={{
                background: `${FACTION_COLORS[primaryFaction]?.bg ?? "rgba(30,30,40,0.5)"}`,
                border: `1px solid ${FACTION_COLORS[primaryFaction]?.base ?? "#333"}`,
                color: FACTION_COLORS[primaryFaction]?.base ?? "#888",
              }}
            >
              {primaryFaction.charAt(0).toUpperCase() + primaryFaction.slice(1)} Faction Bonus Active
            </div>
          )}

          {/* Hero select */}
          <select
            className="w-full px-3 py-1.5 rounded text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
            value={selectedHero}
            onChange={(e) => setSelectedHero(e.target.value)}
          >
            <option value="">Select Hero...</option>
            {heroes.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.faction})</option>)}
          </select>
        </div>

        {/* Deck list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {deckList.map(({ card, count }) => {
            const fac = FACTION_COLORS[card.faction] ?? FACTION_COLORS.degen!;
            const rar = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common!;

            return (
              <div
                key={card.id}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
                data-sound-skip-click
                style={{ background: `${fac.bg}`, border: `1px solid ${fac.base}44` }}
                onClick={() => removeCard(card.id)}
              >
                {/* Cost */}
                <div
                  className="flex items-center justify-center rounded-full font-black text-white flex-shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    fontSize: 10,
                    background: `radial-gradient(circle, ${fac.base}, rgba(0,0,0,0.8))`,
                  }}
                >
                  {card.cost}
                </div>
                {/* Name */}
                <span className="flex-1 text-sm font-medium truncate" style={{ color: "#c8d0e0" }}>
                  {card.name}
                </span>
                {/* Rarity dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: `radial-gradient(circle, ${rar.gem1}, ${rar.gem2})` }}
                />
                {/* Count */}
                <div className="text-xs font-bold" style={{ color: fac.base, minWidth: 14, textAlign: "right" }}>
                  ×{count}
                </div>
              </div>
            );
          })}

          {deckList.length === 0 && (
            <div className="text-center py-8" style={{ color: "#2a3560" }}>
              <GameIcon name="collection" size={32} style={{ margin: "0 auto 8px" }} />
              <p className="text-sm">Click cards to add them to your deck</p>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="p-3 border-t border-gray-800">
          {saveMsg && (
            <p className="text-xs mb-2 text-center" style={{ color: saveMsg.includes("!") ? "#40e080" : "#ff4444" }}>
              {saveMsg}
            </p>
          )}
          <button
            onClick={saveDeck}
            disabled={deckCards.length !== 30 || !selectedHero || saving}
            className="w-full py-2 rounded font-bold text-sm transition-all"
            style={{
              background:
                deckCards.length === 30 && selectedHero && !saving
                  ? "linear-gradient(135deg, #2a6040, #1a4020)"
                  : "rgba(20,20,30,0.6)",
              border: `1px solid ${deckCards.length === 30 && selectedHero ? "#40e080" : "#333"}`,
              color: deckCards.length === 30 && selectedHero ? "#40e080" : "#555",
              cursor: deckCards.length === 30 && selectedHero && !saving ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving..." : "Save Deck"}
          </button>
        </div>
      </div>

      <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} />
    </div>
  );
}
