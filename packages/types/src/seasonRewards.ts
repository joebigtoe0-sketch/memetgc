/** Rank tier used for season-end payout bands (includes live Memepool). */
export type SeasonRewardTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "degen";

export interface SeasonRewardDef {
  tier: SeasonRewardTier;
  label: string;
  fragments: number;
  cardBack: boolean;
  badge: boolean;
}

/** Season-end payout table — keep in sync with packages/db/prisma/end-season.ts */
export const SEASON_REWARDS: SeasonRewardDef[] = [
  { tier: "bronze", label: "Bronze", fragments: 150, cardBack: false, badge: false },
  { tier: "silver", label: "Silver", fragments: 500, cardBack: false, badge: false },
  { tier: "gold", label: "Gold", fragments: 800, cardBack: true, badge: false },
  { tier: "platinum", label: "Platinum", fragments: 1500, cardBack: true, badge: false },
  { tier: "diamond", label: "Diamond", fragments: 2500, cardBack: true, badge: false },
  { tier: "degen", label: "Memepool", fragments: 6000, cardBack: true, badge: true },
];

export const SEASON_DURATION_DAYS = 28;
export const MEMEPOOL_LEADERBOARD_TOP_N = 100;

export function getSeasonReward(tier: SeasonRewardTier): SeasonRewardDef {
  return SEASON_REWARDS.find((r) => r.tier === tier) ?? SEASON_REWARDS[0]!;
}

export function nextSeasonRewardTier(tier: SeasonRewardTier): SeasonRewardTier | null {
  const idx = SEASON_REWARDS.findIndex((r) => r.tier === tier);
  if (idx < 0 || idx >= SEASON_REWARDS.length - 1) return null;
  return SEASON_REWARDS[idx + 1]!.tier;
}

/** Human-readable reward line for UI cards. */
export function formatSeasonRewardSummary(reward: SeasonRewardDef): string {
  const parts = [`${reward.fragments.toLocaleString()} fragments`];
  if (reward.cardBack) parts.push(`unique ${reward.label} card back`);
  if (reward.badge) parts.push("Memepool badge");
  return parts.join(" + ");
}

export function seasonEndsAt(startedAt: Date | string, durationDays = SEASON_DURATION_DAYS): Date {
  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  return new Date(start.getTime() + durationDays * 86_400_000);
}

export function seasonDaysRemaining(startedAt: Date | string, now = Date.now(), durationDays = SEASON_DURATION_DAYS): number {
  const end = seasonEndsAt(startedAt, durationDays).getTime();
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

export function seasonProgressPct(startedAt: Date | string, now = Date.now(), durationDays = SEASON_DURATION_DAYS): number {
  const start = typeof startedAt === "string" ? new Date(startedAt).getTime() : startedAt.getTime();
  const end = start + durationDays * 86_400_000;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}
