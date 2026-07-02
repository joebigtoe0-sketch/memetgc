import type { Card, CardEffect, GameState, AnimationHint, PlayerState } from "@memetgc/types";
import type { MinionSlot } from "@memetgc/types";
import { deepClone, nextInstanceId, applyDamageWithArmor, minionPassesTargetCondition } from "./utils.js";
import { createMinionSlot } from "./factory.js";
import { damageMinionSlot, damageHero } from "./combat.js";

export interface EffectContext {
  state: GameState;
  activePlayerId: string;
  sourceCard: Card;
  targetInstanceId?: string;
  animations: AnimationHint[];
  rng: () => number;
  /** Single coin-flip result for the whole card play, used by coin_heads/coin_tails effects */
  coinFlip?: "heads" | "tails";
}

/** Resolve all effects with a given trigger for a card */
export function resolveEffects(
  effects: CardEffect[],
  trigger: CardEffect["trigger"],
  ctx: EffectContext
): void {
  for (const effect of effects) {
    if (effect.trigger !== trigger) continue;
    resolveEffect(effect, ctx);
  }
}

/**
 * After a hero is healed, fire any board minion effects gated on "on_heal"
 * (e.g. "Whenever your hero is healed, draw a card").
 */
export function fireHealTriggers(
  state: GameState,
  healedPlayerId: string,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): void {
  const player = state.players[healedPlayerId];
  if (!player) return;
  for (const slot of player.board) {
    if (!slot) continue;
    for (const effect of slot.card.effects ?? []) {
      if (effect.params?.condition !== "on_heal") continue;
      const ctx: EffectContext = {
        state,
        activePlayerId: healedPlayerId,
        sourceCard: slot.card,
        animations,
        rng,
        cardRegistry,
      } as EffectContext & { cardRegistry?: Map<string, Card> };
      resolveEffect(effect, ctx);
    }
  }
}

/**
 * Fire a minion's "on_take_damage" reactions (e.g. Wojak: draw a card when it
 * takes damage and survives). Only fires for minions still alive after the hit.
 */
export function fireTakeDamageTriggers(
  state: GameState,
  slot: MinionSlot,
  ownerId: string,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): void {
  if (slot.currentHealth <= 0) return;
  if (!(slot.card.effects ?? []).some((e) => e.trigger === "on_take_damage")) return;
  const ctx: EffectContext = {
    state,
    activePlayerId: ownerId,
    sourceCard: slot.card,
    animations,
    rng,
    cardRegistry,
  } as EffectContext & { cardRegistry?: Map<string, Card> };
  resolveEffects(slot.card.effects ?? [], "on_take_damage", ctx);
}

/** Whole-effect gate for conditions like coin flips. Returns false to skip the effect entirely. */
function effectGatePasses(effect: CardEffect, ctx: EffectContext): boolean {
  const condition = effect.params?.condition as string | undefined;
  if (!condition) return true;
  switch (condition) {
    case "coin_heads": return ctx.coinFlip === "heads";
    case "coin_tails": return ctx.coinFlip === "tails";
    case "hero_hp_leading": {
      // e.g. Algo Stable: only fire if my hero has more HP than the opponent's.
      const me = ctx.state.players[ctx.activePlayerId];
      const oppId = Object.keys(ctx.state.players).find((id) => id !== ctx.activePlayerId);
      const opp = oppId ? ctx.state.players[oppId] : undefined;
      if (!me || !opp) return false;
      return me.hp > opp.hp;
    }
    default: return true; // per-target conditions handled at target resolution
  }
}

