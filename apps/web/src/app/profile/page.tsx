"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";

interface FactionMastery { faction: string; level: number; }
interface RecentMatch { opponent: string; won: boolean; mode: string; delta: number; endedAt: string | null; }
interface Profile {
  username: string; walletAddress: string | null; fragments: number;
  rankTier: string; rankStars: number; rankPoints: number;
  seasonWins: number; seasonLosses: number; winStreak: number; level: number;
  games: number; cardsOwned: number; legendaries: number; packsOpened: number; questsDone: number;
  factionMastery: FactionMastery[]; recentMatches: RecentMatch[];
}

const TIER_COLOR: Record<string, string> = { bronze: "#c8843c", silver: "#cfd6e0", gold: "#e7c768", platinum: "#7ad6ff", diamond: "#b58bff", degen: "#ff5fae" };
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const FACTION: Record<string, { name: string; color: string; glyph: string }> = {
  bitcoin: { name: "Bitcoin", color: "#f7931a", glyph: "₿" },
  meme: { name: "Meme", color: "#ff5fae", glyph: "🐸" },
  ethereum: { name: "Ethereum", color: "#7b8cf4", glyph: "Ξ" },
  stable: { name: "Stable", color: "#2bbd86", glyph: "$" },
  solana: { name: "Solana", color: "#19e08a", glyph: "◎" },
  degen: { name: "Degen", color: "#9aa3b2", glyph: "∞" },
};

