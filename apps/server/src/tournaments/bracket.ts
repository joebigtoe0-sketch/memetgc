export const JOIN_WINDOW_MS = 5 * 60 * 1000;

export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Bracket size: next power of 2 ≥ participant count (min 4), capped at maxSlots. */
export function computeBracketSize(participantCount: number, maxSlots: number): number {
  if (participantCount < 1) return 0;
  return Math.min(maxSlots, nextPowerOf2(Math.max(4, participantCount)));
}

export type SeedSlot = string | null;

/**
 * Fill round-1 seed positions (length = bracketSize).
 * Humans are paired with bots whenever possible; bot-vs-bot only after humans
 * are exhausted. Unused slots stay null (bye / empty bracket position).
 */
export function buildRound1Seeds(
  humanIds: string[],
  botIds: string[],
  bracketSize: number,
  rng: () => number = Math.random
): SeedSlot[] {
  const humans = [...humanIds];
  const bots = [...botIds];
  shuffleInPlace(humans, rng);
  shuffleInPlace(bots, rng);

  const seeds: SeedSlot[] = Array.from({ length: bracketSize }, () => null);
  let i = 0;

  while (humans.length > 0 && bots.length > 0 && i + 1 < bracketSize) {
    seeds[i++] = humans.shift()!;
    seeds[i++] = bots.shift()!;
  }

  while (humans.length > 0 && i < bracketSize) {
    seeds[i++] = humans.shift()!;
    if (i < bracketSize) i++; // bye opponent
  }

  while (bots.length >= 2 && i + 1 < bracketSize) {
    seeds[i++] = bots.shift()!;
    seeds[i++] = bots.shift()!;
  }
  if (bots.length === 1 && i < bracketSize) {
    seeds[i++] = bots.shift()!;
  }

  return seeds;
}

export function totalRoundsForBracket(bracketSize: number): number {
  if (bracketSize < 2) return 0;
  return Math.round(Math.log2(bracketSize));
}

export function shuffleInPlace<T>(arr: T[], rng: () => number = Math.random): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Parent slot in round+1 for a child match at (round, slotIndex). */
export function parentSlot(slotIndex: number): number {
  return Math.floor(slotIndex / 2);
}

/** Whether winner fills player1 (even child) or player2 (odd child) in parent. */
export function parentSlotSide(slotIndex: number): "player1" | "player2" {
  return slotIndex % 2 === 0 ? "player1" : "player2";
}

export function formatStartsIn(ms: number): string {
  if (ms <= 0) return "starting now";
  const mins = Math.floor(ms / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export function buildPrizeSummary(
  tiers: { amount: number | null; currency: string; customLabel: string | null }[]
): string {
  const fragTotal = tiers
    .filter((t) => t.currency === "fragments" && t.amount)
    .reduce((s, t) => s + (t.amount ?? 0), 0);
  const custom = tiers.find((t) => t.currency === "custom" && t.amount);
  if (custom?.customLabel) return `${(custom.amount ?? 0).toLocaleString()} ${custom.customLabel}`;
  if (fragTotal > 0) return `${fragTotal.toLocaleString()} frags`;
  return "TBD";
}

/** Map final rank (1 = winner) to prize tier. */
export function rankFromElimination(finalRoundReached: number, totalRounds: number, won: boolean): number {
  if (won) return 1;
  // Lost in final → 2, semis → 3-4, etc.
  const roundLost = finalRoundReached;
  const slotsAtRound = 2 ** (totalRounds - roundLost);
  return slotsAtRound + 1; // approximate lower bound
}

export function rankForPlacement(placement: number): number {
  return placement;
}

/** Compute placement rank from bracket position when eliminated. */
export function eliminationRank(round: number, totalRounds: number, bracketSize: number): number {
  if (round >= totalRounds) return 1;
  const playersAtRound = bracketSize / 2 ** round;
  return playersAtRound + 1;
}