function resolveEffect(effect: CardEffect, ctx: EffectContext): void {
  if (!effectGatePasses(effect, ctx)) return;

  const activePlayer = ctx.state.players[ctx.activePlayerId]!;
  const opponentId = Object.keys(ctx.state.players).find((id) => id !== ctx.activePlayerId)!;
  const opponent = ctx.state.players[opponentId]!;

  const params = effect.params ?? {};
  const targetCondition = params.condition as string | undefined;
  const targetValue = params.value as number | undefined;

  switch (effect.action) {
    case "deal_damage": {
      const amount = (params.amount as number) ?? 0;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent)
        .filter((t) => t.type !== "minion" || minionPassesTargetCondition(t.slot, targetCondition, targetValue));
      for (const t of targets) {
        applyDamageToTarget(t, amount, ctx, activePlayer, opponent);
      }
      break;
    }

    case "heal": {
      const amount = (params.amount as number) ?? 0;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "hero") {
          const player = ctx.state.players[t.playerId]!;
          player.hp = Math.min(player.maxHp, player.hp + amount);
          ctx.animations.push({ type: "heal", data: { targetId: "hero_" + t.playerId, amount } });
        } else if (t.type === "minion") {
          t.slot.currentHealth = Math.min(t.slot.maxHealth, t.slot.currentHealth + amount);
        }
      }
      break;
    }

    case "buff_attack": {
      const amount = (params.amount as number) ?? 0;
      const setTo = params.set_to as number | undefined;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          if (setTo !== undefined) {
            t.slot.currentAttack = setTo;
          } else {
            t.slot.currentAttack = Math.max(0, t.slot.currentAttack + amount);
          }
        }
      }
      break;
    }

    case "buff_health": {
      const amount = (params.amount as number) ?? 0;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          t.slot.maxHealth += amount;
          t.slot.currentHealth += amount;
        }
      }
      break;
    }

    case "buff_attack_health": {
      const amount = (params.amount as number) ?? 0;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          t.slot.currentAttack += amount;
          t.slot.maxHealth += amount;
          t.slot.currentHealth += amount;
        }
      }
      break;
    }

    case "destroy": {
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent)
        .filter((t) => t.type !== "minion" || minionPassesTargetCondition(t.slot, targetCondition, targetValue));
      for (const t of targets) {
        if (t.type === "minion" && !isMinionImmuneToDestroy(t.slot)) {
          t.slot.currentHealth = 0;
        }
      }
      break;
    }

    case "silence": {
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          silenceMinion(t.slot);
        }
      }
      break;
    }

    case "draw_cards": {
      const count = (params.count as number) ?? 1;
      for (let i = 0; i < count; i++) {
        drawCard(activePlayer, ctx.animations);
      }
      break;
    }

    case "add_to_hand": {
      const cardId = params.card_id as string | undefined;
      const random = params.random as boolean | undefined;
      const filter = params.filter as string | undefined;
      const discover = params.discover as boolean | undefined;
      const count = (params.count as number) ?? 1;

      if (discover && filter) {
        // Set up discover — don't add immediately
        ctx.state.pendingDiscover = {
          playerId: ctx.activePlayerId,
          options: generateDiscoverOptions(filter, ctx),
          sourceCardId: ctx.sourceCard.id,
        };
      } else if (cardId) {
        for (let i = 0; i < count; i++) {
          const cardTemplate = getCardById(cardId, ctx);
          if (cardTemplate && activePlayer.hand.length < 10) {
            activePlayer.hand.push({ ...deepClone(cardTemplate), instanceId: nextInstanceId() } as Card & { instanceId: string });
          }
        }
      } else if (random && filter) {
        const pool = getCardPool(filter, ctx);
        const costMod =
          (params.cost_reduction ? -(params.cost_reduction as number) : 0) +
          ((params.cost_increase as number) ?? 0);
        for (let i = 0; i < count; i++) {
          if (pool.length === 0) break;
          const card = pool[Math.floor(ctx.rng() * pool.length)]!;
          if (activePlayer.hand.length < 10) {
            const clone = { ...deepClone(card), instanceId: nextInstanceId() } as Card & { instanceId: string; costModifier?: number };
            if (costMod) clone.costModifier = (clone.costModifier ?? 0) + costMod;
            activePlayer.hand.push(clone);
          }
        }
      }
      break;
    }

    case "summon_minion": {
      const registry = (ctx as EffectContext & { cardRegistry?: Map<string, Card> }).cardRegistry;
      const randomCost = params.random_cost as number | undefined;
      let template: Card | null = null;

      if (randomCost !== undefined && registry) {
        const pool = Array.from(registry.values()).filter(
          (c) => c.type === "minion" && c.collectible && c.cost === randomCost
        );
        if (pool.length > 0) template = pool[Math.floor(ctx.rng() * pool.length)]!;
      }
      if (!template) {
        const cardId = params.card_id as string | undefined;
        if (cardId) template = getCardById(cardId, ctx);
      }

      if (template) {
        const emptyIdx = activePlayer.board.findIndex((s) => s === null);
        if (emptyIdx !== -1) {
          const slot = createMinionSlot(template);
          slot.summoningSickness = true;
          const kw = params.give_keyword as string | undefined;
          if (kw) applyKeywordToSlot(slot, kw); // e.g. "charge" (Ape In) clears summoning sickness
          activePlayer.board[emptyIdx] = slot;
          ctx.animations.push({ type: "play_card", data: { cardId: template.id, boardIndex: emptyIdx } });
        }
      }
      break;
    }

    case "give_keyword": {
      const keyword = params.keyword as string;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          applyKeywordToSlot(t.slot, keyword);
        }
      }
      break;
    }

    case "give_divine_shield": {
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          t.slot.hasDivineShield = true;
        }
      }
      break;
    }

    case "give_armor": {
      const amount = (params.amount as number) ?? 0;
      activePlayer.armor += amount;
      ctx.animations.push({ type: "armor_gain", data: { playerId: ctx.activePlayerId, amount } });
      break;
    }

    case "modify_cost": {
      const amount = (params.amount as number) ?? 0;
      const target = params.target as string | undefined;
      const filter = params.filter as string | undefined;
      const duration = params.duration as string | undefined;

      if (target === "next_spell_this_turn") {
        activePlayer.firstSpellDiscounted = true;
      } else if (target === "opponent_spells") {
        opponent.gasSpikeModifier += amount;
      } else if (filter?.includes("faction:meme") && duration === "this_turn") {
        for (const card of activePlayer.hand) {
          if (matchesFilter(card, filter)) {
            (card as Card & { costModifier?: number }).costModifier = ((card as Card & { costModifier?: number }).costModifier ?? 0) + amount;
          }
        }
      } else if (target === "all_cards_in_hand") {
        for (const card of activePlayer.hand) {
          (card as Card & { costModifier?: number }).costModifier = ((card as Card & { costModifier?: number }).costModifier ?? 0) + amount;
        }
      } else if (effect.target === "random_card_in_hand_friendly") {
        if (activePlayer.hand.length > 0) {
          const card = activePlayer.hand[Math.floor(ctx.rng() * activePlayer.hand.length)]!;
          (card as Card & { costModifier?: number }).costModifier = ((card as Card & { costModifier?: number }).costModifier ?? 0) + amount;
        }
      } else if (effect.target === "chosen_card_in_hand_friendly") {
        // Let the player pick which card in hand to discount (e.g. Gas Refund).
        // Reuses the discover picker in "reduce_cost" mode — the source card has
        // already been removed from hand, so it can't target itself.
        if (activePlayer.hand.length > 0) {
          ctx.state.pendingDiscover = {
            playerId: ctx.activePlayerId,
            options: activePlayer.hand.map((c) => deepClone(c)),
            sourceCardId: ctx.sourceCard.id,
            mode: "reduce_cost",
            costModifier: amount,
            prompt: `Reduce a card's cost by ${Math.abs(amount)}`,
          };
        }
      } else if (effect.target === "all_minions_friendly" || effect.target === "minion_friendly") {
        for (const card of activePlayer.hand) {
          if (card.type === "minion" && (!filter || matchesFilter(card, filter))) {
            (card as Card & { costModifier?: number }).costModifier = ((card as Card & { costModifier?: number }).costModifier ?? 0) + amount;
          }
        }
      }
      break;
    }

    case "return_to_hand": {
      const from = params.from as string | undefined;
      const filter = params.filter as string | undefined;
      const count = (params.count as number) ?? 1;

      if (from === "burn_pile") {
        // Burn pile is ordered newest-first (index 0 = top), so this list is
        // already "top-first" for position:"top".
        let matches = activePlayer.burnPile.filter((c) => !filter || matchesFilter(c, filter));
        if (params.sort === "cost_desc") matches = [...matches].sort((a, b) => b.cost - a.cost);
        const copy = params.copy === true; // copy: leave the original in the burn pile
        const costMod =
          (params.cost_reduction ? -(params.cost_reduction as number) : 0) +
          ((params.cost_increase as number) ?? 0);
        for (let i = 0; i < Math.min(count, matches.length); i++) {
          const card = matches[i]!;
          if (!copy) {
            const idx = activePlayer.burnPile.indexOf(card);
            if (idx !== -1) activePlayer.burnPile.splice(idx, 1);
          }
          if (activePlayer.hand.length < 10) {
            const clone = { ...deepClone(card), instanceId: nextInstanceId() } as Card & { instanceId: string; costModifier?: number };
            if (costMod) clone.costModifier = (clone.costModifier ?? 0) + costMod;
            activePlayer.hand.push(clone);
          }
        }
      }
      break;
    }

    case "resurrect": {
      if ((params.from as string) !== "burn_pile") break;
      const filter = params.filter as string | undefined;
      const wantsDiedThisTurn = !!filter && filter.includes("died_this_turn");
      const pool = activePlayer.burnPile.filter(
        (c) =>
          c.type === "minion" &&
          (!filter || matchesFilter(c, filter)) &&
          (!wantsDiedThisTurn || (c as Card & { diedOnTurn?: number }).diedOnTurn === ctx.state.turnNumber)
      );
      if (pool.length === 0) break;

      const buff: ResurrectBuff = {
        buffAttack: params.buff_attack as number | undefined,
        buffHealth: params.buff_health as number | undefined,
        giveDivineShield: params.give_divine_shield as boolean | undefined,
        restoreStats: params.restore_stats as boolean | undefined,
      };

      // A "chosen" resurrect (from hand, not random) lets the player pick from the
      // burn pile via the discover picker. Everything else resurrects at random.
      const needsPick = effect.target === "chosen_minion" && !params.random;
      if (needsPick) {
        ctx.state.pendingDiscover = {
          playerId: ctx.activePlayerId,
          options: pool.map((c) => deepClone(c)),
          sourceCardId: ctx.sourceCard.id,
          mode: "resurrect",
          prompt: "Choose a minion to bring back",
          resurrect: buff,
        };
      } else {
        const chosen = pool[Math.floor(ctx.rng() * pool.length)]!;
        const idx = activePlayer.burnPile.indexOf(chosen);
        if (idx !== -1) activePlayer.burnPile.splice(idx, 1);
        summonResurrectedMinion(activePlayer, chosen, buff, ctx.animations);
      }
      break;
    }

    case "peek": {
      const from = (params.from as string) ?? "deck";
      const source = from === "burn_pile" ? activePlayer.burnPile : activePlayer.deckPile;
      const top = source[0];
      // reveal: keep the top deck card face-up to its owner until it is drawn.
      if (params.reveal === true && from === "deck") {
        activePlayer.topDeckRevealed = true;
      }
      if (top) {
        ctx.animations.push({
          type: "peek",
          data: { cardId: top.id, cardName: top.name, from, playerId: ctx.activePlayerId, reveal: params.reveal === true },
        });
      }
      break;
    }

    case "add_to_burn_pile": {
      if (params.copy_self) {
        activePlayer.burnPile.unshift(deepClone(ctx.sourceCard));
      }
      break;
    }

    case "transform": {
      const atk = params.attack as number | undefined;
      const hp = params.health as number | undefined;
      const strip = params.strip_keywords as boolean | undefined;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type !== "minion") continue;
        if (atk !== undefined) { t.slot.currentAttack = atk; t.slot.tempAttackBoost = 0; }
        if (hp !== undefined) { t.slot.maxHealth = hp; t.slot.currentHealth = hp; }
        if (strip) {
          t.slot.hasTaunt = false;
          t.slot.hasDivineShield = false;
          t.slot.hasCharge = false;
          t.slot.hasLifesteal = false;
          t.slot.isSilenced = true;
        }
      }
      break;
    }

    case "freeze": {
      const duration = (params.duration as number) ?? 1;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion") {
          t.slot.frozen = true;
          t.slot.frozenTurns = duration;
        }
      }
      break;
    }

    case "redistribute_board": {
      const all: MinionSlot[] = [
        ...activePlayer.board.filter((s): s is MinionSlot => s !== null),
        ...opponent.board.filter((s): s is MinionSlot => s !== null),
      ];
      activePlayer.board = Array(7).fill(null);
      opponent.board = Array(7).fill(null);
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(ctx.rng() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      for (const m of all) {
        const sides = [activePlayer, opponent].filter((p) => p.board.some((s) => s === null));
        if (sides.length === 0) break;
        const side = sides[Math.floor(ctx.rng() * sides.length)]!;
        const idx = side.board.findIndex((s) => s === null);
        side.board[idx] = m;
      }
      break;
    }

    case "copy_to_hand": {
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
      for (const t of targets) {
        if (t.type === "minion" && activePlayer.hand.length < 10) {
          const copy = deepClone(t.slot.card);
          (copy as Card & { instanceId: string }).instanceId = nextInstanceId();
          activePlayer.hand.push(copy as Card & { instanceId: string });
        }
      }
      break;
    }

    case "shuffle_into_deck": {
      const from = params.from as string | undefined;
      const count = (params.count as number) ?? 1;
      if (from === "burn_pile") {
        for (let i = 0; i < count; i++) {
          if (activePlayer.burnPile.length === 0) break;
          const card = activePlayer.burnPile.shift()!;
          const insertIdx = Math.floor(ctx.rng() * (activePlayer.deckPile.length + 1));
          activePlayer.deckPile.splice(insertIdx, 0, { ...deepClone(card), instanceId: nextInstanceId() } as Card & { instanceId: string });
          activePlayer.deckCount = activePlayer.deckPile.length;
          ctx.animations.push({
            type: "shuffle_to_deck",
            data: { cardId: card.id, playerId: ctx.activePlayerId },
          });
        }
      } else {
        activePlayer.deckCount += 1;
      }
      break;
    }
  }
}

