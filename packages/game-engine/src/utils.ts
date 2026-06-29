import type { Card, Faction } from "@memetgc/types";
import type { MinionSlot, PlayerState } from "@memetgc/types";

let instanceCounter = 0;
export function nextInstanceId(): string {
  return `inst_${++instanceCounter}_${Date.now()}`;
}

/** Shallow-clone a game state — deep clone only the mutable parts */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Determine faction bonus for a deck */
export function detectFactionBonus(cards: Card[]): Faction | null {
  const nonDegen = cards.filter((c) => c.faction !== "degen");
  if (nonDegen.length === 0) return "degen";
  const primary = nonDegen[0]!.faction;
  return nonDegen.every((c) => c.faction === primary) ? primary : null;
}

/** Shuffle array in-place using Fisher-Yates */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Apply volatility to a minion's stats on play */
export function applyVolatility(
  baseAttack: number,
  baseHealth: number,
  variance: { attack_variance?: number; health_variance?: number },
  rng: () => number
): { attack: number; health: number } {
  const av = variance.attack_variance ?? 0;
  const hv = variance.health_variance ?? 0;
  const attack = Math.max(0, baseAttack + Math.floor(rng() * (av * 2 + 1)) - av);
  const health = Math.max(1, baseHealth + Math.floor(rng() * (hv * 2 + 1)) - hv);
  return { attack, health };
}

/** Get valid attack targets from an active player's perspective */
export function getValidAttackTargets(
  attackerId: string,
  board: (MinionSlot | null)[],
  opponentBoard: (MinionSlot | null)[],
  opponentHeroInstanceId: string
): string[] {
  const opponentMinions = opponentBoard.filter((s): s is MinionSlot => s !== null);
  const tauntMinions = opponentMinions.filter((m) => m.hasTaunt);

  if (tauntMinions.length > 0) {
    return tauntMinions.map((m) => m.instanceId);
  }

  return [...opponentMinions.map((m) => m.instanceId), opponentHeroInstanceId];
}

/** Get all occupied slots on a board */
export function getOccupiedSlots(board: (MinionSlot | null)[]): MinionSlot[] {
  return board.filter((s): s is MinionSlot => s !== null);
}

/** Apply armor-damage formula */
export function applyDamageWithArmor(
  currentHp: number,
  currentArmor: number,
  damage: number
): { hp: number; armor: number } {
  const armorAbsorbed = Math.min(currentArmor, damage);
  const remainingDamage = damage - armorAbsorbed;
  return {
    armor: currentArmor - armorAbsorbed,
    hp: currentHp - remainingDamage,
  };
}

/** Get a simple seeded PRNG from a seed number */
export function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

/** Find first empty board slot index */
export function findEmptySlot(board: (MinionSlot | null)[]): number {
  return board.findIndex((s) => s === null);
}

/** Check if a player has a minion with taunt */
export function hasTauntMinion(board: (MinionSlot | null)[]): boolean {
  return board.some((s) => s !== null && s.hasTaunt);
}

/** Get current effective mana cost of a card for a player */
export function getEffectiveCost(card: Card, player: PlayerState): number {
  const modifier = (card as Card & { costModifier?: number }).costModifier ?? 0;
  let cost = card.cost + modifier;
  if (card.type === "spell" && player.firstSpellDiscounted) {
    cost = Math.max(0, cost - 1);
  }
  if (card.type === "spell") {
    cost = Math.max(0, cost + player.gasSpikeModifier);
  }
  return Math.max(0, cost);
}
