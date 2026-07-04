"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import GameIcon from "@/components/UI/GameIcon";
import { formatRankTier } from "@/lib/brand";
import {
  SEASON_REWARDS,
  formatSeasonRewardSummary,
  getSeasonReward,
  nextSeasonRewardTier,
  type SeasonRewardDef,
  type SeasonRewardTier,
} from "@memetgc/types";

export const TIER_COLOR: Record<string, string> = {
  bronze: "#c8843c",
  silver: "#cfd6e0",
  gold: "#e7c768",
  platinum: "#7ad6ff",
  diamond: "#b58bff",
  degen: "#ff5fae",
};

export const ROMAN = ["", "I", "II", "III", "IV", "V"];

export interface SeasonInfo {
  number: number;
  name: string;
  startedAt: string;
  endsAt: string;
  daysRemaining: number;
  progressPct: number;
  durationDays: number;
}

export interface ProfileSeasonData {
  rankTier: string;
  rankStars: number;
  rankPoints: number;
  ladderPosition?: number | null;
  isMemepool?: boolean;
  seasonPeakPoints?: number;
  seasonPeakTier?: string;
  seasonPeakStars?: number;
  seasonRewardTier?: SeasonRewardTier;
  seasonReward?: { tier: SeasonRewardTier; label: string; fragments: number; cardBack: boolean; badge: boolean };
}

export function useSeasonInfo() {
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  useEffect(() => {
    api.get<{ active: SeasonInfo | null }>("/api/season").then((d) => setSeason(d.active)).catch(() => {});
  }, []);
  return season;
}