export interface ResurrectBuff {
  buffAttack?: number;
  buffHealth?: number;
  giveDivineShield?: boolean;
  restoreStats?: boolean;
}

/**
 * Summon a minion card onto a player's board (from the burn pile), applying any
 * resurrect buffs. Returns false if the board is full. Exported so the discover
 * resolver in the engine can reuse it when a player picks a minion to revive.
 */
export function summonResurrectedMinion(
  player: PlayerState,
  card: Card,
  buff: ResurrectBuff,
  animations: AnimationHint[]
): boolean {
  const emptyIdx = player.board.findIndex((s) => s === null);
  if (emptyIdx === -1) return false;
  const slot = createMinionSlot(card);
  slot.summoningSickness = true;
  if (buff.buffAttack) slot.currentAttack += buff.buffAttack;
  if (buff.buffHealth) {
    slot.maxHealth += buff.buffHealth;
    slot.currentHealth += buff.buffHealth;
  }
  if (buff.giveDivineShield) slot.hasDivineShield = true;
  player.board[emptyIdx] = slot;
  animations.push({ type: "play_card", data: { cardId: card.id, boardIndex: emptyIdx, resurrected: true } });
  return true;
}

// ---- Helpers ----

type TargetRef =
  | { type: "hero"; playerId: string }
  | { type: "minion"; slot: MinionSlot; playerId: string };

