"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import { useBalances } from "@/hooks/useBalances";
import BottomNav from "./BottomNav";
import { SoundEnableHint } from "@/components/Music/MusicProvider";
import StatChip from "@/components/UI/StatChip";
import GameIcon from "@/components/UI/GameIcon";
import { factionImageUrl } from "@/lib/factions";
import Logo from "@/components/Brand/Logo";
import SettingsButton from "@/components/Settings/SettingsButton";
import { BRAND, formatRankTier } from "@/lib/brand";

const RANK_TIERS = ["bronze", "silver", "gold", "platinum", "diamond", "degen"] as const;
const TIER_COLOR: Record<string, string> = {
  bronze: "#c8843c", silver: "#cfd6e0", gold: "#e7c768",
  platinum: "#7ad6ff", diamond: "#b58bff", degen: "#ff5fae",
};
const ROMAN = ["", "I", "II", "III", "IV", "V"];

interface Profile {
  fragments: number; rankTier: string; rankStars: number; rankPoints: number;
  seasonWins: number; seasonLosses: number; winStreak?: number;
  ladderPosition?: number | null; isMemepool?: boolean;
}
interface Quest {
  id: string; type: string; description: string;
  progress: number; target: number; completed: boolean;
  claimedAt: string | null; rewardJson: { fragments?: number; packs?: { type: string; count: number } };
}

function useResetCountdown() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      const diff = Math.max(0, next.getTime() - now.getTime());
      const h = Math.floor(diff / 3.6e6);
      const m = Math.floor((diff % 3.6e6) / 6e4);
      const s = Math.floor((diff % 6e4) / 1000);
      setLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return label;
}