/** Season-end reward preview box (used in dashboard, profile, etc.). */
export function SeasonRewardBox({
  rewardTier,
  reward,
  seasonName,
  compact,
}: {
  rewardTier: SeasonRewardTier;
  reward: SeasonRewardDef;
  seasonName?: string;
  compact?: boolean;
}) {
  const tc = TIER_COLOR[rewardTier] ?? "#e7c768";
  const nextTier = nextSeasonRewardTier(rewardTier);
  const nextReward = nextTier ? getSeasonReward(nextTier) : null;

  return (
    <div style={{
      marginTop: compact ? 12 : 14,
      padding: compact ? 12 : 14,
      borderRadius: 12,
      background: "rgba(0,0,0,.28)",
      border: `1px solid ${tc}44`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ font: `700 ${compact ? 8 : 9}px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1.5px", color: "#8a93a6" }}>
          SEASON-END REWARD · {reward.label.toUpperCase()}
        </span>
        {seasonName && (
          <span style={{ font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", padding: "3px 8px", borderRadius: 6, color: "#7ad6ff", background: "rgba(122,214,255,.1)", border: "1px solid rgba(122,214,255,.28)" }}>
            {seasonName.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <div style={{ width: compact ? 36 : 42, height: compact ? 36 : 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${tc}22`, border: `1px solid ${tc}55`, fontSize: compact ? 18 : 20 }}>
          🎁
        </div>
        <div>
          <div style={{ font: `800 ${compact ? 16 : 18}px var(--font-mono,'JetBrains Mono',monospace)`, color: tc }}>
            {reward.fragments.toLocaleString()} fragments
          </div>
          <div style={{ font: `600 ${compact ? 10 : 11}px var(--font-archivo,'Archivo',sans-serif)`, color: "#cdd4df", marginTop: 3 }}>
            {reward.cardBack || reward.badge
              ? `+ ${[reward.cardBack ? `unique ${reward.label} card back` : null, reward.badge ? "Memepool badge" : null].filter(Boolean).join(" + ")}`
              : "Ranked season payout"}
          </div>
        </div>
      </div>
      {nextReward && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", gap: 8, font: `600 ${compact ? 9 : 10}px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>
          <span>Next: {nextReward.label}</span>
          <span style={{ color: TIER_COLOR[nextTier!] ?? "#8a93a6", textAlign: "right" }}>
            {nextReward.fragments.toLocaleString()}{nextReward.cardBack ? " + card back" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/** Full-width season panel for the dashboard. */
export function SeasonPanel({ profile }: { profile: ProfileSeasonData | null }) {
  const season = useSeasonInfo();
  if (!season) return null;

  const rewardTier = profile?.seasonRewardTier ?? profile?.seasonPeakTier ?? "bronze";
  const reward = profile?.seasonReward ?? getSeasonReward(rewardTier as SeasonRewardTier);

  return (
    <div style={{
      borderRadius: 16,
      padding: 18,
      background: "linear-gradient(155deg,rgba(74,108,244,.14),rgba(18,23,35,.65))",
      border: "1px solid rgba(122,214,255,.22)",
      boxShadow: "0 12px 30px rgba(0,0,0,.25)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#7ad6ff" }}>
            SEASON {season.number}
          </div>
          <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", marginTop: 4, letterSpacing: ".5px" }}>
            {season.name.toUpperCase()}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ font: `900 22px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7ad6ff" }}>
            {season.daysRemaining}d
          </div>
          <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 2 }}>until reset</div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", font: `600 9.5px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginBottom: 6 }}>
          <span>Season progress</span><span>{season.progressPct}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
          <div style={{ width: `${season.progressPct}%`, height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#4a6cf4,#7ad6ff)", boxShadow: "0 0 8px rgba(122,214,255,.45)" }} />
        </div>
      </div>

      <div style={{ marginTop: 14, font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: "#8a93a6" }}>
        YOUR SEASON-END REWARD · {reward.label.toUpperCase()}
      </div>
      <SeasonRewardBox rewardTier={reward.tier} reward={reward} seasonName={season.name} compact />

      <div style={{ marginTop: 12, font: `500 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", lineHeight: 1.45 }}>
        Rewards are based on your <strong style={{ color: "#aeb6c4" }}>highest rank reached</strong> this season. Top 100 on the leaderboard at reset earn Memepool rewards.
      </div>
    </div>
  );
}

/** Leaderboard rank badge for profile header areas. */
export function LeaderboardBadge({ position, compact }: { position: number | null | undefined; compact?: boolean }) {
  if (!position) return null;
  return (
    <div style={{
      textAlign: "center",
      padding: compact ? "6px 10px" : "8px 12px",
      borderRadius: 10,
      background: "rgba(231,199,104,.1)",
      border: "1px solid rgba(231,199,104,.35)",
      minWidth: compact ? 56 : 64,
    }}>
      <div style={{ font: `900 ${compact ? 16 : 18}px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7c768", lineHeight: 1 }}>
        #{position.toLocaleString()}
      </div>
      <div style={{ font: `700 ${compact ? 7 : 8}px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: "#8a93a6", marginTop: 3 }}>
        LEADERBOARD
      </div>
    </div>
  );
}

/** Rank + peak + reward block for profile/dashboard left panel. */
export function RankRewardPanel({ profile, showLeaderboard }: { profile: ProfileSeasonData; showLeaderboard?: boolean }) {
  const tier = profile.rankTier ?? "bronze";
  const peakTier = profile.seasonPeakTier ?? tier;
  const peakStars = profile.seasonPeakStars ?? profile.rankStars ?? 0;
  const peakTc = TIER_COLOR[peakTier] ?? TIER_COLOR[tier] ?? "#e7c768";
  const rewardTier = (profile.seasonRewardTier ?? peakTier) as SeasonRewardTier;
  const reward = profile.seasonReward ?? getSeasonReward(rewardTier);

  return (
    <>
      {showLeaderboard && profile.ladderPosition && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)` }}>
          <span style={{ color: "#8a93a6" }}>Leaderboard</span>
          <span style={{ color: "#e7c768", fontWeight: 800 }}>#{profile.ladderPosition.toLocaleString()} global</span>
        </div>
      )}
      <div style={{ marginTop: showLeaderboard && profile.ladderPosition ? 10 : 14, paddingTop: showLeaderboard && profile.ladderPosition ? 0 : 14, borderTop: showLeaderboard && profile.ladderPosition ? "none" : "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)` }}>
        <span style={{ color: "#8a93a6" }}>Peak this season</span>
        <span style={{ color: peakTc, fontWeight: 800, textTransform: "uppercase" }}>
          {formatRankTier(peakTier)} {ROMAN[Math.max(1, 5 - peakStars)] ?? ""}
        </span>
      </div>
      <SeasonRewardBox rewardTier={reward.tier} reward={reward} />
    </>
  );
}

/** Full reward table for leaderboard page. */
export function SeasonRewardsTable({ highlightTier }: { highlightTier?: SeasonRewardTier }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", overflow: "hidden", marginBottom: 22 }}>
      <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.03)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Season-End Rewards</div>
        <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", marginTop: 4, lineHeight: 1.45 }}>
          Paid when the season resets. Based on your highest rank reached — top 100 on the leaderboard earn Memepool tier.
        </div>
      </div>
      {SEASON_REWARDS.map((r) => {
        const tc = TIER_COLOR[r.tier] ?? "#e7c768";
        const active = highlightTier === r.tier;
        return (
          <div key={r.tier} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,.04)", background: active ? `${tc}14` : "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GameIcon name="fragment" size={16} />
              <span style={{ font: `700 13px var(--font-cinzel,'Cinzel',serif)`, color: active ? tc : "#e7ecf3", textTransform: "uppercase" }}>{r.label}</span>
              {active && <span style={{ font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`, color: tc, padding: "2px 6px", borderRadius: 4, background: `${tc}22`, border: `1px solid ${tc}55` }}>YOU</span>}
            </div>
            <span style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", textAlign: "right" }}>
              {formatSeasonRewardSummary(r)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