function resolveTargets(
  target: CardEffect["target"],
  ctx: EffectContext,
  activePlayer: PlayerState,
  opponent: PlayerState
): TargetRef[] {
  switch (target) {
    case "hero_friendly":
      return [{ type: "hero", playerId: activePlayer.playerId }];
    case "hero_enemy":
      return [{ type: "hero", playerId: opponent.playerId }];
    case "any_hero":
      return [
        { type: "hero", playerId: activePlayer.playerId },
        { type: "hero", playerId: opponent.playerId },
      ];
    case "self":
      if (ctx.targetInstanceId) {
        const slot = findMinionByInstanceId(ctx.targetInstanceId, activePlayer, opponent);
        if (slot) return [slot];
      }
      return [];
    case "all_minions_friendly":
      return activePlayer.board.filter((s): s is MinionSlot => s !== null).map((s) => ({ type: "minion" as const, slot: s, playerId: activePlayer.playerId }));
    case "all_minions_enemy":
      return opponent.board.filter((s): s is MinionSlot => s !== null).map((s) => ({ type: "minion" as const, slot: s, playerId: opponent.playerId }));
    case "all_minions":
      return [
        ...activePlayer.board.filter((s): s is MinionSlot => s !== null).map((s) => ({ type: "minion" as const, slot: s, playerId: activePlayer.playerId })),
        ...opponent.board.filter((s): s is MinionSlot => s !== null).map((s) => ({ type: "minion" as const, slot: s, playerId: opponent.playerId })),
      ];
    case "all_characters":
      return [
        { type: "hero", playerId: activePlayer.playerId },
        { type: "hero", playerId: opponent.playerId },
        ...activePlayer.board.filter((s): s is MinionSlot => s !== null).map((s) => ({ type: "minion" as const, slot: s, playerId: activePlayer.playerId })),
        ...opponent.board.filter((s): s is MinionSlot => s !== null).map((s) => ({ type: "minion" as const, slot: s, playerId: opponent.playerId })),
      ];
    case "random_minion_enemy": {
      const minions = opponent.board.filter((s): s is MinionSlot => s !== null);
      if (minions.length === 0) return [];
      const chosen = minions[Math.floor(ctx.rng() * minions.length)]!;
      return [{ type: "minion", slot: chosen, playerId: opponent.playerId }];
    }
    case "random_minion_friendly": {
      const minions = activePlayer.board.filter((s): s is MinionSlot => s !== null);
      if (minions.length === 0) return [];
      const chosen = minions[Math.floor(ctx.rng() * minions.length)]!;
      return [{ type: "minion", slot: chosen, playerId: activePlayer.playerId }];
    }
    case "chosen_minion": {
      if (ctx.targetInstanceId) {
        const ref = findMinionByInstanceId(ctx.targetInstanceId, activePlayer, opponent);
        if (ref) return [ref];
      }
      return [];
    }
    case "chosen_any": {
      if (ctx.targetInstanceId) {
        if (ctx.targetInstanceId.startsWith("hero_")) {
          const heroPlayerId = ctx.targetInstanceId.slice("hero_".length);
          if (ctx.state.players[heroPlayerId]) return [{ type: "hero", playerId: heroPlayerId }];
          return [];
        }
        const ref = findMinionByInstanceId(ctx.targetInstanceId, activePlayer, opponent);
        if (ref) return [ref];
      }
      return [];
    }
    case "minion_friendly": {
      if (ctx.targetInstanceId) {
        const ref = findMinionByInstanceId(ctx.targetInstanceId, activePlayer, opponent);
        if (ref && ref.playerId === activePlayer.playerId) return [ref];
      }
      return [];
    }
    case "minion_enemy": {
      if (ctx.targetInstanceId) {
        const ref = findMinionByInstanceId(ctx.targetInstanceId, activePlayer, opponent);
        if (ref && ref.playerId === opponent.playerId) return [ref];
      }
      return [];
    }
    case "any_minion": {
      if (ctx.targetInstanceId) {
        const ref = findMinionByInstanceId(ctx.targetInstanceId, activePlayer, opponent);
        if (ref) return [ref];
      }
      return [];
    }
    default:
      return [];
  }
}

