"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getSocket } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";

import { FACTION_NAME, factionColor, factionDisplayName } from "@/lib/factions";
import { formatRankTier } from "@/lib/brand";
import FactionIcon from "@/components/Faction/FactionIcon";
import { preloadFactionArt } from "@/lib/preloadArt";

// Faction bonuses are granted by the HERO's faction (not the deck).
const HERO_FACTION_BONUS: Record<string, string> = {
  bitcoin: "Start with +5 Armor",
  meme: "Each turn: coin flip — extra card or free Hero Power",
};

interface Hero {
  id: string; name: string; faction: string; description: string;
  hp: number; armor: number;
  hero_power: { name: string; cost: number; description: string };
}
interface Deck { id: string; name: string; heroId: string; isStarter?: boolean; faction?: string; factionBonusActive: boolean; cardCount: number; cards: { cardId: string; quantity: number }[]; }
type GameMode = "practice" | "casual" | "ranked";

const MODE_LABEL: Record<GameMode, string> = { practice: "PRACTICE", casual: "CASUAL", ranked: "RANKED" };

const TIPS = [
  "Swapping high-cost cards in your mulligan for a smoother early curve is usually correct.",
  "Taunt minions force the enemy to deal with them first — use them to protect your hero.",
  "Holding removal for a key threat beats spending it on the first minion you see.",
  "Faction decks gain a passive bonus — keep your deck mono-faction to activate it.",
];

