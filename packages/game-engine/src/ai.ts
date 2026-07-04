import type { GameState, GameAction, MinionSlot, Card, PlayerState } from "@memetgc/types";
import {
  getEffectiveCost,
  getValidAttackTargets,
  getPlayCardTargets,
  effectiveMinionAttack,
} from "./utils.js";

/**
 * A noticeably smarter AI than `getAIAction`, used for the "disguised human"
 * ladder bots (and practice). Returns ONE action per call — the server's AI
 * stepper keeps calling it until it returns end_turn.
 *
 * Heuristics, in priority order:
 *  1. resolve pending discover picks (best = most expensive option)
 *  2. take lethal on the enemy hero when the board can deliver it
 *  3. play cards biggest-first with sensible targeting (kill spells at
 *     minions they actually kill, buffs/heals on own units)
 *  4. attack: clear taunts, take favorable trades, otherwise go face
 *  5. spend leftover mana on the hero power
 */
export function getSmartAIAction(state: GameState, aiPlayerId: string): GameAction {
  const player = state.players[aiPlayerId]!;
  const opponentId = Object.keys(state.players).find((id) => id !== aiPlayerId)!;
  const opponent = state.players[opponentId]!;
  const enemyHeroId = "hero_" + opponentId;
  const myHeroId = "hero_" + aiPlayerId;

  // 1. Pending discover: grab the most expensive option (usually the strongest).
  if (state.pendingDiscover && state.pendingDiscover.playerId === aiPlayerId) {
    const best = [...state.pendingDiscover.options].sort((a, b) => b.cost - a.cost)[0];
    if (best) return { type: "discover_choice", cardId: best.id };
  }

  const enemyMinions = opponent.board.filter((s): s is MinionSlot => s !== null);
  const enemyTaunts = enemyMinions.filter((m) => m.hasTaunt);
  const readyAttackers = player.board.filter(
    (s): s is MinionSlot =>
      s !== null &&
      !s.hasAttacked &&
      !s.frozen &&
      (!s.summoningSickness || s.hasCharge) &&
      effectiveMinionAttack(s) > 0
  );

  // 2. Lethal check: if no taunts stand in the way and our ready damage kills
  // the enemy hero, just send everything face.
  if (enemyTaunts.length === 0 && readyAttackers.length > 0) {
    const totalDamage = readyAttackers.reduce((s, m) => s + effectiveMinionAttack(m), 0);
    if (totalDamage >= opponent.hp + opponent.armor) {
      return {
        type: "attack",
        attackerInstanceId: readyAttackers[0]!.instanceId,
        defenderInstanceId: enemyHeroId,
      };
    }
  }

  // 3. Play cards, biggest first (skip unplayable/pointless ones).
  const available = player.mana + player.tempMana;
  const boardFull = player.board.every((s) => s !== null);
  const playable = player.hand
    .filter((c) => {
      const cost = getEffectiveCost(c, player);
      if (cost > available) return false;
      if (c.type === "minion" && boardFull) return false;
      // The Coin: only when it actually unlocks a play this turn.
      if (c.id === "coin") {
        return player.hand.some(
          (o) => o.id !== "coin" && getEffectiveCost(o, player) === available + 1
        );
      }
      // Targeted cards with nothing legal to hit would be rejected by the engine.
      const targeting = getPlayCardTargets(c, player.board, opponent.board, myHeroId, enemyHeroId);
      if (targeting.needsTarget && targeting.validIds.length === 0) return false;
      return true;
    })
    .sort((a, b) => getEffectiveCost(b, player) - getEffectiveCost(a, player));

  const cardToPlay = playable[0];
  if (cardToPlay) {
    const action: Extract<GameAction, { type: "play_card" }> = {
      type: "play_card",
      cardInstanceId: (cardToPlay as Card & { instanceId: string }).instanceId,
    };
    const targeting = getPlayCardTargets(cardToPlay, player.board, opponent.board, myHeroId, enemyHeroId);
    if (targeting.needsTarget && targeting.validIds.length > 0) {
      action.targetInstanceId = pickCardTarget(cardToPlay, targeting.validIds, player, opponent, myHeroId, enemyHeroId);
    }
    return action;
  }

  // 4. Attacks: taunts first, then favorable trades, then face.
  for (const attacker of [...readyAttackers].sort((a, b) => effectiveMinionAttack(b) - effectiveMinionAttack(a))) {
    const targets = getValidAttackTargets(attacker.instanceId, player.board, opponent.board, enemyHeroId);
    if (targets.length === 0) continue;
    const targetMinions = enemyMinions.filter((m) => targets.includes(m.instanceId));
    const canFace = targets.includes(enemyHeroId);
    const atk = effectiveMinionAttack(attacker);

    // Must clear taunts — pick the one we kill with the least overkill,
    // otherwise chip the lowest-health one.
    if (!canFace && targetMinions.length > 0) {
      const killable = targetMinions.filter((m) => !m.hasDivineShield && atk >= m.currentHealth);
      const pick =
        killable.sort((a, b) => a.currentHealth - b.currentHealth)[0] ??
        targetMinions.sort((a, b) => a.currentHealth - b.currentHealth)[0]!;
      return { type: "attack", attackerInstanceId: attacker.instanceId, defenderInstanceId: pick.instanceId };
    }

    // Favorable trade: we kill it AND (we survive OR it's worth more than us).
    const trades = targetMinions.filter((m) => {
      if (m.hasDivineShield || atk < m.currentHealth) return false;
      const weSurvive = effectiveMinionAttack(m) < attacker.currentHealth;
      const worthIt = m.card.cost >= attacker.card.cost || effectiveMinionAttack(m) >= atk;
      return weSurvive || worthIt;
    });
    if (trades.length > 0) {
      // Kill the most threatening minion we can.
      const pick = trades.sort((a, b) => effectiveMinionAttack(b) - effectiveMinionAttack(a))[0]!;
      return { type: "attack", attackerInstanceId: attacker.instanceId, defenderInstanceId: pick.instanceId };
    }

    if (canFace) {
      return { type: "attack", attackerInstanceId: attacker.instanceId, defenderInstanceId: enemyHeroId };
    }
  }

  // 5. Leftover mana → hero power.
  if (!player.heroPowerUsed && available >= (player.heroPower?.cost ?? 99)) {
    const effectType = player.heroPower.effect_type ?? "";
    const offensive = effectType.includes("damage");
    return { type: "hero_power", targetInstanceId: offensive ? enemyHeroId : undefined };
  }

  return { type: "end_turn" };
}