function findMinionByInstanceId(
  instanceId: string,
  p1: PlayerState,
  p2: PlayerState
): TargetRef | null {
  for (const board of [p1.board, p2.board]) {
    const playerId = board === p1.board ? p1.playerId : p2.playerId;
    for (const slot of board) {
      if (slot && slot.instanceId === instanceId) {
        return { type: "minion", slot, playerId };
      }
    }
  }
  return null;
}

function applyDamageToTarget(
  target: TargetRef,
  amount: number,
  ctx: EffectContext,
  activePlayer: PlayerState,
  opponent: PlayerState
): void {
  if (target.type === "hero") {
    const player = ctx.state.players[target.playerId]!;
    damageHero(player, amount);
    ctx.animations.push({ type: "spell_cast", data: { targetId: "hero_" + target.playerId, damage: amount } });
  } else {
    const result = damageMinionSlot(target.slot, amount);
    if (!result.absorbed) {
      ctx.animations.push({ type: "spell_cast", data: { targetId: target.slot.instanceId, damage: amount } });
      // "Whenever this takes damage and survives…" reactions (e.g. Wojak).
      fireTakeDamageTriggers(
        ctx.state,
        target.slot,
        target.playerId,
        ctx.animations,
        ctx.rng,
        (ctx as EffectContext & { cardRegistry?: Map<string, Card> }).cardRegistry
      );
    }
  }
}

