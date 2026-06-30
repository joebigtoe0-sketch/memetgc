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

/** Effective attack of a minion slot (base current + temporary boosts) */
export function effectiveMinionAttack(slot: MinionSlot): number {
  return (slot.currentAttack ?? 0) + (slot.tempAttackBoost ?? 0);
}

/** Whether a minion satisfies a per-target condition like "attack_lte" */
export function minionPassesTargetCondition(
  slot: MinionSlot,
  condition?: string,
  value?: number
): boolean {
  if (!condition) return true;
  const atk = effectiveMinionAttack(slot);
  switch (condition) {
    case "attack_lte": return atk <= (value ?? Number.POSITIVE_INFINITY);
    case "attack_gte": return atk >= (value ?? Number.NEGATIVE_INFINITY);
    case "attack_eq": return atk === value;
    case "health_lte": return slot.currentHealth <= (value ?? Number.POSITIVE_INFINITY);
    case "health_gte": return slot.currentHealth >= (value ?? Number.NEGATIVE_INFINITY);
    default: return true; // non-targeting conditions (coin_*, on_heal) never filter targets
  }
}

/** Effect target types that require the player to manually pick a single target */
const USER_PICK_TARGETS = new Set([
  "chosen_minion",
  "chosen_any",
  "minion_friendly",
  "minion_enemy",
  "any_minion",
]);

export interface PlayCardTargeting {
  /** True if this card has a battlecry/spell effect that needs a manually-picked target */
  needsTarget: boolean;
  /** Instance ids of legal targets — minion instanceIds and/or "hero_<playerId>" */
  validIds: string[];
}

/**
 * Compute the legal targets for playing a card, shared by client (highlight) and
 * server (validation). Works on any board arrays, so the sanitized client state
 * and the full server state can both call it.
 */
export function getPlayCardTargets(
  card: Card,
  friendlyBoard: (MinionSlot | null)[],
  enemyBoard: (MinionSlot | null)[],
  friendlyHeroId: string,
  enemyHeroId: string
): PlayCardTargeting {
  const effects = card.effects ?? [];
  const targeted = effects.find((e) => USER_PICK_TARGETS.has(e.target));
  if (!targeted) return { needsTarget: false, validIds: [] };

  const condition = targeted.params?.condition as string | undefined;
  const value = targeted.params?.value as number | undefined;
  const targetFilter = targeted.params?.target_filter as string | undefined; // "enemy" | "friendly"

  const friendlyMinions = friendlyBoard.filter((s): s is MinionSlot => s !== null).map((s) => ({ slot: s, side: "friendly" as const }));
  const enemyMinions = enemyBoard.filter((s): s is MinionSlot => s !== null).map((s) => ({ slot: s, side: "enemy" as const }));

  let pool: { slot: MinionSlot; side: "friendly" | "enemy" }[] = [];
  switch (targeted.target) {
    case "minion_friendly": pool = friendlyMinions; break;
    case "minion_enemy": pool = enemyMinions; break;
    case "chosen_minion":
    case "any_minion":
    case "chosen_any":
      pool = [...friendlyMinions, ...enemyMinions];
      break;
  }

  if (targetFilter === "enemy") pool = pool.filter((m) => m.side === "enemy");
  if (targetFilter === "friendly") pool = pool.filter((m) => m.side === "friendly");
  pool = pool.filter((m) => minionPassesTargetCondition(m.slot, condition, value));

  const validIds = pool.map((m) => m.slot.instanceId);

  if (targeted.target === "chosen_any") {
    if (targetFilter !== "friendly") validIds.push(enemyHeroId);
    if (targetFilter !== "enemy") validIds.push(friendlyHeroId);
  }

  return { needsTarget: true, validIds };
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
