import type { MinionSlot, PlayerState, AnimationHint } from "@memetgc/types";
import { applyDamageWithArmor } from "./utils.js";

export interface CombatResult {
  animations: AnimationHint[];
  deaths: { instanceId: string; playerId: string }[];
  lifestealHealing: { playerId: string; amount: number }[];
}

/** Deal damage to a minion slot; respects divine shield */
export function damageMinionSlot(slot: MinionSlot, amount: number): { absorbed: boolean; actualDamage: number } {
  if (slot.hasDivineShield) {
    slot.hasDivineShield = false;
    return { absorbed: true, actualDamage: 0 };
  }
  slot.currentHealth -= amount;
  return { absorbed: false, actualDamage: amount };
}

/** Deal damage to a hero player state */
export function damageHero(player: PlayerState, amount: number): number {
  const result = applyDamageWithArmor(player.hp, player.armor, amount);
  player.hp = result.hp;
  player.armor = result.armor;
  return amount;
}

/** Minion-vs-minion combat */
export function resolveMinionAttack(
  attackerSlot: MinionSlot,
  defenderSlot: MinionSlot,
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState
): CombatResult {
  const animations: AnimationHint[] = [];
  const deaths: { instanceId: string; playerId: string }[] = [];
  const lifestealHealing: { playerId: string; amount: number }[] = [];

  // Attacker hits defender
  const defResult = damageMinionSlot(defenderSlot, attackerSlot.currentAttack + attackerSlot.tempAttackBoost);
  // Defender hits attacker (simultaneous)
  const atkResult = damageMinionSlot(attackerSlot, defenderSlot.currentAttack + defenderSlot.tempAttackBoost);

  animations.push({
    type: "attack",
    data: {
      attackerId: attackerSlot.instanceId,
      defenderId: defenderSlot.instanceId,
      attackerDamage: atkResult.actualDamage,
      defenderDamage: defResult.actualDamage,
    },
  });

  // Lifesteal
  if (attackerSlot.hasLifesteal && defResult.actualDamage > 0) {
    lifestealHealing.push({ playerId: attackerPlayer.playerId, amount: defResult.actualDamage });
  }
  if (defenderSlot.hasLifesteal && atkResult.actualDamage > 0) {
    lifestealHealing.push({ playerId: defenderPlayer.playerId, amount: atkResult.actualDamage });
  }

  // Check deaths
  if (attackerSlot.currentHealth <= 0) {
    deaths.push({ instanceId: attackerSlot.instanceId, playerId: attackerPlayer.playerId });
  }
  if (defenderSlot.currentHealth <= 0) {
    deaths.push({ instanceId: defenderSlot.instanceId, playerId: defenderPlayer.playerId });
  }

  attackerSlot.hasAttacked = true;

  return { animations, deaths, lifestealHealing };
}

/** Minion attacks hero */
export function resolveMinionAttacksHero(
  attackerSlot: MinionSlot,
  defenderPlayer: PlayerState
): CombatResult {
  const animations: AnimationHint[] = [];
  const deaths: { instanceId: string; playerId: string }[] = [];
  const lifestealHealing: { playerId: string; amount: number }[] = [];

  const dmg = attackerSlot.currentAttack + attackerSlot.tempAttackBoost;
  const actualDamage = dmg;
  const result = applyDamageWithArmor(defenderPlayer.hp, defenderPlayer.armor, dmg);
  defenderPlayer.hp = result.hp;
  defenderPlayer.armor = result.armor;

  if (attackerSlot.hasLifesteal && actualDamage > 0) {
    lifestealHealing.push({ playerId: attackerSlot.card.faction, amount: actualDamage });
  }

  animations.push({
    type: "attack",
    data: {
      attackerId: attackerSlot.instanceId,
      defenderId: "hero_" + defenderPlayer.playerId,
      damage: actualDamage,
    },
  });

  attackerSlot.hasAttacked = true;

  return { animations, deaths, lifestealHealing };
}

/** Hero with weapon attacks a minion */
export function resolveHeroAttacksMinion(
  attackerPlayer: PlayerState,
  defenderSlot: MinionSlot
): CombatResult {
  const animations: AnimationHint[] = [];
  const deaths: { instanceId: string; playerId: string }[] = [];
  const lifestealHealing: { playerId: string; amount: number }[] = [];

  const dmg = attackerPlayer.weaponAttack;
  const defResult = damageMinionSlot(defenderSlot, dmg);

  animations.push({
    type: "attack",
    data: {
      attackerId: "hero_" + attackerPlayer.playerId,
      defenderId: defenderSlot.instanceId,
      damage: defResult.actualDamage,
    },
  });

  attackerPlayer.weaponDurability -= 1;
  attackerPlayer.heroHasAttacked = true;

  if (defenderSlot.currentHealth <= 0) {
    const slot = defenderSlot;
    deaths.push({ instanceId: slot.instanceId, playerId: "" });
  }

  return { animations, deaths, lifestealHealing };
}

/** Hero attacks enemy hero */
export function resolveHeroAttacksHero(
  attackerPlayer: PlayerState,
  defenderPlayer: PlayerState
): CombatResult {
  const animations: AnimationHint[] = [];
  const deaths: { instanceId: string; playerId: string }[] = [];
  const lifestealHealing: { playerId: string; amount: number }[] = [];

  const dmg = attackerPlayer.weaponAttack;
  const result = applyDamageWithArmor(defenderPlayer.hp, defenderPlayer.armor, dmg);
  defenderPlayer.hp = result.hp;
  defenderPlayer.armor = result.armor;

  animations.push({
    type: "attack",
    data: {
      attackerId: "hero_" + attackerPlayer.playerId,
      defenderId: "hero_" + defenderPlayer.playerId,
      damage: dmg,
    },
  });

  attackerPlayer.weaponDurability -= 1;
  attackerPlayer.heroHasAttacked = true;

  return { animations, deaths, lifestealHealing };
}