function isMinionImmuneToDestroy(slot: MinionSlot): boolean {
  return (slot.card.effects ?? []).some(
    (e) => e.action === "immune_to" && (e.params?.effect_tag as string) === "destroy"
  );
}

function silenceMinion(slot: MinionSlot): void {
  slot.hasTaunt = false;
  slot.hasDivineShield = false;
  slot.hasCharge = false;
  slot.hasLifesteal = false;
  slot.isSilenced = true;
  slot.tempAttackBoost = 0;
  slot.currentAttack = slot.card.attack ?? 0;
  slot.currentHealth = Math.min(slot.currentHealth, slot.card.health ?? 1);
  slot.maxHealth = slot.card.health ?? 1;
}

function applyKeywordToSlot(slot: MinionSlot, keyword: string): void {
  if (keyword === "taunt") slot.hasTaunt = true;
  if (keyword === "charge") { slot.hasCharge = true; slot.summoningSickness = false; }
  if (keyword === "divine_shield") slot.hasDivineShield = true;
  if (keyword === "lifesteal") slot.hasLifesteal = true;
}

export function drawCard(player: PlayerState, animations: AnimationHint[]): void {
  if (!player.deckPile || player.deckPile.length <= 0) {
    player.fatigue++;
    player.deckCount = 0;
    const { hp, armor } = applyDamageWithArmor(player.hp, player.armor, player.fatigue);
    player.hp = hp;
    player.armor = armor;
    animations.push({ type: "draw", data: { fatigue: player.fatigue, playerId: player.playerId } });
    return;
  }
  const card = player.deckPile.shift()!;
  player.deckCount = player.deckPile.length;
  // The revealed top card (if any) has now been drawn; stop revealing.
  player.topDeckRevealed = false;
  if (player.hand.length < 10) {
    player.hand.push(card);
    animations.push({ type: "draw", data: { playerId: player.playerId, cardId: card.id } });
  } else {
    player.burnPile.unshift(card);
    animations.push({ type: "draw", data: { overdraw: true, playerId: player.playerId, cardId: card.id } });
  }
}

