import type { Card, CardEffect, GameState, AnimationHint, PlayerState } from "@memetgc/types";
import type { MinionSlot } from "@memetgc/types";
import { deepClone, nextInstanceId, applyDamageWithArmor } from "./utils.js";
import { createMinionSlot } from "./factory.js";
import { damageMinionSlot, damageHero } from "./combat.js";

export interface EffectContext {
  state: GameState;
  activePlayerId: string;
  sourceCard: Card;
  targetInstanceId?: string;
  animations: AnimationHint[];
  rng: () => number;
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

function resolveEffect(effect: CardEffect, ctx: EffectContext): void {
  const activePlayer = ctx.state.players[ctx.activePlayerId]!;
  const opponentId = Object.keys(ctx.state.players).find((id) => id !== ctx.activePlayerId)!;
  const opponent = ctx.state.players[opponentId]!;

  const params = effect.params ?? {};

  switch (effect.action) {
    case "deal_damage": {
      const amount = (params.amount as number) ?? 0;
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
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
      const targets = resolveTargets(effect.target, ctx, activePlayer, opponent);
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
        if (pool.length > 0) {
          const card = pool[Math.floor(ctx.rng() * pool.length)]!;
          if (activePlayer.hand.length < 10) {
            activePlayer.hand.push({ ...deepClone(card), instanceId: nextInstanceId() } as Card & { instanceId: string });
          }
        }
      }
      break;
    }

    case "summon_minion": {
      const cardId = params.card_id as string;
      const template = getCardById(cardId, ctx);
      if (template) {
        const emptyIdx = activePlayer.board.findIndex((s) => s === null);
        if (emptyIdx !== -1) {
          const slot = createMinionSlot(template);
          slot.summoningSickness = true;
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
      }
      break;
    }

    case "return_to_hand": {
      const from = params.from as string | undefined;
      const filter = params.filter as string | undefined;
      const count = (params.count as number) ?? 1;

      if (from === "burn_pile" && filter) {
        const matches = activePlayer.burnPile.filter((c) => matchesFilter(c, filter));
        for (let i = 0; i < Math.min(count, matches.length); i++) {
          const card = matches[i]!;
          const idx = activePlayer.burnPile.indexOf(card);
          if (idx !== -1) {
            activePlayer.burnPile.splice(idx, 1);
            if (activePlayer.hand.length < 10) {
              activePlayer.hand.push({ ...deepClone(card), instanceId: nextInstanceId() } as Card & { instanceId: string });
            }
          }
        }
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
      // Not fully implemented — just track in deck count
      activePlayer.deckCount += 1;
      break;
    }
  }
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
    case "chosen_minion":
    case "chosen_any": {
      if (ctx.targetInstanceId) {
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
      case "keyword": return card.keywords?.some((k) => k.id === val.trim()) ?? false;
      default: return true;
    }
  });
}
