"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import { FACTION_LABEL, factionColor, factionImageUrl } from "@/lib/factions";
import { formatRankTier } from "@/lib/brand";
import FactionIcon from "@/components/Faction/FactionIcon";
import BottomNav from "@/components/Dashboard/BottomNav";
import MusicSettings from "@/components/Music/MusicSettings";
import { useIsMobile } from "@/hooks/useViewport";

interface FactionMastery { faction: string; level: number; }
interface RecentMatch { opponent: string; won: boolean; mode: string; delta: number; endedAt: string | null; }
interface ModeRecord { wins: number; losses: number; }
interface Profile {
  username: string; walletAddress: string | null; fragments: number;
  rankTier: string; rankStars: number; rankPoints: number;
  seasonWins: number; seasonLosses: number; winStreak: number; level: number;
  games: number; cardsOwned: number; legendaries: number; packsOpened: number; questsDone: number;
  modeStats?: { ranked: ModeRecord; casual: ModeRecord; practice: ModeRecord };
  factionMastery: FactionMastery[]; recentMatches: RecentMatch[];
}

const TIER_COLOR: Record<string, string> = { bronze: "#c8843c", silver: "#cfd6e0", gold: "#e7c768", platinum: "#7ad6ff", diamond: "#b58bff", degen: "#ff5fae" };
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const RANK_TIERS = ["bronze", "silver", "gold", "platinum", "diamond", "degen"] as const;
const TIER_FLOORS: Record<string, number> = { bronze: 0, silver: 500, gold: 1000, platinum: 1500, diamond: 2000, degen: 2500 };