function getCardById(id: string, ctx: EffectContext): Card | null {
  // This will be injected by the server which has DB access
  const registry = (ctx as EffectContext & { cardRegistry?: Map<string, Card> }).cardRegistry;
  return registry?.get(id) ?? null;
}

function getCardPool(filter: string, ctx: EffectContext): Card[] {
  const registry = (ctx as EffectContext & { cardRegistry?: Map<string, Card> }).cardRegistry;
  if (!registry) return [];
  return Array.from(registry.values()).filter((c) => matchesFilter(c, filter) && c.collectible);
}

function generateDiscoverOptions(filter: string, ctx: EffectContext): Card[] {
  const pool = getCardPool(filter, ctx);
  const shuffled = [...pool].sort(() => ctx.rng() - 0.5);
  return shuffled.slice(0, 3);
}

function matchesFilter(card: Card, filter: string): boolean {
  const parts = filter.split(",");
  return parts.every((part) => {
    const [key, val] = part.split(":");
    if (!key || !val) return true;
    switch (key.trim()) {
      case "type": return card.type === val.trim();
      case "faction": return card.faction === val.trim();
      case "rarity": return card.rarity === val.trim();
      case "tribe": return (card.tribe ?? "").toLowerCase() === val.trim().toLowerCase();
      case "keyword": return card.keywords?.some((k) => k.id === val.trim()) ?? false;
      default: return true;
    }
  });
}