/** Pick the best target for a card with a required target. */
function pickCardTarget(
  card: Card,
  validIds: string[],
  player: PlayerState,
  opponent: PlayerState,
  myHeroId: string,
  enemyHeroId: string
): string {
  const effects = card.effects ?? [];
  const offensive = effects.some((e) => e.action === "deal_damage" || e.action === "destroy" || e.action === "silence" || e.action === "freeze");
  const damage = effects
    .filter((e) => e.action === "deal_damage")
    .reduce((max, e) => Math.max(max, Number(e.params?.value ?? e.params?.amount ?? 0)), 0);

  const enemyOnBoard = opponent.board.filter((s): s is MinionSlot => s !== null && validIds.includes(s.instanceId));
  const mineOnBoard = player.board.filter((s): s is MinionSlot => s !== null && validIds.includes(s.instanceId));

  if (offensive) {
    // Kill shots first (highest-attack minion we actually remove)...
    const killable = enemyOnBoard
      .filter((m) => (damage > 0 ? m.currentHealth <= damage && !m.hasDivineShield : true))
      .sort((a, b) => effectiveMinionAttack(b) - effectiveMinionAttack(a));
    if (killable[0]) return killable[0].instanceId;
    // ...otherwise the scariest enemy minion, otherwise their face.
    const scariest = [...enemyOnBoard].sort((a, b) => effectiveMinionAttack(b) - effectiveMinionAttack(a))[0];
    if (scariest) return scariest.instanceId;
    if (validIds.includes(enemyHeroId)) return enemyHeroId;
    return validIds[0]!;
  }

  // Friendly effect (buff/heal/shield): our strongest minion, or a damaged one for heals.
  const isHeal = effects.some((e) => e.action === "heal");
  if (isHeal) {
    const damaged = [...mineOnBoard].sort((a, b) => (b.maxHealth - b.currentHealth) - (a.maxHealth - a.currentHealth))[0];
    if (damaged && damaged.maxHealth > damaged.currentHealth) return damaged.instanceId;
    if (validIds.includes(myHeroId) && player.hp < player.maxHp) return myHeroId;
  }
  const strongest = [...mineOnBoard].sort((a, b) => effectiveMinionAttack(b) - effectiveMinionAttack(a))[0];
  if (strongest) return strongest.instanceId;
  return validIds[0]!;
}

/**
 * Smart mulligan: keep the cheap early-game cards (cost <= 3), toss the rest.
 * Returns the instanceIds to KEEP.
 */
export function getSmartMulliganKeeps(player: PlayerState): string[] {
  return player.hand
    .filter((c) => c.cost <= 3)
    .map((c) => (c as Card & { instanceId: string }).instanceId)
    .filter(Boolean);
}