export default function Dashboard() {
  const router = useRouter();
  const { username, fragments, walletAddress, setFragments } = useAuthStore();
  const { connected } = useGameStore();
  const { degen, packs } = useBalances();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const resetIn = useResetCountdown();

  const loadQuests = React.useCallback(() => {
    api.get<Quest[]>("/api/economy/quests").then(setQuests).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Profile>("/api/economy/profile").then((p) => { setProfile(p); setFragments(p.fragments); }).catch(() => {});
    loadQuests();
  }, [loadQuests, setFragments]);

  async function claimQuest(id: string) {
    try {
      const res = await api.post<{ reward: { fragments?: number } }>(`/api/economy/quests/${id}/claim`, {});
      if (res.reward?.fragments) setFragments(fragments + res.reward.fragments);
      loadQuests();
    } catch { /* ignore */ }
  }

  const tier = profile?.rankTier ?? "gold";
  const tierColor = TIER_COLOR[tier] ?? "#e7c768";
  const stars = profile?.rankStars ?? 0;
  const nextTier = RANK_TIERS[Math.min(RANK_TIERS.length - 1, RANK_TIERS.indexOf(tier as typeof RANK_TIERS[number]) + 1)] ?? "platinum";
  const wins = profile?.seasonWins ?? 0;
  const losses = profile?.seasonLosses ?? 0;
  const games = wins + losses;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const streak = profile?.winStreak ?? 0;
  const progressPct = Math.min(100, Math.round((stars / 5) * 100));

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 85% -10%,rgba(247,147,26,.07),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.07),transparent 55%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 26px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={38} />
          <div>
            <div style={{ font: `900 17px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>{BRAND.shortName.toUpperCase()}</div>
            <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a", letterSpacing: "1.5px", marginTop: 3 }}>{BRAND.tagline.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
            <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7c768" }}>{BRAND.ticker}</span>
            <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7ecf3" }}>{(degen ?? 0).toLocaleString()}</span>
          </div>
          <StatChip icon="fragment" label={`${fragments.toLocaleString()} frags`} />
          <StatChip icon="pack" label={`${packs} packs`} onClick={() => router.push("/packs")} />
          <button onClick={() => router.push("/leaderboard")} style={{ cursor: "pointer", padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", color: "#c2cbdb", font: `700 11px var(--font-archivo,'Archivo',sans-serif)` }}>Ranks</button>
          <button onClick={() => router.push("/docs")} style={{ cursor: "pointer", padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", color: "#c2cbdb", font: `700 11px var(--font-archivo,'Archivo',sans-serif)` }}>Guide</button>
          <SettingsButton />
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#19e08a" : "#ff5555", flexShrink: 0 }} />
            <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7ecf3" }}>{walletAddress ? `${walletAddress.slice(0, 4)}..${walletAddress.slice(-2)}` : (connected ? "online" : "offline")}</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,#2a3344,#161b25)", border: "1px solid rgba(255,255,255,.1)", color: "#f3e8cc", font: `800 14px var(--font-cinzel,'Cinzel',serif)` }}>
            {(username ?? "?")[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr 320px", gap: 18, padding: "6px 26px 16px", minHeight: 0, overflow: "auto" }}>

        {/* LEFT — Profile */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,#243042,#12161f)", border: `1px solid ${tierColor}55`, font: `900 20px var(--font-cinzel,'Cinzel',serif)`, color: tierColor }}>
                {(username ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{username ?? "Player"}</div>
                <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 3 }}>{games} games played</div>
              </div>
            </div>

            <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ font: `900 26px/1 var(--font-cinzel,'Cinzel',serif)`, color: tierColor, textTransform: "uppercase", letterSpacing: ".5px" }}>
                  {formatRankTier(tier)} {ROMAN[Math.max(1, 5 - stars)] ?? ""}
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ width: 13, height: 13, transform: "rotate(45deg)", borderRadius: 2, background: i < stars ? `linear-gradient(135deg,${tierColor},${tierColor}99)` : "rgba(255,255,255,.07)", boxShadow: i < stars ? `0 0 6px ${tierColor}88` : "none" }} />
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ font: `900 22px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc" }}>{(profile?.rankPoints ?? 0).toLocaleString()}</div>
                <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px", marginTop: 3 }}>LADDER PTS</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", font: `600 9.5px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginBottom: 6 }}>
                <span>Progress to {formatRankTier(nextTier)}</span><span>{progressPct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${tierColor},#f7c64a)`, boxShadow: `0 0 8px ${tierColor}88` }} />
              </div>
            </div>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Panel style={{ padding: 16 }}>
              <div style={{ font: `900 24px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#19e08a" }}>{winrate}%</div>
              <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px", marginTop: 6 }}>WIN RATE</div>
            </Panel>
            <Panel style={{ padding: 16 }}>
              <div style={{ font: `900 24px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc" }}>{streak}</div>
              <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px", marginTop: 6 }}>WIN STREAK</div>
            </Panel>
          </div>
        </div>

        {/* CENTER — Play + modes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", padding: "26px 30px", minHeight: 158, display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(110deg,rgba(247,147,26,.22),rgba(20,26,42,.35) 62%)", border: "1px solid rgba(247,147,26,.3)" }}>
            <img src={factionImageUrl("bitcoin")} alt="" draggable={false} style={{ position: "absolute", top: -20, right: 10, width: 200, height: 200, objectFit: "contain", opacity: 0.09, pointerEvents: "none" }} />
            <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: "#ffd187" }}>RANKED LADDER · LIVE</div>
            <div style={{ font: `900 34px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#fff", margin: "10px 0 18px" }}>Climb to {formatRankTier("degen")} Rank</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={() => router.push("/play?mode=ranked")} style={{ cursor: "pointer", border: "none", padding: "13px 38px", borderRadius: 11, font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.4), inset 0 1px 0 rgba(255,255,255,.5)" }}>▶  PLAY</button>
              <span style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c9b48a" }}>
                {profile?.ladderPosition ? `Ladder #${profile.ladderPosition.toLocaleString()}` : `${(profile?.rankPoints ?? 0).toLocaleString()} ladder pts`}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ModeCard name="Practice" tag="FREE · VS AI" desc="Learn the ropes against bots. No rewards." badge="Open" badgeColor="#9aa3b2" onClick={() => router.push("/play?mode=practice")} />
            <ModeCard name="Casual" tag="FREE · VS PLAYERS" desc="No ladder stakes. Earn fragments per match." badge="Open" badgeColor="#7b8cf4" onClick={() => router.push("/play?mode=casual")} />
            <ModeCard name="Ranked" tag={`HOLD 1,000 ${BRAND.ticker} · OWN DECK`} desc="Climb the ladder with your own deck. Earn fragments & season rewards." badge="Unlocked" badgeColor="#f7931a" highlight onClick={() => router.push("/play?mode=ranked")} />
          </div>
        </div>

        {/* RIGHT — Daily quests */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>DAILY QUESTS</span>
              <span style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>resets {resetIn}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {quests.filter((q) => q.type !== "daily_login").map((q) => {
                const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
                const claimable = q.completed && !q.claimedAt;
                const claimed = !!q.claimedAt;
                return (
                  <div key={q.id} style={{ padding: 12, borderRadius: 11, background: "rgba(255,255,255,.025)", border: `1px solid ${claimable ? "rgba(231,199,104,.45)" : "rgba(255,255,255,.06)"}`, opacity: claimed ? 0.55 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3" }}>{q.description}</span>
                      <span style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>{Math.min(q.progress, q.target)} / {q.target}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden", margin: "9px 0 8px" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: claimable ? "linear-gradient(90deg,#e7c768,#f7931a)" : "linear-gradient(90deg,#7b8cf4,#4a6cf4)" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#caa24a" }}>
                        <GameIcon name="fragment" size={14} />
                        {q.rewardJson?.fragments ?? 0} frags
                      </span>
                      {claimable ? (
                        <button onClick={() => claimQuest(q.id)} style={{ cursor: "pointer", border: "none", padding: "5px 14px", borderRadius: 7, font: `800 10px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)" }}>CLAIM</button>
                      ) : claimed ? (
                        <span style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#19e08a" }}>✓ CLAIMED</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {quests.filter((q) => q.type !== "daily_login").length === 0 && (
                <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", textAlign: "center", padding: "16px 0" }}>No active quests.</div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <BottomNav active="play" />
      <SoundEnableHint />
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 16, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 12px 30px rgba(0,0,0,.3)", ...style }}>
      {children}
    </div>
  );
}

function ModeCard({ name, tag, desc, badge, badgeColor, highlight, onClick }: { name: string; tag: string; desc: string; badge: string; badgeColor: string; highlight?: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }} style={{ cursor: "pointer", borderRadius: 14, padding: 16, background: highlight ? `linear-gradient(150deg,color-mix(in srgb,${badgeColor} 14%,transparent),rgba(18,23,35,.55))` : "rgba(255,255,255,.03)", border: `1px solid ${highlight ? badgeColor + "88" : "rgba(255,255,255,.08)"}`, transition: "transform .12s ease, border-color .12s ease" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.borderColor = badgeColor; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.borderColor = highlight ? badgeColor + "88" : "rgba(255,255,255,.08)"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{name}</span>
        <span style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", padding: "4px 9px", borderRadius: 6, color: badgeColor, background: `color-mix(in srgb,${badgeColor} 16%,transparent)`, border: `1px solid color-mix(in srgb,${badgeColor} 40%,transparent)` }}>{badge}</span>
      </div>
      <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 8, letterSpacing: ".5px" }}>{tag}</div>
      <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 8, lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}
