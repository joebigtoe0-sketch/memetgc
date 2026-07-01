/** Quest fragment tiers */
export const QUEST_FRAGMENTS = { low: 15, medium: 30, high: 60 } as const;

/** Post-game fragment rewards by mode */
export const MATCH_FRAGMENTS = {
  ranked: { winner: 5, loser: 2 },
  casual: { winner: 2, loser: 0 },
} as const;

/** Minimum turns before a surrender awards the winner any fragments. */
export const MIN_TURNS_FOR_REWARDS = 4;

const WIN_POINTS = 15;
const LOSS_POINTS = 10;

export function isQuestEligibleMode(mode: string): boolean {
  return mode === "casual" || mode === "ranked";
}

/** Early surrenders grant no rewards to either player. Normal finishes always qualify. */
export function isMatchRewardEligible(endReason: string | null, turnNumber: number): boolean {
  if (endReason === "surrender" && (turnNumber ?? 0) < MIN_TURNS_FOR_REWARDS) return false;
  return true;
}

/**
 * Fragments earned from a finished match. Practice and early surrenders yield 0.
 * Surrendering players never receive fragments.
 */
export function computeMatchFragments(opts: {
  mode: string;
  isWinner: boolean;
  endReason: string | null;
  turnNumber: number;
  playerId: string;
  winnerId: string | null;
}): number {
  const { mode, isWinner, endReason, turnNumber, playerId, winnerId } = opts;

  if (!isQuestEligibleMode(mode)) return 0;
  if (!isMatchRewardEligible(endReason, turnNumber)) return 0;

  if (endReason === "surrender" && playerId !== winnerId) return 0;

  if (mode === "ranked") {
    return isWinner ? MATCH_FRAGMENTS.ranked.winner : MATCH_FRAGMENTS.ranked.loser;
  }
  if (mode === "casual") {
    return isWinner ? MATCH_FRAGMENTS.casual.winner : MATCH_FRAGMENTS.casual.loser;
  }
  return 0;
}

export function computeRankPointDelta(mode: string, isWinner: boolean, currentPoints: number): number | null {
  if (mode !== "ranked") return null;
  const next = Math.max(0, currentPoints + (isWinner ? WIN_POINTS : -LOSS_POINTS));
  return next - currentPoints;
}

export function shouldTrackSeasonStats(mode: string, endReason: string | null, turnNumber: number): boolean {
  return isQuestEligibleMode(mode) && isMatchRewardEligible(endReason, turnNumber);
}
