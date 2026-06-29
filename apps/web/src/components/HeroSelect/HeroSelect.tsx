"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";

const FAC: Record<string, string> = {
  bitcoin: "#f7931a", ethereum: "#7b8cf4", solana: "#19e08a",
  meme: "#ff5fae", stable: "#2bbd86", degen: "#9aa3b2",
};
const GLYPH: Record<string, string> = {
  bitcoin: "₿", ethereum: "Ξ", solana: "◎", meme: "🐸", stable: "$", degen: "∞",
};
const FACTION_NAME: Record<string, string> = {
  bitcoin: "BITCOIN", ethereum: "ETHEREUM", solana: "SOLANA", meme: "MEME", stable: "STABLE", degen: "DEGEN",
};

interface Hero {
  id: string; name: string; faction: string; description: string;
  hp: number; armor: number;
  hero_power: { name: string; cost: number; description: string };
}
interface Deck { id: string; name: string; heroId: string; factionBonusActive: boolean; cardCount: number; }
type GameMode = "practice" | "casual" | "ranked";

const MODES: { key: GameMode; name: string; tag: string; desc: string; fac: string; primary?: boolean }[] = [
  { key: "practice", name: "Practice", tag: "FREE · VS AI", desc: "Learn the ropes against bots. No rewards.", fac: "#9aa3b2" },
  { key: "casual", name: "Casual", tag: "FREE · VS PLAYERS", desc: "No stakes. Earn booster pack tickets.", fac: "#7b8cf4" },
  { key: "ranked", name: "Ranked", tag: "HOLD 1,000 $DEGEN", desc: "Climb the ladder. Earn fragments & season rewards.", fac: "#f7931a", primary: true },
];

