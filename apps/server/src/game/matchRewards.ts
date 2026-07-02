/** Quest fragment tiers */
export const QUEST_FRAGMENTS = { low: 15, medium: 30, high: 60 } as const;

/** Post-game fragment rewards by mode */
export const MATCH_FRAGMENTS = {
  ranked: { winner: 5, loser: 2 },
  casual: { winner: 2, loser: 0 },
  practice: { winner: 2, loser: 0 },
} as const;

/** Minimum turns before a surrender awards the winner any fragments. */
export const MIN_TURNS_FOR_REWARDS = 4;

export function isQuestEligibleMode(mode: string): boolean {
  return mode === "casual" || mode === "ranked";
}

/** Early surrenders grant no rewards to either player. Normal finishes always qualify. */
export function isMatchRewardEligible(endReason: string | null, turnNumber: number): boolean {
  if (endReason === "surrender" && (turnNumber ?? 0) < MIN_TURNS_FOR_REWARDS) return false;
  return true;
}

/**
 * Fragments earned from a finished match, driven by MATCH_FRAGMENTS per mode
 * (ranked, casual, practice). Early surrenders yield 0, and surrendering players
 * never receive fragments. Unknown modes yield 0.
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

  const table = MATCH_FRAGMENTS[mode as keyof typeof MATCH_FRAGMENTS];
  if (!table) return 0;
  if (!isMatchRewardEligible(endReason, turnNumber)) return 0;
  if (endReason === "surrender" && playerId !== winnerId) return 0;

  return isWinner ? table.winner : table.loser;
}

/** Elo K-factor: bigger swings for newcomers, smaller for established/high players. */
export function eloKFactor(gamesPlayed: number, myPoints: number): number {
  if (gamesPlayed < 30) return 40;
  if (myPoints >= 2000) return 10; // Diamond+
  return 20;
}

/**
 * Standard Elo delta for a ranked result. `S = win ? 1 : 0`, expected score
 * from the MMR gap, delta = round(K * (S - E)). Beating a higher-rated player
 * yields more; losing to a lower-rated one costs more.
 */
export function computeEloDelta(opts: {
  myMmr: number;
  oppMmr: number;
  isWinner: boolean;
  gamesPlayed: number;
  myPoints: number;
}): number {
  const { myMmr, oppMmr, isWinner, gamesPlayed, myPoints } = opts;
  const expected = 1 / (1 + Math.pow(10, (oppMmr - myMmr) / 400));
  const score = isWinner ? 1 : 0;
  const k = eloKFactor(gamesPlayed, myPoints);
  return Math.round(k * (score - expected));
}

export function shouldTrackSeasonStats(mode: string, endReason: string | null, turnNumber: number): boolean {
  return isQuestEligibleMode(mode) && isMatchRewardEligible(endReason, turnNumber);
}