export default function HeroSelect() {
  const router = useRouter();
  const search = useSearchParams();
  const mode = (search.get("mode") as GameMode) ?? "practice";

  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [costMap, setCostMap] = useState<Record<string, number>>({});
  const [selectedHero, setSelectedHero] = useState<string>("");
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [queueing, setQueueing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [tier, setTier] = useState<{ rankTier: string; rankStars: number }>({ rankTier: "gold", rankStars: 2 });
  const { connected } = useGameStore();

  useEffect(() => {
    preloadFactionArt();
    (async () => {
      const [heroList, deckList, cardList] = await Promise.all([
        api.get<Hero[]>("/api/heroes"),
        api.get<Deck[]>("/api/decks"),
        api.get<{ id: string; cost: number }[]>("/api/cards?collectible=false"),
      ]);
      setHeroes(heroList);
      setDecks(deckList);
      setCostMap(Object.fromEntries(cardList.map((c) => [c.id, c.cost])));
      // Ranked requires a custom (non-starter) deck — prefer one if available.
      const preferred = mode === "ranked" ? deckList.find((d) => !d.isStarter) : deckList[0];
      if (preferred) { setSelectedDeck(preferred.id); setSelectedHero(preferred.heroId); }
      else if (heroList[0]) setSelectedHero(heroList[0].id);
    })();
    api.get<{ rankTier: string; rankStars: number }>("/api/economy/profile").then(setTier).catch(() => {});
  }, []);

  function manaCurve(deck: Deck): number[] {
    const buckets = new Array(8).fill(0);
    for (const { cardId, quantity } of deck.cards ?? []) {
      const cost = Math.min(7, costMap[cardId] ?? 0);
      buckets[cost] += quantity;
    }
    return buckets;
  }

  function handleFindMatch() {
    if (!selectedHero || !selectedDeck || !connected) return;
    const socket = getSocket();
    if (!socket) return;
    setQueueing(true);
    setStatusMsg(mode === "practice" ? "Starting practice game..." : "Finding a worthy opponent");
    socket.emit("queue:join", { mode, deckId: selectedDeck, heroId: selectedHero });
    socket.once("game:error", (msg) => { setStatusMsg(`Error: ${msg}`); setQueueing(false); });
  }

  function handleCancelQueue() {
    getSocket()?.emit("queue:leave");
    setQueueing(false);
    setStatusMsg("");
  }

  const SH = heroes.find((h) => h.id === selectedHero);
  const sfc = SH ? factionColor(SH.faction) : "#9aa3b2";

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)", overflow: "auto" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 80% -10%,rgba(247,147,26,.07),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.07),transparent 55%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 30px" }}>
        <button onClick={() => router.push("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>‹ Back</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Battle Setup</div>
        <div style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(247,147,26,.1)", border: "1px solid rgba(247,147,26,.35)", color: "#ffce85", font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px" }}>
          {MODE_LABEL[mode]} · {formatRankTier(tier.rankTier)} {["", "I", "II", "III", "IV", "V"][Math.max(1, 5 - tier.rankStars)]}
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 26, padding: "8px 30px 30px", flex: 1 }}>

        {/* LEFT — heroes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6" }}>CHOOSE YOUR HERO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {heroes.map((h) => {
              const fc = factionColor(h.faction);
              const active = h.id === selectedHero;
              return (
                <div key={h.id} onClick={() => setSelectedHero(h.id)} style={{ cursor: "pointer", padding: "16px 6px 12px", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", background: active ? `linear-gradient(160deg,color-mix(in srgb,${fc} 20%,transparent),rgba(20,26,42,.6))` : "rgba(255,255,255,.03)", border: `1.5px solid ${active ? fc : "rgba(255,255,255,.08)"}`, boxShadow: active ? `0 0 22px color-mix(in srgb,${fc} 40%,transparent)` : "none", transform: active ? "translateY(-3px)" : "none", transition: "all .15s ease" }}>
                  <FactionIcon faction={h.faction} size={52} />
                  <div style={{ font: `700 11px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9", marginTop: 9, textAlign: "center" }}>{h.name}</div>
                  <div style={{ font: `700 7.5px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: fc, marginTop: 5 }}>{factionDisplayName(h.faction)}</div>
                </div>
              );
            })}
          </div>

          {SH && (
            <div style={{ borderRadius: 16, padding: 24, background: "linear-gradient(150deg,rgba(255,255,255,.04),rgba(20,26,42,.5))", border: `1px solid ${sfc}44`, display: "flex", gap: 22, boxShadow: `0 0 30px ${sfc}22` }}>
              <FactionIcon faction={SH.faction} size={84} glow />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ font: `900 24px var(--font-cinzel,'Cinzel',serif)`, color: "#fff" }}>{SH.name}</span>
                  <span style={{ padding: "3px 9px", borderRadius: 6, font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: sfc, background: `color-mix(in srgb,${sfc} 16%,transparent)`, border: `1px solid color-mix(in srgb,${sfc} 40%,transparent)` }}>{factionDisplayName(SH.faction)}</span>
                </div>
                <div style={{ font: `500 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>{SH.description}</div>
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 38% 30%,#dcefff,#4a90e6 55%,#1f4f9e)", boxShadow: "0 0 0 2px #d6b052, 0 0 14px rgba(74,144,230,.5)", font: `800 21px var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff" }}>{SH.hero_power.cost}</div>
                  <div>
                    <div style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Hero Power · {SH.hero_power.name}</div>
                    <div style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 3 }}>{SH.hero_power.description}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — decks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6" }}>SELECT DECK</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            {decks.map((d) => {
              const active = d.id === selectedDeck;
              const rankedLocked = mode === "ranked" && d.isStarter;
              const incomplete = d.cardCount !== 30;
              const locked = rankedLocked || incomplete;
              const hero = heroes.find((h) => h.id === d.heroId);
              const fc = hero ? factionColor(hero.faction) : factionColor(d.faction ?? "degen");
              const curve = manaCurve(d);
              const maxBar = Math.max(1, ...curve);
              const sublabel = rankedLocked
                ? "Not allowed in Ranked"
                : incomplete
                ? `Incomplete · ${d.cardCount}/30 cards`
                : `${hero?.name ?? "Unknown"} · ${d.cardCount} cards`;
              const borderColor = active ? fc : incomplete ? "rgba(202,162,74,.35)" : "rgba(255,255,255,.08)";
              return (
                <div key={d.id} onClick={() => { if (rankedLocked) return; setSelectedDeck(d.id); setSelectedHero(d.heroId); }} style={{ cursor: rankedLocked ? "not-allowed" : "pointer", opacity: rankedLocked ? 0.45 : 1, padding: 15, borderRadius: 13, background: active ? `linear-gradient(150deg,color-mix(in srgb,${fc} 16%,transparent),rgba(20,26,42,.5))` : "rgba(255,255,255,.03)", border: `1.5px solid ${borderColor}`, boxShadow: active ? `0 0 20px ${fc}33` : "none", transition: "all .15s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {hero ? <FactionIcon faction={hero.faction} size={32} /> : <span style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 14 }}>?</span>}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{d.name}</span>
                        {d.isStarter && <span style={{ font: `700 7px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", padding: "2px 6px", borderRadius: 5, color: "#caa24a", background: "rgba(231,199,104,.12)", border: "1px solid rgba(231,199,104,.3)" }}>STARTER</span>}
                        {incomplete && !d.isStarter && <span style={{ font: `700 7px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", padding: "2px 6px", borderRadius: 5, color: "#caa24a", background: "rgba(202,162,74,.12)", border: "1px solid rgba(202,162,74,.3)" }}>INCOMPLETE</span>}
                      </div>
                      <div style={{ font: `600 9.5px var(--font-mono,'JetBrains Mono',monospace)`, color: locked ? "#caa24a" : "#8a93a6", marginTop: 3 }}>{sublabel}</div>
                    </div>
                    {active && <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: fc, color: "#15101a", fontSize: 11, fontWeight: 800 }}>✓</div>}
                  </div>
                  {/* Mana curve */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 36, marginTop: 12 }}>
                    {curve.map((v, i) => (
                      <div key={i} style={{ flex: 1, height: `${(v / maxBar) * 100}%`, minHeight: 3, borderRadius: 2, background: `linear-gradient(180deg,${fc},${fc}66)`, opacity: v === 0 ? 0.18 : 1 }} title={`${i}${i === 7 ? "+" : ""} cost: ${v}`} />
                    ))}
                  </div>
                </div>
              );
            })}
            {decks.length === 0 && (
              <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)", color: "#6a7488", textAlign: "center", font: `500 12px var(--font-archivo,'Archivo',sans-serif)` }}>No decks found.</div>
            )}
          </div>

          {mode === "ranked" && decks.length > 0 && !decks.some((d) => !d.isStarter) && (
            <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,90,90,.07)", border: "1px solid rgba(255,90,90,.28)", textAlign: "center" }}>
              <div style={{ font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff9a8a" }}>Ranked needs your own custom deck</div>
              <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 4 }}>Build one from cards you own in the Collection.</div>
              <button onClick={() => router.push("/collection")} style={{ marginTop: 10, cursor: "pointer", padding: "8px 16px", borderRadius: 9, border: "none", color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", font: `800 11px var(--font-cinzel,'Cinzel',serif)` }}>Build a Deck ›</button>
            </div>
          )}

          {(() => {
            const sd = decks.find((x) => x.id === selectedDeck);
            const rankedBlocked = mode === "ranked" && (!sd || sd.isStarter);
            const incomplete = !sd || sd.cardCount !== 30;
            const ready = !!selectedHero && !!selectedDeck && connected && !rankedBlocked && !incomplete;
            return (
              <>
                <button onClick={handleFindMatch} disabled={!ready} style={{ cursor: ready ? "pointer" : "not-allowed", border: "none", padding: "16px", borderRadius: 13, font: `900 17px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px", color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 10px 24px rgba(224,137,15,.4), inset 0 1px 0 rgba(255,255,255,.5)", opacity: ready ? 1 : 0.5 }}>
                  FIND MATCH ›
                </button>
                {sd && incomplete && (
                  <div style={{ textAlign: "center", font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#caa24a" }}>
                    Deck needs 30 cards to play ({sd.cardCount}/30)
                  </div>
                )}
              </>
            );
          })()}
          {(() => {
            const d = decks.find((x) => x.id === selectedDeck);
            const hero = heroes.find((h) => h.id === d?.heroId);
            if (!hero) return null;
            const bonus = HERO_FACTION_BONUS[hero.faction];
            if (!bonus) return null;
            return (
              <div style={{ textAlign: "center", font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: factionColor(hero.faction) }}>
                {factionDisplayName(hero.faction)} Hero · {bonus}
              </div>
            );
          })()}
        </div>
      </div>

      {queueing && <FindingOpponent mode={mode} tier={tier} hero={SH} sfc={sfc} onCancel={handleCancelQueue} statusMsg={statusMsg} />}

      <style>{`@keyframes spinRing { to { transform: rotate(360deg); } } @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 22px var(--g); } 50% { box-shadow: 0 0 42px var(--g); } }`}</style>
    </div>
  );
}

function FindingOpponent({ mode, tier, hero, sfc, onCancel, statusMsg }: { mode: GameMode; tier: { rankTier: string; rankStars: number }; hero?: Hero; sfc: string; onCancel: () => void; statusMsg: string }) {
  const [secs, setSecs] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  useEffect(() => { const id = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(id); }, []);
  const mm = String(Math.floor(secs / 60)).padStart(1, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(120% 90% at 50% 40%,#0d1422 0%,#070a12 70%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(70% 60% at 50% 45%,#000,transparent)" }} />

      <div style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "4px", color: "#f7931a", marginBottom: 40, zIndex: 1 }}>
        {MODE_LABEL[mode]} · {formatRankTier(tier.rankTier)} {["", "I", "II", "III", "IV", "V"][Math.max(1, 5 - tier.rankStars)]}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 44, zIndex: 1 }}>
        {/* You */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ ["--g" as string]: `${sfc}66`, animation: "pulseGlow 2s ease-in-out infinite" }}>
            {hero ? <FactionIcon faction={hero.faction} size={130} glow /> : <span style={{ width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 48 }}>?</span>}
          </div>
          <div style={{ font: `900 18px var(--font-cinzel,'Cinzel',serif)`, color: "#fff" }}>{hero?.name ?? "You"}</div>
          <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px" }}>YOU</div>
        </div>

        {/* VS / timer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(247,147,26,.5)", borderTopColor: "#f7931a", animation: "spinRing 1.4s linear infinite" }}>
            <span style={{ font: `900 20px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>VS</span>
          </div>
          <div style={{ font: `800 16px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a" }}>{mm}:{ss}</div>
        </div>

        {/* Opponent */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 130, height: 130, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.02)", border: "3px dashed rgba(255,255,255,.18)", font: `900 56px var(--font-cinzel,'Cinzel',serif)`, color: "rgba(255,255,255,.25)" }}>?</div>
          <div style={{ font: `900 18px var(--font-cinzel,'Cinzel',serif)`, color: "#6a7488" }}>Searching…</div>
          <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#566072", letterSpacing: "1px" }}>OPPONENT</div>
        </div>
      </div>

      <div style={{ font: `900 24px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", margin: "44px 0 18px", zIndex: 1 }}>{statusMsg || "Finding a worthy opponent"}</div>

      <div style={{ maxWidth: 460, padding: "14px 20px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", zIndex: 1 }}>
        <span style={{ font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a", marginRight: 8 }}>TIP</span>
        <span style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", lineHeight: 1.5 }}>{tip}</span>
      </div>

      <button onClick={onCancel} style={{ cursor: "pointer", marginTop: 30, padding: "11px 26px", borderRadius: 10, border: "1px solid rgba(255,90,90,.4)", background: "rgba(255,90,90,.08)", color: "#ff8a8a", font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, zIndex: 1 }}>Cancel ✕</button>
    </div>
  );
}