export default function HeroSelect() {
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedHero, setSelectedHero] = useState<string>("");
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [mode, setMode] = useState<GameMode>("practice");
  const [queueing, setQueueing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const { connected } = useGameStore();

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
    socket.once("game:error", (msg) => { setStatusMsg(`Error: ${msg}`); setQueueing(false); });
  }

  function handleCancelQueue() {
    getSocket()?.emit("queue:leave");
    setQueueing(false);
    setStatusMsg("");
  }

  const SH = heroes.find((h) => h.id === selectedHero);
  const sfc = SH ? (FAC[SH.faction] ?? FAC.degen) : "#9aa3b2";

  return (
    <div style={{
      minHeight: "100%", display: "flex", flexDirection: "column",
      background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)",
      fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
      position: "relative", overflow: "auto",
    }}>
      {/* Subtle grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 80% -10%,rgba(247,147,26,.07),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.07),transparent 55%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 30px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,#f7c64a,#c2860f)", boxShadow: "0 0 16px rgba(231,199,104,.45)", font: `900 20px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#2a1a00" }}>D</div>
          <div>
            <div style={{ font: `900 19px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>DEGEN TCG</div>
            <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a", letterSpacing: "2px", marginTop: 3 }}>GENESIS · SEASON 1</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: "6px 12px", borderRadius: 9, background: connected ? "rgba(25,224,138,.08)" : "rgba(255,50,50,.08)", border: `1px solid ${connected ? "rgba(25,224,138,.3)" : "rgba(255,50,50,.3)"}`, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#19e08a" : "#ff5555", boxShadow: connected ? "0 0 8px #19e08a" : "none" }} />
            <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: connected ? "#7fe8bd" : "#ff8888" }}>
              {connected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Main grid: Left hero select + Center play + Right decks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px 320px", gap: 22, padding: "24px 30px", flex: 1 }}>

        {/* LEFT — Hero select */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6", marginBottom: 2 }}>CHOOSE YOUR HERO</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {heroes.map((h) => {
              const fc = FAC[h.faction] ?? FAC.degen;
              const active = h.id === selectedHero;
              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHero(h.id)}
                  style={{
                    cursor: "pointer", padding: "14px 8px 12px", borderRadius: 14,
                    display: "flex", flexDirection: "column", alignItems: "center",
                    background: active ? `linear-gradient(160deg,color-mix(in srgb,${fc} 20%,transparent),rgba(20,26,42,.6))` : "rgba(255,255,255,.03)",
                    border: `1.5px solid ${active ? fc : "rgba(255,255,255,.08)"}`,
                    boxShadow: active ? `0 0 22px color-mix(in srgb,${fc} 40%,transparent)` : "none",
                    transform: active ? "translateY(-3px)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `radial-gradient(circle at 40% 30%,color-mix(in srgb,${fc} 30%,#2a2030),#15101a)`,
                    border: `2px solid ${fc}`,
                    font: `900 26px var(--font-cinzel,'Cinzel',serif)`, color: "#fff",
                  }}>
                    {GLYPH[h.faction] ?? h.name[0]}
                  </div>
                  <div style={{ font: `700 12px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9", marginTop: 9, textAlign: "center" }}>{h.name}</div>
                  <div style={{ font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: fc, marginTop: 5 }}>{FACTION_NAME[h.faction] ?? h.faction.toUpperCase()}</div>
                </div>
              );
            })}
          </div>

          {/* Selected hero detail */}
          {SH && (
            <div style={{ borderRadius: 16, padding: 24, background: "linear-gradient(150deg,rgba(255,255,255,.04),rgba(20,26,42,.5))", border: "1px solid rgba(255,255,255,.08)", display: "flex", gap: 22 }}>
              <div style={{
                width: 80, height: 80, flexShrink: 0, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `radial-gradient(circle at 40% 30%,color-mix(in srgb,${sfc} 32%,#2a2030),#140f1a)`,
                border: `3px solid ${sfc}`,
                boxShadow: `0 0 28px color-mix(in srgb,${sfc} 45%,transparent)`,
                font: `900 36px var(--font-cinzel,'Cinzel',serif)`, color: "#fff",
              }}>
                {GLYPH[SH.faction] ?? SH.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ font: `900 24px var(--font-cinzel,'Cinzel',serif)`, color: "#fff" }}>{SH.name}</span>
                  <span style={{ padding: "3px 9px", borderRadius: 6, font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: sfc, background: `color-mix(in srgb,${sfc} 16%,transparent)`, border: `1px solid color-mix(in srgb,${sfc} 40%,transparent)` }}>
                    {FACTION_NAME[SH.faction] ?? SH.faction.toUpperCase()}
                  </span>
                </div>
                <div style={{ font: `500 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>{SH.description}</div>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <div style={{
                    position: "relative", width: 54, height: 54, flexShrink: 0,
                    borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "radial-gradient(circle at 38% 30%,#dcefff,#4a90e6 55%,#1f4f9e)",
                    boxShadow: "0 0 0 2px #d6b052, 0 0 14px rgba(74,144,230,.5)",
                  }}>
                    <span style={{ font: `800 22px var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff" }}>{SH.hero_power.cost}</span>
                  </div>
                  <div>
                    <div style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Hero Power · {SH.hero_power.name}</div>
                    <div style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 3 }}>{SH.hero_power.description}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER — Mode select + Play button */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Play banner */}
          <div style={{
            position: "relative", borderRadius: 18, overflow: "hidden", padding: "28px 30px",
            minHeight: 160, display: "flex", flexDirection: "column", justifyContent: "flex-end",
            background: "linear-gradient(110deg,rgba(247,147,26,.22),rgba(20,26,42,.4) 60%)",
            border: "1px solid rgba(247,147,26,.3)",
          }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 44px)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: -30, right: -10, font: `900 140px var(--font-cinzel,'Cinzel',serif)`, color: "rgba(247,147,26,.1)", lineHeight: 1 }}>₿</div>
            <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: "#ffd187" }}>RANKED LADDER · LIVE</div>
            <div style={{ font: `900 30px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#fff", margin: "8px 0 14px" }}>Climb to Degen Rank</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {!queueing ? (
                <button
                  onClick={handlePlayClick}
                  disabled={!selectedHero || !selectedDeck || !connected}
                  style={{
                    cursor: selectedHero && selectedDeck && connected ? "pointer" : "not-allowed",
                    border: "none", padding: "14px 36px", borderRadius: 12,
                    font: `800 16px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px",
                    color: "#2a1a00",
                    background: "linear-gradient(180deg,#ffe07a,#e0890f)",
                    boxShadow: "0 8px 20px rgba(224,137,15,.4), inset 0 1px 0 rgba(255,255,255,.5)",
                    opacity: selectedHero && selectedDeck && connected ? 1 : 0.5,
                  }}
                >
                  ▶  PLAY
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", border: "3px solid rgba(247,147,26,.2)", borderTopColor: "#f7931a", animation: "spinRing 1s linear infinite", flexShrink: 0 }} />
                    <span style={{ font: `700 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>{statusMsg}</span>
                  </div>
                  <button
                    onClick={handleCancelQueue}
                    style={{ cursor: "pointer", border: "1px solid rgba(255,90,90,.4)", background: "rgba(255,90,90,.08)", color: "#ff8a8a", padding: "10px 24px", borderRadius: 10, font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}
                  >
                    Cancel ✕
                  </button>
                </div>
              )}
              {!queueing && <span style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#c9b48a" }}>Pick a mode below</span>}
            </div>
          </div>

          {/* Mode cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <div
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  style={{
                    cursor: "pointer", borderRadius: 14, padding: "16px",
                    background: active ? `linear-gradient(150deg,color-mix(in srgb,${m.fac} 16%,transparent),rgba(20,26,42,.5))` : "rgba(255,255,255,.03)",
                    border: `1px solid ${active ? m.fac : "rgba(255,255,255,.08)"}`,
                    boxShadow: active ? `0 10px 24px rgba(0,0,0,.35)` : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{m.name}</span>
                    <span style={{
                      font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px",
                      padding: "4px 9px", borderRadius: 6,
                      color: m.fac, background: `color-mix(in srgb,${m.fac} 16%,transparent)`,
                      border: `1px solid color-mix(in srgb,${m.fac} 40%,transparent)`,
                    }}>
                      {active ? "SELECTED" : "OPEN"}
                    </span>
                  </div>
                  <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 7, letterSpacing: ".5px" }}>{m.tag}</div>
                  <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 8, lineHeight: 1.4 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Deck select */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6", marginBottom: 2 }}>SELECT DECK</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {decks.map((d) => {
              const active = d.id === selectedDeck;
              const hero = heroes.find((h) => h.id === d.heroId);
              const fc = hero ? (FAC[hero.faction] ?? FAC.degen) : "#9aa3b2";
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDeck(d.id)}
                  style={{
                    cursor: "pointer", padding: 15, borderRadius: 13,
                    background: active ? `linear-gradient(150deg,color-mix(in srgb,${fc} 16%,transparent),rgba(20,26,42,.5))` : "rgba(255,255,255,.03)",
                    border: `1.5px solid ${active ? fc : "rgba(255,255,255,.08)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, flexShrink: 0, borderRadius: 9,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `radial-gradient(circle at 40% 30%,color-mix(in srgb,${fc} 35%,#2a2030),#15101a)`,
                      border: `2px solid ${fc}`,
                      font: `900 16px var(--font-cinzel,'Cinzel',serif)`, color: "#fff",
                    }}>
                      {hero ? (GLYPH[hero.faction] ?? hero.name[0]) : "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: `800 15px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{d.name}</div>
                      <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 2 }}>
                        {hero?.name ?? "Unknown"} · {d.cardCount} cards
                      </div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      font: "12px sans-serif", color: "#2a1a00",
                      background: active ? fc : "transparent",
                      border: active ? "none" : "1.5px solid rgba(255,255,255,.18)",
                      opacity: active ? 1 : 0.4,
                    }}>
                      {active ? "✓" : ""}
                    </div>
                  </div>
                  {d.factionBonusActive && (
                    <div style={{ marginTop: 8, font: `600 10px var(--font-archivo,'Archivo',sans-serif)`, color: fc }}>
                      ✦ Faction Bonus active
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {decks.length === 0 && (
            <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)", color: "#6a7488", textAlign: "center", font: `500 12px var(--font-archivo,'Archivo',sans-serif)` }}>
              No decks found. The database may not be seeded yet.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spinRing { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
