"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { FACTION_COLORS } from "@/lib/constants";
import { getSocket } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";

interface Hero {
  id: string;
  name: string;
  faction: string;
  description: string;
  hp: number;
  armor: number;
  hero_power: { name: string; cost: number; description: string };
}

interface Deck {
  id: string;
  name: string;
  heroId: string;
  factionBonusActive: boolean;
  cardCount: number;
}

type GameMode = "practice" | "casual" | "ranked";

export default function HeroSelect() {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedHero, setSelectedHero] = useState<string>("");
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [mode, setMode] = useState<GameMode>("casual");
  const [queueing, setQueueing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const { connected, gameId } = useGameStore();

  useEffect(() => {
    (async () => {
      const [heroList, deckList] = await Promise.all([
        api.get<Hero[]>("/api/heroes"),
        api.get<Deck[]>("/api/decks"),
      ]);
      setHeroes(heroList);
      setDecks(deckList);
      if (heroList[0]) setSelectedHero(heroList[0].id);
      if (deckList[0]) setSelectedDeck(deckList[0].id);
    })();
  }, []);

  function handlePlayClick() {
    if (!selectedHero || !selectedDeck || !connected) return;
    const socket = getSocket();
    if (!socket) return;

    setQueueing(true);
    setStatusMsg(mode === "practice" ? "Starting practice game..." : "Finding opponent...");

    socket.emit("queue:join", { mode, deckId: selectedDeck, heroId: selectedHero });

    socket.once("game:error", (msg) => {
      setStatusMsg(`Error: ${msg}`);
      setQueueing(false);
    });
  }

  function handleCancelQueue() {
    const socket = getSocket();
    socket?.emit("queue:leave");
    setQueueing(false);
    setStatusMsg("");
  }

  const selectedHeroData = heroes.find((h) => h.id === selectedHero);

  const MODE_INFO: Record<GameMode, { label: string; color: string; desc: string }> = {
    practice: { label: "Practice", color: "#2bbd86", desc: "Play vs AI. No rewards, no wallet needed." },
    casual: { label: "Casual", color: "#7b8cf4", desc: "Play vs humans. Free. Earn booster pack tickets." },
    ranked: { label: "Ranked", color: "#f7931a", desc: "Competitive ladder. Requires 1,000 $DEGEN." },
  };

  return (
    <div
      className="flex flex-col h-full w-full items-center justify-center"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0d1a 100%)" }}
    >
      <div className="w-full max-w-3xl px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2" style={{ color: "#f7931a", textShadow: "0 0 20px rgba(247,147,26,0.5)" }}>
            DEGEN TCG
          </h1>
          <p className="text-sm" style={{ color: "#4060a0" }}>Select your hero and deck to play</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Hero selection */}
          <div>
            <h2 className="text-sm font-bold mb-3 uppercase tracking-widest" style={{ color: "#4060a0" }}>
              Hero
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {heroes.map((hero) => {
                const fac = FACTION_COLORS[hero.faction] ?? FACTION_COLORS.degen!;
                const isSelected = hero.id === selectedHero;
                return (
                  <div
                    key={hero.id}
                    onClick={() => setSelectedHero(hero.id)}
                    className="cursor-pointer flex flex-col items-center p-2 rounded-lg transition-all"
                    style={{
                      background: isSelected ? fac.bg : "rgba(10,13,26,0.8)",
                      border: `2px solid ${isSelected ? fac.base : "#1a2040"}`,
                      boxShadow: isSelected ? `0 0 12px ${fac.glow}` : "none",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black mb-1"
                      style={{
                        background: `radial-gradient(ellipse, ${fac.bg} 0%, #0d0f1a 70%)`,
                        border: `2px solid ${fac.base}`,
                        color: fac.base,
                      }}
                    >
                      {hero.name[0]}
                    </div>
                    <span className="text-xs font-bold text-center" style={{ color: isSelected ? fac.base : "#6080a0" }}>
                      {hero.name}
                    </span>
                    <span className="text-xs text-center" style={{ color: "#304060", fontSize: 9 }}>
                      {hero.faction}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hero details */}
          {selectedHeroData && (
            <div
              className="p-4 rounded-lg"
              style={{
                background: "rgba(10,13,26,0.8)",
                border: `1px solid ${FACTION_COLORS[selectedHeroData.faction]?.base ?? "#2a3560"}`,
              }}
            >
              <div className="font-bold mb-1" style={{ color: FACTION_COLORS[selectedHeroData.faction]?.base ?? "#6080c0" }}>
                {selectedHeroData.name}
              </div>
              <p className="text-xs mb-3" style={{ color: "#6080a0", fontStyle: "italic" }}>
                {selectedHeroData.description}
              </p>
              <div
                className="p-2 rounded text-xs"
                style={{ background: "rgba(30,40,80,0.5)", border: "1px solid #2a3560" }}
              >
                <div className="font-bold mb-1" style={{ color: "#7b8cf4" }}>
                  ⚡ Hero Power: {selectedHeroData.hero_power.name} ({selectedHeroData.hero_power.cost} Gas)
                </div>
                <p style={{ color: "#8090b0" }}>{selectedHeroData.hero_power.description}</p>
              </div>
              <div className="mt-3 flex gap-3 text-xs" style={{ color: "#4060a0" }}>
                <span>❤️ {selectedHeroData.hp} HP</span>
                {selectedHeroData.armor > 0 && <span>🛡️ {selectedHeroData.armor} Armor</span>}
              </div>
            </div>
          )}
        </div>

        {/* Deck select */}
        <div className="mb-6">
          <h2 className="text-sm font-bold mb-3 uppercase tracking-widest" style={{ color: "#4060a0" }}>
            Deck
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {decks.map((deck) => {
              const isSelected = deck.id === selectedDeck;
              return (
                <div
                  key={deck.id}
                  onClick={() => setSelectedDeck(deck.id)}
                  className="cursor-pointer p-3 rounded-lg transition-all"
                  style={{
                    background: isSelected ? "rgba(30,60,100,0.4)" : "rgba(10,13,26,0.8)",
                    border: `2px solid ${isSelected ? "#4060ff" : "#1a2040"}`,
                    boxShadow: isSelected ? "0 0 10px rgba(64,96,255,0.3)" : "none",
                  }}
                >
                  <div className="font-bold text-sm mb-1" style={{ color: isSelected ? "#80a0ff" : "#6080a0" }}>
                    {deck.name}
                  </div>
                  <div className="text-xs flex items-center justify-between" style={{ color: "#304060" }}>
                    <span>{deck.cardCount} cards</span>
                    {deck.factionBonusActive && (
                      <span style={{ color: "#f7931a", fontSize: 8 }}>✦ FACTION</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mode select */}
        <div className="mb-6">
          <h2 className="text-sm font-bold mb-3 uppercase tracking-widest" style={{ color: "#4060a0" }}>
            Mode
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(MODE_INFO) as [GameMode, typeof MODE_INFO[GameMode]][]).map(([modeKey, info]) => {
              const isSelected = mode === modeKey;
              return (
                <div
                  key={modeKey}
                  onClick={() => setMode(modeKey)}
                  className="cursor-pointer p-3 rounded-lg transition-all"
                  style={{
                    background: isSelected ? `${info.color}22` : "rgba(10,13,26,0.8)",
                    border: `2px solid ${isSelected ? info.color : "#1a2040"}`,
                    boxShadow: isSelected ? `0 0 10px ${info.color}44` : "none",
                  }}
                >
                  <div className="font-bold text-sm mb-1" style={{ color: isSelected ? info.color : "#6080a0" }}>
                    {info.label}
                  </div>
                  <p className="text-xs" style={{ color: "#304060" }}>{info.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Play button */}
        <div className="text-center">
          {statusMsg && (
            <p className="text-sm mb-3" style={{ color: "#6080a0" }}>{statusMsg}</p>
          )}

          {!queueing ? (
            <button
              onClick={handlePlayClick}
              disabled={!selectedHero || !selectedDeck || !connected}
              className="px-12 py-3 rounded-xl font-black text-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #f7931a, #c46800)",
                border: "2px solid #f7931a",
                color: "#fff",
                boxShadow: "0 0 20px rgba(247,147,26,0.4)",
                cursor: selectedHero && selectedDeck && connected ? "pointer" : "not-allowed",
                opacity: selectedHero && selectedDeck && connected ? 1 : 0.5,
              }}
            >
              PLAY
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="text-sm" style={{ color: "#4060a0" }}>
                <span className="animate-pulse">⏳</span> {statusMsg}
              </div>
              <button
                onClick={handleCancelQueue}
                className="px-6 py-2 rounded font-bold text-sm"
                style={{ background: "rgba(100,40,40,0.4)", border: "1px solid #804040", color: "#ff6060" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