export default function ProfilePage() {
  const { token, hasUsername, username, walletAddress, logout } = useAuthStore();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => { if (token) api.get<Profile>("/api/economy/profile").then(setP).catch(() => {}); }, [token]);
  if (!token || !hasUsername) return <AuthModal />;

  const tier = p?.rankTier ?? "bronze";
  const tc = TIER_COLOR[tier] ?? "#e7c768";
  const stars = p?.rankStars ?? 0;
  const ranked = p?.modeStats?.ranked ?? { wins: 0, losses: 0 };
  const casual = p?.modeStats?.casual ?? { wins: 0, losses: 0 };
  const wins = ranked.wins + casual.wins, losses = ranked.losses + casual.losses, games = wins + losses;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const rankedGames = ranked.wins + ranked.losses;
  const casualGames = casual.wins + casual.losses;
  // Progress toward the next division (each tier = 5 divisions of 100 pts).
  const rankPoints = p?.rankPoints ?? 0;
  const tierFloor = TIER_FLOORS[tier] ?? 0;
  const nextTier = RANK_TIERS[Math.min(RANK_TIERS.length - 1, RANK_TIERS.indexOf(tier as typeof RANK_TIERS[number]) + 1)] ?? "degen";
  const progressPct = Math.min(100, Math.max(0, Math.round((((rankPoints - tierFloor) % 100) + 100) % 100)));
  const nextDivisionLabel = stars < 4
    ? `${formatRankTier(tier)} ${ROMAN[5 - (stars + 1)] ?? ""}`
    : `${formatRankTier(nextTier)} V`;
  const wallet = walletAddress ?? p?.walletAddress ?? null;
  const mains = (p?.factionMastery ?? []).slice().sort((a, b) => b.level - a.level)[0];
  const mainsFaction = mains?.faction ?? "bitcoin";
  const mainsColor = factionColor(mainsFaction);
  const mainsName = FACTION_LABEL[mainsFaction as keyof typeof FACTION_LABEL] ?? "Bitcoin";

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 26px", flexShrink: 0 }}>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "0 12px 16px" : "0 26px 16px" }}>
        {/* Banner */}
        <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 18, padding: 22, borderRadius: 18, background: `linear-gradient(110deg,color-mix(in srgb,${tc} 16%,transparent),rgba(18,23,35,.55) 60%)`, border: `1px solid ${tc}44` }}>
          <img
            src={factionImageUrl(mainsFaction)}
            alt=""
            draggable={false}
            style={{ position: "absolute", top: -20, right: 24, width: 180, height: 180, objectFit: "contain", opacity: 0.08, pointerEvents: "none" }}
          />
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
              Member since Genesis · {games} games played{mains ? <> · Mains <span style={{ color: mainsColor }}>{mainsName}</span></> : null}
            </div>
          </div>
          <button onClick={logout} style={{ cursor: "pointer", padding: "9px 16px", borderRadius: 10, background: "rgba(255,90,90,.08)", border: "1px solid rgba(255,90,90,.3)", color: "#ff8a8a", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>Logout</button>
        </div>

        {/* Rank + stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
          {/* Rank panel */}
          <div style={{ gridRow: isMobile ? undefined : "span 2", gridColumn: isMobile ? "1 / -1" : undefined, borderRadius: 16, padding: 18, background: `linear-gradient(155deg,color-mix(in srgb,${tc} 12%,transparent),rgba(18,23,35,.6))`, border: `1px solid ${tc}44`, display: "flex", flexDirection: "column" }}>
            <div style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6" }}>CURRENT RANK</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
              <div style={{ font: `900 30px/1 var(--font-cinzel,'Cinzel',serif)`, color: tc, textTransform: "uppercase" }}>{formatRankTier(tier)} {ROMAN[Math.max(1, 5 - stars)] ?? ""}</div>
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
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", font: `600 9.5px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginBottom: 6 }}>
                <span>Progress to {nextDivisionLabel}</span><span>{progressPct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${tc},#f7c64a)`, boxShadow: `0 0 8px ${tc}88` }} />
              </div>
            </div>
            <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", justifyContent: "space-between", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>
              <span>Season high</span><span style={{ color: "#cdd4df" }}>{formatRankTier(tier).toUpperCase()}</span>
            </div>
          </div>

          <Stat
            value={`${ranked.wins}–${ranked.losses}`}
            label={`Ranked${rankedGames ? ` · ${Math.round((ranked.wins / rankedGames) * 100)}%` : ""}`}
            color="#e7c768"
          />
          <Stat
            value={`${casual.wins}–${casual.losses}`}
            label={`Casual${casualGames ? ` · ${Math.round((casual.wins / casualGames) * 100)}%` : ""}`}
            color="#7ad6ff"
          />
          <Stat value={`${winrate}%`} label={`Win rate · ${games} games`} color="#19e08a" />
          <Stat value={p?.winStreak ?? 0} label="Current streak" color="#f7931a" />
          <Stat value={p?.cardsOwned ?? 0} label="Cards owned" color="#7ad6ff" />
          <Stat value={p?.legendaries ?? 0} label="Legendaries" color="#e7c768" />
          <Stat value={p?.packsOpened ?? 0} label="Packs opened" />
          <Stat value={p?.questsDone ?? 0} label="Quests done" color="#b58bff" />
        </div>

        {/* Faction mastery + recent matches */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginTop: 16 }}>
          <Panel>
            <PanelTitle>Faction Mastery</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {(p?.factionMastery ?? []).slice().sort((a, b) => b.level - a.level).map((f) => {
                const color = factionColor(f.faction);
                const name = FACTION_LABEL[f.faction as keyof typeof FACTION_LABEL] ?? f.faction;
                const pct = Math.round((f.level / 20) * 100);
                return (
                  <div key={f.faction} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <FactionIcon faction={f.faction} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", font: `700 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3", marginBottom: 5 }}>
                        <span>{name}</span><span style={{ color: "#8a93a6" }}>Lvl {f.level}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${color},color-mix(in srgb,${color} 60%,#fff))` }} />
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

        <div style={{ marginTop: 18 }}>
          <Panel>
            <PanelTitle>Audio</PanelTitle>
            <MusicSettings />
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
