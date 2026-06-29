"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import CardComponent from "@/components/Card/CardComponent";
import CardZoom from "@/components/Card/CardZoom";
import type { CardData } from "@/components/Card/CardComponent";
import { FACTION_COLORS, RARITY_STYLE } from "@/lib/constants";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";

interface CollectionEntry {
  cardId: string;
  quantity: number;
  card: CardData;
}

const FACTIONS = ["", "bitcoin", "ethereum", "solana", "meme", "stable", "degen"];
const RARITIES = ["", "common", "rare", "epic", "legendary"];

export default function CollectionPage() {
  const { token } = useAuthStore();
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);
  const [filterFaction, setFilterFaction] = useState("");
  const [filterRarity, setFilterRarity] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get<CollectionEntry[]>("/api/collection").then((data) => {
      setCollection(data);
      setLoading(false);
    });
  }, [token]);

  if (!token) return <AuthModal />;

  const filtered = collection.filter((e) => {
    if (filterFaction && e.card.faction !== filterFaction) return false;
    if (filterRarity && e.card.rarity !== filterRarity) return false;
    if (filterSearch && !e.card.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full w-full flex flex-col" style={{ background: "#080b16" }}>
      {/* Header */}
      <div
        className="flex-none px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: "1px solid #1a2040" }}
      >
        <h1 className="font-black text-xl" style={{ color: "#f7931a" }}>Collection</h1>
        <span className="text-xs" style={{ color: "#4060a0" }}>
          {collection.length} cards
        </span>

        <div className="flex gap-2 ml-auto">
          <input
            className="px-3 py-1 rounded text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0", width: 160 }}
            placeholder="Search..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          <select
            className="px-2 py-1 rounded text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
            value={filterFaction}
            onChange={(e) => setFilterFaction(e.target.value)}
          >
            <option value="">All Factions</option>
            {FACTIONS.filter(Boolean).map((f) => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
          <select
            className="px-2 py-1 rounded text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
            value={filterRarity}
            onChange={(e) => setFilterRarity(e.target.value)}
          >
            <option value="">All Rarities</option>
            {RARITIES.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ color: "#4060a0" }}>
            Loading collection...
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center">
            {filtered.map((entry) => (
              <div
                key={entry.cardId}
                className="relative cursor-pointer"
                onClick={() => setZoomedCard(entry.card)}
              >
                <CardComponent card={entry.card} size="md" interactive />
                {/* Quantity badge */}
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: "#0d1020",
                    border: `1px solid ${FACTION_COLORS[entry.card.faction]?.base ?? "#2a3560"}`,
                    color: FACTION_COLORS[entry.card.faction]?.base ?? "#6080a0",
                  }}
                >
                  ×{entry.quantity}
                </div>
              </div>
            ))}

            {filtered.length === 0 && !loading && (
              <div className="text-center py-12 w-full" style={{ color: "#2a3560" }}>
                <div className="text-4xl mb-3">🃏</div>
                <p>No cards found</p>
              </div>
            )}
          </div>
        )}
      </div>

      <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} />
    </div>
  );
}
