/**
 * Ranked ladder math — the single source of truth for turning ladder points
 * into a visible tier + division (stars).
 *
 * Tiers are fixed point bands. "Memepool" (internal id `degen`) is NOT a point
 * threshold — it is the live top-N leaderboard, resolved separately (see the
 * leaderboard route). A player is only shown as Memepool when they are inside
 * the top-N; otherwise they display their point-based tier.
 */

export type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "degen";

/** Ordered low -> high. `degen` (Memepool) is the live top tier, appended last. */
export const RANK_TIERS: RankTier[] = ["bronze", "silver", "gold", "platinum", "diamond", "degen"];

/** Points span of a single fixed tier, and points per star/division within it. */
export const TIER_SPAN = 500;
export const POINTS_PER_STAR = 100;
export const STARS_PER_TIER = 5;

/** Fixed point bands (Memepool/degen excluded — it is leaderboard-driven). */
export const TIER_FLOORS: { tier: RankTier; floor: number }[] = [
  { tier: "diamond", floor: 2000 },
  { tier: "platinum", floor: 1500 },
  { tier: "gold", floor: 1000 },
  { tier: "silver", floor: 500 },
  { tier: "bronze", floor: 0 },
];

/** Number of top-of-ladder players shown as Memepool rank (live). */
export const MEMEPOOL_TOP_N = 100;

/** Diamond is the minimum fixed tier eligible for a Memepool slot. */
export const MEMEPOOL_MIN_POINTS = 2000;

export interface RankInfo {
  tier: RankTier;
  stars: number; // 0..4 division progress within the tier
}

/**
 * Derive the fixed tier + division from ladder points.
 * Never returns `degen` — Memepool is overlaid by the leaderboard, not points.
 */
export function tierFromPoints(points: number): RankInfo {
  const p = Math.max(0, Math.floor(points));
  const band = TIER_FLOORS.find((b) => p >= b.floor) ?? TIER_FLOORS[TIER_FLOORS.length - 1]!;
  const withinTier = p - band.floor;
  const stars = Math.min(STARS_PER_TIER - 1, Math.floor(withinTier / POINTS_PER_STAR));
  return { tier: band.tier, stars };
}

/** Convenience: is this player in a fixed tier high enough to qualify for Memepool? */
export function isMemepoolEligible(points: number): boolean {
  return points >= MEMEPOOL_MIN_POINTS;
}