export default function ProfilePage() {
  const { token, hasUsername, username, walletAddress, logout } = useAuthStore();
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => { if (token) api.get<Profile>("/api/economy/profile").then(setP).catch(() => {}); }, [token]);
  if (!token || !hasUsername) return <AuthModal />;

  const tier = p?.rankTier ?? "bronze";
  const tc = TIER_COLOR[tier] ?? "#e7c768";
  const stars = p?.rankStars ?? 0;
  const wins = p?.seasonWins ?? 0, losses = p?.seasonLosses ?? 0, games = wins + losses;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const wallet = walletAddress ?? p?.walletAddress ?? null;
  const mains = (p?.factionMastery ?? []).slice().sort((a, b) => b.level - a.level)[0];
  const mainsMeta = mains ? FACTION[mains.faction] : null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 26px", flexShrink: 0 }}>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 26px 16px" }}>
        {/* Banner */}
        <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 18, padding: 22, borderRadius: 18, background: `linear-gradient(110deg,color-mix(in srgb,${tc} 16%,transparent),rgba(18,23,35,.55) 60%)`, border: `1px solid ${tc}44` }}>
          <div style={{ position: "absolute", top: -40, right: 24, font: `900 170px/1 var(--font-cinzel,'Cinzel',serif)`, color: `${tc}14`, pointerEvents: "none" }}>{mainsMeta?.glyph ?? "₿"}</div>
          <div style={{ width: 74, height: 74, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,#243042,#12161f)", border: `2px solid ${tc}`, font: `900 32px var(--font-cinzel,'Cinzel',serif)`, color: tc, boxShadow: `0 0 22px ${tc}55` }}>
            {(username ?? "?")[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ font: `900 24px var(--font-cinzel,'Cinzel',serif)`, color: "#fff" }}>{username}</span>
              <span style={{ font: `800 10px var(--font-mono,'JetBrains Mono',monospace)`, color: tc, padding: "3px 8px", borderRadius: 6, background: `${tc}22`, border: `1px solid ${tc}55` }}>LVL {p?.level ?? 1}</span>
              {wallet && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#19e08a", padding: "3px 8px", borderRadius: 6, background: "rgba(25,224,138,.1)", border: "1px solid rgba(25,224,138,.3)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#19e08a" }} />{wallet.slice(0, 4)}…{wallet.slice(-2)} · WalletConnect
                </span>
              )}
            </div>
            <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 8 }}>
              Member since Genesis · {games} games played{mainsMeta ? <> · Mains <span style={{ color: mainsMeta.color }}>{mainsMeta.name}</span></> : null}
            </div>
          </div>
          <button onClick={logout} style={{ cursor: "pointer", padding: "9px 16px", borderRadius: 10, background: "rgba(255,90,90,.08)", border: "1px solid rgba(255,90,90,.3)", color: "#ff8a8a", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>Logout</button>
        </div>

        {/* Rank + stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
          {/* Rank panel */}
          <div style={{ gridRow: "span 2", borderRadius: 16, padding: 18, background: `linear-gradient(155deg,color-mix(in srgb,${tc} 12%,transparent),rgba(18,23,35,.6))`, border: `1px solid ${tc}44`, display: "flex", flexDirection: "column" }}>
            <div style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6" }}>CURRENT RANK</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
              <div style={{ font: `900 30px/1 var(--font-cinzel,'Cinzel',serif)`, color: tc, textTransform: "uppercase" }}>{tier} {ROMAN[Math.max(1, 5 - stars)] ?? ""}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ font: `900 22px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc" }}>{(p?.rankPoints ?? 0).toLocaleString()}</div>
                <div style={{ font: `600 8px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 3 }}>LADDER PTS</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ width: 15, height: 15, transform: "rotate(45deg)", borderRadius: 3, background: i < stars ? `linear-gradient(135deg,${tc},${tc}99)` : "rgba(255,255,255,.07)", boxShadow: i < stars ? `0 0 6px ${tc}88` : "none" }} />
              ))}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", justifyContent: "space-between", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>
              <span>Season high</span><span style={{ color: "#cdd4df" }}>{tier.toUpperCase()}</span>
            </div>
          </div>

          <Stat value={games} label="Games played" />
          <Stat value={`${winrate}%`} label="Win rate" color="#19e08a" />
          <Stat value={p?.winStreak ?? 0} label="Current streak" color="#f7931a" />
          <Stat value={p?.cardsOwned ?? 0} label="Cards owned" color="#7ad6ff" />
          <Stat value={p?.legendaries ?? 0} label="Legendaries" color="#e7c768" />
          <Stat value={p?.packsOpened ?? 0} label="Packs opened" />
          <Stat value={p?.questsDone ?? 0} label="Quests done" color="#b58bff" />
        </div>

        {/* Faction mastery + recent matches */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
          <Panel>
            <PanelTitle>Faction Mastery</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {(p?.factionMastery ?? []).slice().sort((a, b) => b.level - a.level).map((f) => {
                const m = FACTION[f.faction] ?? FACTION.degen;
                const pct = Math.round((f.level / 20) * 100);
                return (
                  <div key={f.faction} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${m.color}1f`, border: `1px solid ${m.color}55`, color: m.color, fontSize: 14 }}>{m.glyph}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", font: `700 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3", marginBottom: 5 }}>
                        <span>{m.name}</span><span style={{ color: "#8a93a6" }}>Lvl {f.level}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${m.color},color-mix(in srgb,${m.color} 60%,#fff))` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Recent Matches</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {(p?.recentMatches ?? []).length === 0 && (
                <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", textAlign: "center", padding: "20px 0" }}>No matches yet. Jump into a game!</div>
              )}
              {(p?.recentMatches ?? []).map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.05)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: m.won ? "#19e08a" : "#ff8a8a", background: m.won ? "rgba(25,224,138,.12)" : "rgba(255,90,90,.12)", border: `1px solid ${m.won ? "rgba(25,224,138,.35)" : "rgba(255,90,90,.35)"}` }}>{m.won ? "W" : "L"}</div>
                  <span style={{ flex: 1, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3" }}>vs {m.opponent}</span>
                  <span style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", textTransform: "capitalize" }}>{m.mode}</span>
                  <span style={{ font: `800 12px var(--font-mono,'JetBrains Mono',monospace)`, color: m.delta >= 0 ? "#19e08a" : "#ff8a8a", minWidth: 36, textAlign: "right" }}>{m.delta >= 0 ? "+" : ""}{m.delta}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ borderRadius: 14, padding: 16, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ font: `900 24px var(--font-mono,'JetBrains Mono',monospace)`, color: color ?? "#f3e8cc" }}>{value}</div>
      <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: ".5px", marginTop: 6 }}>{label}</div>
    </div>
  );
}
function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ borderRadius: 16, padding: 18, background: "linear-gradient(150deg,rgba(255,255,255,.04),rgba(18,23,35,.6))", border: "1px solid rgba(255,255,255,.08)" }}>{children}</div>;
}
function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>{children}</div>;
}

const backBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
