import type {
  GameState,
  GameAction,
  PlayerState,
  MinionSlot,
  AnimationHint,
  Card,
  SanitizedGameState,
  OpponentView,
} from "@memetgc/types";
import { deepClone, seededRng, findEmptySlot, getEffectiveCost, nextInstanceId, applyDamageWithArmor, getValidAttackTargets, getPlayCardTargets } from "./utils.js";
import { createMinionSlot } from "./factory.js";
import {
  resolveMinionAttack,
  resolveMinionAttacksHero,
  resolveHeroAttacksMinion,
  resolveHeroAttacksHero,
} from "./combat.js";
import { resolveEffects, drawCard, fireHealTriggers, fireTakeDamageTriggers, summonResurrectedMinion, type EffectContext } from "./effects.js";
import { applyVolatility } from "./utils.js";

export interface ActionResult {
  success: boolean;
  error?: string;
  newState: GameState;
  animations: AnimationHint[];
}

export function applyAction(state: GameState, action: GameAction, cardRegistry?: Map<string, Card>): ActionResult {
  const newState = deepClone(state);
  const animations: AnimationHint[] = [];

  if (newState.status === "finished") {
    return { success: false, error: "Game is already over", newState: state, animations: [] as AnimationHint[] };
  }

  const rng = seededRng(newState.seed + newState.turnNumber * 1000 + newState.actionLog.length);

  // Snapshot hero HP so we can fire "on heal" triggers after the action resolves
  const preHeroHp: Record<string, number> = {};
  for (const [pid, p] of Object.entries(newState.players)) preHeroHp[pid] = p.hp;

  const result = handleAction(newState, action, animations, rng, cardRegistry);

  if (!result.success) {
    return { success: false, error: result.error, newState: state, animations: [] as AnimationHint[] };
  }

  // Fire heal-triggered minion abilities for any hero whose HP increased
  for (const [pid, p] of Object.entries(newState.players)) {
    if (p.hp > (preHeroHp[pid] ?? p.hp)) {
      fireHealTriggers(newState, pid, animations, rng, cardRegistry);
    }
  }

  // Check for dead minions after every action
  processDeaths(newState, animations, rng, cardRegistry);

  // Check weapon broken
  for (const player of Object.values(newState.players)) {
    if (player.hasWeapon && player.weaponDurability <= 0) {
      player.burnPile.push(player.weaponCard!);
      player.weaponCard = null;
      player.hasWeapon = false;
      player.weaponAttack = 0;
      player.weaponDurability = 0;
    }
  }

  // Check win condition
  checkWinCondition(newState, animations);

  newState.actionLog.push({
    turn: newState.turnNumber,
    playerId: newState.activePlayerId,
    type: action.type,
    data: action as unknown as Record<string, unknown>,
    timestamp: Date.now(),
  });

  newState.seed = (newState.seed + 1) & 0xffffffff;

  return { success: true, newState, animations };
}

function handleAction(
  state: GameState,
  action: GameAction,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): { success: boolean; error?: string } {
  const activePlayer = state.players[state.activePlayerId]!;
  const opponentId = getOpponentId(state);
  const opponent = state.players[opponentId]!;

  // While a discover/resurrect pick is pending, the owner must resolve it first —
  // except ending the turn, which cancels the unresolved pick.
  if (
    state.pendingDiscover &&
    action.type !== "discover_choice" &&
    action.type !== "surrender" &&
    action.type !== "end_turn"
  ) {
    return { success: false, error: "Choose a card first" };
  }

  if (action.type === "end_turn" && state.pendingDiscover?.playerId === state.activePlayerId) {
    state.pendingDiscover = null;
  }

  switch (action.type) {
    case "surrender": {
      if (state.status !== "in_progress") return { success: false, error: "Game not in progress" };
      const surrendererId = action.playerId ?? state.activePlayerId;
      const winnerId = Object.keys(state.players).find((id) => id !== surrendererId)!;
      state.status = "finished";
      state.winner = winnerId;
      state.endReason = "surrender";
      animations.push({ type: "game_over", data: { winner: winnerId, loser: surrendererId } });
      return { success: true };
    }

    case "mulligan":
      return handleMulligan(state, action, animations, rng);

    case "discover_choice":
      return handleDiscoverChoice(state, action, animations);

    case "play_card": {
      if (state.status !== "in_progress") return { success: false, error: "Game not in main phase" };
      if (state.phase !== "main") return { success: false, error: "Not main phase" };
      return handlePlayCard(state, action, animations, rng, cardRegistry);
    }

    case "attack": {
      if (state.phase !== "main") return { success: false, error: "Not main phase" };
      return handleAttack(state, action, animations, rng, cardRegistry);
    }

    case "hero_power": {
      if (state.phase !== "main") return { success: false, error: "Not main phase" };
      if (activePlayer.heroPowerUsed) return { success: false, error: "Hero power already used this round" };
      return handleHeroPower(state, action, animations, rng, cardRegistry);
    }

    case "tap_location": {
      if (state.phase !== "main") return { success: false, error: "Not main phase" };
      const idx = action.index ?? 0;
      const loc = activePlayer.locations[idx];
      if (!loc) return { success: false, error: "No location on board" };
      if (loc.usedThisTurn) return { success: false, error: "Location already used this turn" };
      if (loc.durability <= 0) return { success: false, error: "Location has no durability" };
      return handleTapLocation(state, idx, animations, rng, cardRegistry);
    }

    case "end_turn":
      return handleEndTurn(state, animations, rng, cardRegistry);

    case "discard_to_ten":
      return handleDiscardToTen(state, action);

    default:
      return { success: false, error: "Unknown action" };
  }
}

function handleMulligan(
  state: GameState,
  action: Extract<GameAction, { type: "mulligan" }>,
  animations: AnimationHint[],
  rng: () => number
): { success: boolean; error?: string } {
  if (state.status !== "mulligan") return { success: false, error: "Not in mulligan phase" };

  // Use the explicitly provided playerId (for AI), otherwise fall back to activePlayerId
  const mulliganPlayerId = action.playerId ?? state.activePlayerId;
  if (state.pendingMulligan[mulliganPlayerId]) return { success: false, error: "Already mulliganed" };

  const player = state.players[mulliganPlayerId]!;
  state.pendingMulligan[mulliganPlayerId] = true;

  // Replace cards not in keepInstanceIds
  const toKeep = new Set(action.keepInstanceIds);
      const newHand: Card[] = [];
      const returned: Card[] = [];

      for (const card of player.hand) {
        const instId = (card as Card & { instanceId?: string }).instanceId;
        if (instId && toKeep.has(instId)) {
          newHand.push(card);
        } else {
          returned.push(card);
        }
      }

      // Shuffle returned cards back into deckPile at random positions
      for (const card of returned) {
        const insertIdx = Math.floor(rng() * (player.deckPile.length + 1));
        player.deckPile.splice(insertIdx, 0, card);
      }
      // Draw replacements from the actual deckPile
      for (let i = 0; i < returned.length; i++) {
        if (player.deckPile.length > 0) {
          newHand.push(player.deckPile.shift()!);
        }
      }
      player.deckCount = player.deckPile.length;
      player.hand = newHand;

  // Check if both players have mulliganed
  const allMulliganed = Object.values(state.pendingMulligan).every(Boolean);
  if (allMulliganed) {
    state.status = "in_progress";
    state.phase = "pump";
    // Start player 1's first turn
    startTurn(state, animations, rng);
  }

  return { success: true };
}

function handleDiscoverChoice(
  state: GameState,
  action: Extract<GameAction, { type: "discover_choice" }>,
  animations: AnimationHint[]
): { success: boolean; error?: string } {
  if (!state.pendingDiscover) return { success: false, error: "No active discover" };

  const pending = state.pendingDiscover;
  const player = state.players[pending.playerId]!;
  const chosen = pending.options.find((c) => c.id === action.cardId);
  if (!chosen) return { success: false, error: "Invalid discover choice" };

  const mode = pending.mode ?? "pool";

  if (mode === "reduce_cost") {
    // Gas Refund etc.: discount a card already in hand instead of adding one.
    const target = player.hand.find(
      (c) => c.id === action.cardId
    ) as (Card & { costModifier?: number }) | undefined;
    if (target) {
      target.costModifier = (target.costModifier ?? 0) + (pending.costModifier ?? 0);
    }
    state.pendingDiscover = null;
    animations.push({ type: "discover", data: { cardId: action.cardId } });
    return { success: true };
  }

  if (mode === "resurrect") {
    // Pull the chosen minion out of the burn pile and summon it with any buffs.
    const idx = player.burnPile.findIndex((c) => c.id === action.cardId && c.type === "minion");
    const card = idx !== -1 ? player.burnPile.splice(idx, 1)[0]! : deepClone(chosen);
    summonResurrectedMinion(player, card, pending.resurrect ?? {}, animations);
  } else {
    // "salvage" removes the chosen card from the burn pile; "pool" adds a fresh copy.
    if (mode === "salvage") {
      const idx = player.burnPile.findIndex((c) => c.id === action.cardId);
      if (idx !== -1) player.burnPile.splice(idx, 1);
    }
    if (player.hand.length < 10) {
      const clone = { ...deepClone(chosen), instanceId: nextInstanceId() } as Card & { instanceId: string; costModifier?: number };
      if (pending.costModifier) clone.costModifier = (clone.costModifier ?? 0) + pending.costModifier;
      player.hand.push(clone);
    }
  }

  state.pendingDiscover = null;
  animations.push({ type: "discover", data: { cardId: action.cardId } });

  return { success: true };
}

function handlePlayCard(
  state: GameState,
  action: Extract<GameAction, { type: "play_card" }>,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): { success: boolean; error?: string } {
  const activePlayer = state.players[state.activePlayerId]!;
  const opponentId = getOpponentId(state);
  const opponent = state.players[opponentId]!;

  // Find card in hand
  const cardIdx = activePlayer.hand.findIndex(
    (c) => (c as Card & { instanceId?: string }).instanceId === action.cardInstanceId
  );
  if (cardIdx === -1) return { success: false, error: "Card not in hand" };

  const card = activePlayer.hand[cardIdx]!;
  const cost = getEffectiveCost(card, activePlayer);
  const totalMana = activePlayer.mana + activePlayer.tempMana;

  if (totalMana < cost) return { success: false, error: "Not enough Gas" };

  // Validate the chosen target BEFORE spending mana / committing the card
  const targeting = getPlayCardTargets(
    card,
    activePlayer.board,
    opponent.board,
    "hero_" + state.activePlayerId,
    "hero_" + opponentId
  );
  if (targeting.needsTarget) {
    if (targeting.validIds.length === 0) {
      return { success: false, error: "No valid target" };
    }
    if (!action.targetInstanceId || !targeting.validIds.includes(action.targetInstanceId)) {
      return { success: false, error: "Invalid target" };
    }
  }

  // Deduct mana (temp first)
  if (activePlayer.tempMana >= cost) {
    activePlayer.tempMana -= cost;
  } else {
    const remaining = cost - activePlayer.tempMana;
    activePlayer.tempMana = 0;
    activePlayer.mana -= remaining;
  }

  // Remove from hand
  activePlayer.hand.splice(cardIdx, 1);

  const ctx: EffectContext = {
    state,
    activePlayerId: state.activePlayerId,
    sourceCard: card,
    targetInstanceId: action.targetInstanceId,
    animations,
    rng,
    cardRegistry,
    coinFlip: rng() < 0.5 ? "heads" : "tails",
  } as EffectContext & { cardRegistry?: Map<string, Card> };

  // "Flip a coin" cards emit a coin animation so the client can play a flip
  // reveal before the outcome is shown.
  const hasCoinFlip = (card.effects ?? []).some(
    (e) => e.params?.condition === "coin_heads" || e.params?.condition === "coin_tails"
  );
  if (hasCoinFlip) {
    animations.push({
      type: "coin_flip",
      data: { result: ctx.coinFlip, playerId: state.activePlayerId, cardId: card.id },
    });
  }

  switch (card.type) {
    case "minion": {
      const boardPosition = action.boardPosition ?? findEmptySlot(activePlayer.board);
      if (boardPosition === -1 || boardPosition > 6) return { success: false, error: "Board is full" };
      if (activePlayer.board[boardPosition] !== null && boardPosition !== findEmptySlot(activePlayer.board)) {
        return { success: false, error: "Board slot occupied" };
      }

      const slot = createMinionSlot(card);

      // Apply Solana faction bonus
      if (activePlayer.factionBonusActive && activePlayer.factionBonus === "solana" && !activePlayer.firstMinionPlayed) {
        slot.hasCharge = true;
        slot.summoningSickness = false;
        activePlayer.firstMinionPlayed = true;
      }

      // Apply volatility
      const volatilityKw = card.keywords?.find((k) => k.id === "volatility");
      if (volatilityKw?.params) {
        const result = applyVolatility(slot.currentAttack, slot.currentHealth, volatilityKw.params as { attack_variance?: number; health_variance?: number }, rng);
        slot.currentAttack = result.attack;
        slot.currentHealth = result.health;
        slot.maxHealth = result.health;
      }

      const actualSlot = findEmptySlot(activePlayer.board);
      activePlayer.board[actualSlot !== -1 ? actualSlot : boardPosition] = slot;

      ctx.sourceInstanceId = slot.instanceId;
      animations.push({
        type: "play_card",
        data: { cardId: card.id, boardIndex: actualSlot, playerId: activePlayer.playerId, instanceId: slot.instanceId },
      });

      // Battlecry
      if (card.keywords?.some((k) => k.id === "battlecry")) {
        resolveEffects(card.effects ?? [], "on_play", ctx);
      } else {
        resolveEffects(card.effects ?? [], "on_play", ctx);
      }

      // Echo
      if (card.keywords?.some((k) => k.id === "echo")) {
        const echoCopy = deepClone(card);
        echoCopy.cost = Math.max(1, card.cost + 1);
        (echoCopy as Card & { instanceId: string; isEchoCopy: boolean }).instanceId = nextInstanceId();
        (echoCopy as Card & { instanceId: string; isEchoCopy: boolean }).isEchoCopy = true;
        if (activePlayer.hand.length < 10) {
          activePlayer.hand.push(echoCopy as Card & { instanceId: string });
        }
      }

      // Reset first-minion-played flag (no-op in this context)
      break;
    }

    case "spell": {
      // Handle Coin
      if (card.id === "coin") {
        activePlayer.tempMana = Math.min(1, activePlayer.tempMana + 1);
        activePlayer.hand.splice(cardIdx, 1); // already removed above
        animations.push({ type: "spell_cast", data: { cardId: card.id, playerId: activePlayer.playerId, card } });
        break;
      }

      // Ethereum faction bonus: first spell each turn costs 1 less (already applied in getEffectiveCost)
      if (activePlayer.factionBonusActive && activePlayer.factionBonus === "ethereum" && activePlayer.firstSpellDiscounted) {
        activePlayer.firstSpellDiscounted = false;
      }

      resolveEffects(card.effects ?? [], "on_play", ctx);
      activePlayer.burnPile.unshift(card);
      animations.push({ type: "spell_cast", data: { cardId: card.id, playerId: activePlayer.playerId, card } });

      // Opponent's board minions may react to us casting a spell (e.g. MEV Bot:
      // "Whenever your opponent plays a spell, deal 1 damage to their Hero.").
      for (const slot of [...opponent.board]) {
        if (!slot) continue;
        if (!(slot.card.effects ?? []).some((e) => e.trigger === "on_opponent_spell")) continue;
        const reactCtx: EffectContext = {
          state,
          activePlayerId: opponentId,
          sourceCard: slot.card,
          animations,
          rng,
          cardRegistry,
        } as EffectContext & { cardRegistry?: Map<string, Card> };
        resolveEffects(slot.card.effects ?? [], "on_opponent_spell", reactCtx);
      }
      break;
    }

    case "weapon": {
      // Replace old weapon
      if (activePlayer.hasWeapon && activePlayer.weaponCard) {
        activePlayer.burnPile.unshift(activePlayer.weaponCard);
      }
      activePlayer.hasWeapon = true;
      activePlayer.weaponCard = card;
      activePlayer.weaponAttack = card.attack ?? 0;
      activePlayer.weaponDurability = card.durability ?? 0;
      resolveEffects(card.effects ?? [], "on_equip", ctx);
      animations.push({ type: "play_card", data: { cardId: card.id, isWeapon: true } });
      break;
    }

    case "location": {
      if (activePlayer.locations.length >= 2) return { success: false, error: "Both location slots are full" };
      activePlayer.locations.push({ card, durability: card.durability ?? 0, usedThisTurn: false });
      animations.push({ type: "play_card", data: { cardId: card.id, isLocation: true } });
      break;
    }

    case "hero": {
      // Hero card played mid-game — replaces the player's hero identity (portrait,
      // name, faction) and hero power, grants armor, and keeps current HP.
      activePlayer.armor += card.armor ?? 0;
      if ((card.armor ?? 0) > 0) {
        animations.push({
          type: "armor_gain",
          data: { playerId: activePlayer.playerId, amount: card.armor ?? 0, sourceId: "hero_" + activePlayer.playerId },
        });
      }
      activePlayer.heroId = card.id;
      activePlayer.heroName = card.name;
      activePlayer.heroFaction = card.faction;
      if (card.hero_power) {
        activePlayer.heroPower = card.hero_power;
        activePlayer.heroPowerUsed = false;
      }
      resolveEffects(card.effects ?? [], "on_play", ctx);
      activePlayer.burnPile.unshift(card);
      animations.push({ type: "play_card", data: { cardId: card.id, isHeroCard: true } });
      break;
    }
  }

  // After playing a spell with Ethereum bonus, reset discount flag
  if (card.type === "spell" && activePlayer.factionBonusActive && activePlayer.factionBonus === "ethereum") {
    activePlayer.firstSpellDiscounted = false;
  }

  return { success: true };
}

function handleAttack(
  state: GameState,
  action: Extract<GameAction, { type: "attack" }>,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): { success: boolean; error?: string } {
  const activePlayer = state.players[state.activePlayerId]!;
  const opponentId = getOpponentId(state);
  const opponent = state.players[opponentId]!;

  const isHeroAttack = action.attackerInstanceId.startsWith("hero_");
  const isTargetHero = action.defenderInstanceId.startsWith("hero_");

  if (isHeroAttack) {
    if (!activePlayer.hasWeapon) return { success: false, error: "No weapon equipped" };
    if (activePlayer.heroHasAttacked) return { success: false, error: "Hero already attacked this turn" };

    // Validate taunt targeting
    if (!isTargetHero) {
      const tauntMinions = opponent.board.filter((s): s is MinionSlot => s !== null && s.hasTaunt);
      if (tauntMinions.length > 0 && !tauntMinions.some((m) => m.instanceId === action.defenderInstanceId)) {
        return { success: false, error: "Must attack a HODL minion" };
      }
    }

    if (isTargetHero) {
      const tauntMinions = opponent.board.filter((s): s is MinionSlot => s !== null && s.hasTaunt);
      if (tauntMinions.length > 0) return { success: false, error: "Must attack a HODL minion first" };
      const result = resolveHeroAttacksHero(activePlayer, opponent);
      animations.push(...result.animations);
    } else {
      const defenderSlot = findMinionOnBoard(action.defenderInstanceId, opponent.board);
      if (!defenderSlot) return { success: false, error: "Target not found" };
      const defenderPrevHp = defenderSlot.currentHealth;
      const result = resolveHeroAttacksMinion(activePlayer, defenderSlot);
      animations.push(...result.animations);
      if (defenderSlot.currentHealth < defenderPrevHp) {
        fireTakeDamageTriggers(state, defenderSlot, opponentId, animations, rng, cardRegistry);
      }
    }
  } else {
    // Minion attack
    const attackerSlot = findMinionOnBoard(action.attackerInstanceId, activePlayer.board);
    if (!attackerSlot) return { success: false, error: "Attacker not found" };
    if (attackerSlot.hasAttacked) return { success: false, error: "Minion already attacked this turn" };
    if (attackerSlot.frozen) return { success: false, error: "Minion is frozen" };
    if (attackerSlot.summoningSickness && !attackerSlot.hasCharge) return { success: false, error: "Summoning sickness" };

    // Validate taunt targeting
    const tauntMinions = opponent.board.filter((s): s is MinionSlot => s !== null && s.hasTaunt);
    if (tauntMinions.length > 0 && !isTargetHero) {
      if (!tauntMinions.some((m) => m.instanceId === action.defenderInstanceId)) {
        return { success: false, error: "Must attack a HODL minion" };
      }
    } else if (isTargetHero && tauntMinions.length > 0) {
      return { success: false, error: "Must attack a HODL minion first" };
    }

    if (isTargetHero) {
      const result = resolveMinionAttacksHero(attackerSlot, opponent);
      animations.push(...result.animations);
      // Lifesteal
      for (const lh of result.lifestealHealing) {
        activePlayer.hp = Math.min(activePlayer.maxHp, activePlayer.hp + lh.amount);
        animations.push({ type: "heal", data: { playerId: activePlayer.playerId, amount: lh.amount, sourceId: attackerSlot.instanceId, targetId: `hero_${activePlayer.playerId}` } });
      }
    } else {
      const defenderSlot = findMinionOnBoard(action.defenderInstanceId, opponent.board);
      if (!defenderSlot) return { success: false, error: "Defender not found" };

      const attackerPrevHp = attackerSlot.currentHealth;
      const defenderPrevHp = defenderSlot.currentHealth;
      const result = resolveMinionAttack(attackerSlot, defenderSlot, activePlayer, opponent);
      animations.push(...result.animations);

      // Apply lifesteal
      for (const lh of result.lifestealHealing) {
        const player = state.players[lh.playerId];
        if (player) {
          player.hp = Math.min(player.maxHp, player.hp + lh.amount);
          const lifestealSourceId = lh.playerId === activePlayer.playerId ? attackerSlot.instanceId : defenderSlot.instanceId;
          animations.push({ type: "heal", data: { playerId: lh.playerId, amount: lh.amount, sourceId: lifestealSourceId, targetId: `hero_${lh.playerId}` } });
        }
      }

      // "Whenever this takes damage and survives…" reactions for both combatants.
      if (defenderSlot.currentHealth < defenderPrevHp) {
        fireTakeDamageTriggers(state, defenderSlot, opponentId, animations, rng, cardRegistry);
      }
      if (attackerSlot.currentHealth < attackerPrevHp) {
        fireTakeDamageTriggers(state, attackerSlot, state.activePlayerId, animations, rng, cardRegistry);
      }
    }
  }

  return { success: true };
}

function handleHeroPower(
  state: GameState,
  action: Extract<GameAction, { type: "hero_power" }>,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): { success: boolean; error?: string } {
  const activePlayer = state.players[state.activePlayerId]!;
  const opponentId = getOpponentId(state);
  const opponent = state.players[opponentId]!;

  const cost = activePlayer.heroPower.cost;
  if (activePlayer.mana + activePlayer.tempMana < cost) {
    return { success: false, error: "Not enough Gas for Hero Power" };
  }

  // Guard: a burn-pile discover (e.g. Salvage) with an empty burn pile would
  // silently do nothing — reject it so the power/mana isn't wasted.
  if (
    activePlayer.heroPower.effect_type === "discover" &&
    (activePlayer.heroPower.effect_params?.from as string | undefined) === "burn_pile" &&
    activePlayer.burnPile.length === 0
  ) {
    return { success: false, error: "Your burn pile is empty" };
  }

  // Deduct mana
  if (activePlayer.tempMana >= cost) {
    activePlayer.tempMana -= cost;
  } else {
    const remaining = cost - activePlayer.tempMana;
    activePlayer.tempMana = 0;
    activePlayer.mana -= remaining;
  }

  activePlayer.heroPowerUsed = true;

  const hp = activePlayer.heroPower;
  const targetPlayer = action.targetInstanceId?.startsWith("hero_") ? opponent : activePlayer;

  switch (hp.effect_type) {
    case "add_to_hand": {
      const cardId = (hp.effect_params.card_id as string) ?? "";
      const count = (hp.effect_params.count as number) ?? 1;
      if (cardRegistry) {
        const template = cardRegistry.get(cardId);
        if (template) {
          for (let i = 0; i < count; i++) {
            if (activePlayer.hand.length < 10) {
              activePlayer.hand.push({ ...deepClone(template), instanceId: nextInstanceId() } as Card & { instanceId: string });
            }
          }
        }
      }
      break;
    }
    case "add_to_hand_random": {
      const filter = hp.effect_params.filter as string;
      if (cardRegistry) {
        const pool = Array.from(cardRegistry.values()).filter((c) => {
          const parts = filter.split(",");
          return parts.every((p) => {
            const [k, v] = p.split(":");
            if (k?.trim() === "type") return c.type === v?.trim();
            if (k?.trim() === "faction") return c.faction === v?.trim();
            return true;
          });
        });
        if (pool.length > 0) {
          const chosen = pool[Math.floor(rng() * pool.length)]!;
          if (activePlayer.hand.length < 10) {
            activePlayer.hand.push({ ...deepClone(chosen), instanceId: nextInstanceId() } as Card & { instanceId: string });
          }
        }
      }
      break;
    }
    case "heal": {
      const amount = hp.effect_params.amount as number;
      activePlayer.hp = Math.min(activePlayer.maxHp, activePlayer.hp + amount);
      animations.push({
        type: "heal",
        data: {
          playerId: activePlayer.playerId,
          amount,
          targetId: "hero_" + activePlayer.playerId,
          sourceId: "hero_" + activePlayer.playerId,
        },
      });
      break;
    }
    case "buff_attack": {
      const amount = hp.effect_params.amount as number;
      if (action.targetInstanceId && !action.targetInstanceId.startsWith("hero_")) {
        const slot = findMinionOnBoard(action.targetInstanceId, activePlayer.board);
        if (slot) {
          const duration = hp.effect_params.duration as string;
          if (duration === "this_turn") {
            slot.tempAttackBoost = (slot.tempAttackBoost ?? 0) + amount;
          } else {
            slot.currentAttack += amount;
          }
          animations.push({
            type: "effect_vfx",
            data: {
              kind: "buff",
              sourceId: "hero_" + activePlayer.playerId,
              targetId: action.targetInstanceId,
            },
          });
        }
      }
      break;
    }
    case "deal_damage": {
      const amount = hp.effect_params.amount as number;
      const result = applyDamageWithArmor(activePlayer.hp, activePlayer.armor, amount);
      activePlayer.hp = result.hp;
      activePlayer.armor = result.armor;
      drawCard(activePlayer, animations);
      animations.push({ type: "spell_cast", data: { damage: amount, playerId: activePlayer.playerId } });
      break;
    }
    case "modify_cost": {
      activePlayer.firstSpellDiscounted = true;
      break;
    }
    case "multi": {
      const actions = hp.effect_params.actions as Array<{ type: string; target: string; amount: number }>;
      for (const a of actions) {
        if (a.type === "deal_damage" && a.target === "hero_friendly") {
          const result = applyDamageWithArmor(activePlayer.hp, activePlayer.armor, a.amount);
          activePlayer.hp = result.hp;
          activePlayer.armor = result.armor;
        } else if (a.type === "draw_cards") {
          drawCard(activePlayer, animations);
        }
      }
      break;
    }
    case "discover": {
      const from = hp.effect_params.from as string | undefined;
      const count = (hp.effect_params.count as number) ?? 3;
      if (from === "burn_pile") {
        // "Salvage": look at the top N of your burn pile and add one to hand.
        const options = activePlayer.burnPile.slice(0, count);
        if (options.length > 0) {
          state.pendingDiscover = {
            playerId: state.activePlayerId,
            options: options.map((c) => deepClone(c)),
            sourceCardId: hp.id,
            mode: "salvage",
            prompt: "Salvage a card from your burn pile",
          };
        }
      } else {
        const filter = hp.effect_params.filter as string | undefined;
        if (filter && cardRegistry) {
          const pool = Array.from(cardRegistry.values()).filter((c) => {
            const parts = filter.split(",");
            return parts.every((p) => {
              const [k, v] = p.split(":");
              if (k?.trim() === "type") return c.type === v?.trim();
              if (k?.trim() === "faction") return c.faction === v?.trim();
              if (k?.trim() === "rarity") return c.rarity === v?.trim();
              return true;
            }) && c.collectible;
          });
          const shuffled = [...pool].sort(() => rng() - 0.5).slice(0, 3);
          if (shuffled.length > 0) {
            state.pendingDiscover = {
              playerId: state.activePlayerId,
              options: shuffled.map((c) => deepClone(c)),
              sourceCardId: hp.id,
              mode: "pool",
            };
          }
        }
      }
      break;
    }
  }

  return { success: true };
}

function handleTapLocation(
  state: GameState,
  index: number,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): { success: boolean; error?: string } {
  const activePlayer = state.players[state.activePlayerId]!;
  const loc = activePlayer.locations[index];
  if (!loc) return { success: false, error: "No location" };
  const card = loc.card;

  const ctx: EffectContext = {
    state,
    activePlayerId: state.activePlayerId,
    sourceCard: card,
    animations,
    rng,
    cardRegistry,
  } as EffectContext & { cardRegistry?: Map<string, Card> };

  resolveEffects(card.effects ?? [], "on_tap", ctx);

  loc.durability -= 1;
  loc.usedThisTurn = true;

  if (loc.durability <= 0) {
    activePlayer.burnPile.unshift(card);
    activePlayer.locations.splice(index, 1);
  }

  return { success: true };
}

function handleEndTurn(
  state: GameState,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): { success: boolean; error?: string } {
  const activePlayer = state.players[state.activePlayerId]!;
  const opponentId = getOpponentId(state);
  const opponent = state.players[opponentId]!;

  // End of turn effects
  for (const slot of activePlayer.board) {
    if (!slot) continue;
    const ctx: EffectContext = {
      state,
      activePlayerId: state.activePlayerId,
      sourceCard: slot.card,
      sourceInstanceId: slot.instanceId,
      animations,
      rng,
      cardRegistry,
    } as EffectContext & { cardRegistry?: Map<string, Card> };
    resolveEffects(slot.card.effects ?? [], "end_of_turn", ctx);
  }

  // Clear temp attack boosts
  for (const slot of activePlayer.board) {
    if (slot) slot.tempAttackBoost = 0;
  }

  // Echo copies expire at end of turn
  activePlayer.hand = activePlayer.hand.filter(
    (c) => !(c as Card & { isEchoCopy?: boolean }).isEchoCopy
  );

  // Discard to 10
  if (activePlayer.hand.length > 10) {
    activePlayer.hand = activePlayer.hand.slice(0, 10);
  }

  // Vesting effects (delayed) fire at start of NEXT turn — schedule
  // (They'll fire at start of next pump phase)

  // Gas spike from Ethereum expires
  if (activePlayer.gasSpikeModifier > 0) {
    // Actually Ethereum gas spike lasts until end of opponent's NEXT turn
    // Tracked via flag — simplified here
  }

  // Reset locations for this player (usable again on their next turn)
  for (const loc of activePlayer.locations) loc.usedThisTurn = false;

  // Switch active player
  state.activePlayerId = opponentId;
  state.phase = "pump";

  // Start opponent's turn
  startTurn(state, animations, rng);

  return { success: true };
}

function handleDiscardToTen(
  state: GameState,
  action: Extract<GameAction, { type: "discard_to_ten" }>
): { success: boolean; error?: string } {
  const player = state.players[state.activePlayerId]!;
  const toDiscard = new Set(action.discardInstanceIds);

  player.hand = player.hand.filter(
    (c) => !toDiscard.has((c as Card & { instanceId?: string }).instanceId ?? "")
  );
  return { success: true };
}

function startTurn(state: GameState, animations: AnimationHint[], rng: () => number): void {
  const activePlayer = state.players[state.activePlayerId]!;

  // Pump phase
  state.phase = "pump";
  state.turnNumber++;

  activePlayer.maxMana = Math.min(10, activePlayer.maxMana + 1);
  activePlayer.mana = activePlayer.maxMana;
  activePlayer.tempMana = 0;
  activePlayer.heroPowerUsed = false;
  activePlayer.heroHasAttacked = false;
  activePlayer.firstSpellDiscounted = false;
  activePlayer.firstMinionPlayed = false;

  // Remove summoning sickness from minions that survived a turn
  for (const slot of activePlayer.board) {
    if (slot) {
      slot.summoningSickness = false;
      slot.hasAttacked = false;
      // Thaw frozen minions: they miss their controller's turns until the counter runs out.
      if (slot.frozen) {
        slot.frozenTurns = (slot.frozenTurns ?? 1) - 1;
        if (slot.frozenTurns <= 0) {
          slot.frozen = false;
          slot.frozenTurns = 0;
        }
      }
    }
  }

  // Start of turn effects
  for (const slot of activePlayer.board) {
    if (!slot) continue;
    const ctx: EffectContext = {
      state,
      activePlayerId: state.activePlayerId,
      sourceCard: slot.card,
      sourceInstanceId: slot.instanceId,
      animations,
      rng,
    };
    resolveEffects(slot.card.effects ?? [], "start_of_turn", ctx);
  }

  // Vesting effects
  const vestingToFire = state.vestingEffects.filter(
    (v) => v.playerId === state.activePlayerId
  );
  for (const vesting of vestingToFire) {
    const ctx: EffectContext = {
      state,
      activePlayerId: state.activePlayerId,
      sourceCard: { id: vesting.sourceCardId } as Card,
      animations,
      rng,
    };
    // Resolve the vesting effect action
  }
  state.vestingEffects = state.vestingEffects.filter(
    (v) => !vestingToFire.includes(v)
  );

  // Meme faction bonus: coin flip at start of turn
  if (activePlayer.factionBonusActive && activePlayer.factionBonus === "meme") {
    const flip = rng() > 0.5;
    if (flip) {
      // Heads: draw an extra card. Mark the bonus so the UI can explain the 2nd draw.
      animations.push({ type: "draw", data: { memeBonus: "extra_draw", playerId: activePlayer.playerId } });
      drawCard(activePlayer, animations);
    } else {
      activePlayer.heroPowerUsed = false; // Free hero power this turn (cost 0)
      animations.push({ type: "spell_cast", data: { memeBonus: "free_hero_power", playerId: activePlayer.playerId } });
    }
  }

  // Draw phase
  state.phase = "draw";
  drawCard(activePlayer, animations);

  // Main phase
  state.phase = "main";
}

function processDeaths(
  state: GameState,
  animations: AnimationHint[],
  rng: () => number,
  cardRegistry?: Map<string, Card>
): void {
  const deadMinions: Array<{ slot: MinionSlot; playerId: string; boardIdx: number }> = [];

  for (const [playerId, player] of Object.entries(state.players)) {
    for (let i = 0; i < player.board.length; i++) {
      const slot = player.board[i];
      if (slot && slot.currentHealth <= 0) {
        deadMinions.push({ slot, playerId, boardIdx: i });
        player.board[i] = null;
      }
    }
  }

  // Process deathrattles in play order
  for (const { slot, playerId } of deadMinions) {
    const player = state.players[playerId]!;
    // Tag the card with the turn it died so "died this turn" resurrects can find it.
    (slot.card as Card & { diedOnTurn?: number }).diedOnTurn = state.turnNumber;
    player.burnPile.unshift(slot.card);

    animations.push({ type: "death", data: { instanceId: slot.instanceId, cardId: slot.card.id } });

    if (!slot.isSilenced) {
      const ctx: EffectContext = {
        state,
        activePlayerId: playerId,
        sourceCard: slot.card,
        sourceInstanceId: slot.instanceId,
        animations,
        rng,
        cardRegistry,
      } as EffectContext & { cardRegistry?: Map<string, Card> };
      resolveEffects(slot.card.effects ?? [], "on_death", ctx);
    }

    // Fire "whenever a friendly minion dies" for that player's surviving minions.
    for (const survivor of player.board) {
      if (!survivor || survivor.isSilenced) continue;
      const ctx: EffectContext = {
        state,
        activePlayerId: playerId,
        sourceCard: survivor.card,
        sourceInstanceId: survivor.instanceId,
        targetInstanceId: survivor.instanceId,
        animations,
        rng,
        cardRegistry,
      } as EffectContext & { cardRegistry?: Map<string, Card> };
      resolveEffects(survivor.card.effects ?? [], "on_friendly_minion_death", ctx);
    }
  }

  // Check weapon durability after deaths
  for (const player of Object.values(state.players)) {
    if (player.hasWeapon && player.weaponDurability <= 0) {
      if (player.weaponCard) {
        player.burnPile.unshift(player.weaponCard);

        // Weapon deathrattle
        const ctx: EffectContext = {
          state,
          activePlayerId: player.playerId,
          sourceCard: player.weaponCard,
          animations,
          rng,
        };
        resolveEffects(player.weaponCard.effects ?? [], "on_death", ctx);
      }
      player.weaponCard = null;
      player.hasWeapon = false;
      player.weaponAttack = 0;
      player.weaponDurability = 0;
    }
  }
}

function checkWinCondition(state: GameState, animations: AnimationHint[]): void {
  for (const [playerId, player] of Object.entries(state.players)) {
    if (player.hp <= 0) {
      const winnerId = Object.keys(state.players).find((id) => id !== playerId)!;
      state.status = "finished";
      state.winner = winnerId;
      state.endReason = "hero_death";
      animations.push({ type: "game_over", data: { winner: winnerId, loser: playerId } });
    }
  }
}

function findMinionOnBoard(instanceId: string, board: (MinionSlot | null)[]): MinionSlot | null {
  return board.find((s): s is MinionSlot => s !== null && s.instanceId === instanceId) ?? null;
}

function getOpponentId(state: GameState): string {
  return Object.keys(state.players).find((id) => id !== state.activePlayerId)!;
}

/** Sanitize state for a specific player — hide opponent's hand */
export function sanitizeState(state: GameState, playerId: string): SanitizedGameState {
  const opponentId = Object.keys(state.players).find((id) => id !== playerId)!;
  const opponentState = state.players[opponentId]!;

  const opponentView: OpponentView = {
    playerId: opponentId,
    playerName: opponentState.playerName,
    heroId: opponentState.heroId,
    heroName: opponentState.heroName,
    heroFaction: opponentState.heroFaction,
    hp: opponentState.hp,
    maxHp: opponentState.maxHp,
    armor: opponentState.armor,
    mana: opponentState.mana,
    maxMana: opponentState.maxMana,
    heroPowerUsed: opponentState.heroPowerUsed,
    hasWeapon: opponentState.hasWeapon,
    weaponAttack: opponentState.weaponAttack,
    weaponDurability: opponentState.weaponDurability,
    heroHasAttacked: opponentState.heroHasAttacked,
    locations: opponentState.locations,
    board: opponentState.board,
    handCount: opponentState.hand.length,
    deckCount: opponentState.deckCount,
    burnPile: opponentState.burnPile,
    secretCount: opponentState.secrets.length,
    factionBonusActive: opponentState.factionBonusActive,
    // Overridden by the server (room.buildSanitizedState) with the opponent's equipped back.
    cardBack: null,
  };

  return {
    gameId: state.gameId,
    status: state.status,
    phase: state.phase,
    turnNumber: state.turnNumber,
    activePlayerId: state.activePlayerId,
    myState: state.players[playerId]!,
    opponentState: opponentView,
    winner: state.winner,
    endReason: state.endReason,
    pendingTargetAction: state.pendingTargetAction,
    pendingDiscover: state.pendingDiscover?.playerId === playerId ? state.pendingDiscover : null,
    // Overridden by the server (room.buildSanitizedState) with the live deadline.
    turnTimerEndsAt: null,
  };
}

/** Simple AI: pick a random valid action */
export function getAIAction(state: GameState, aiPlayerId: string): GameAction {
  const player = state.players[aiPlayerId]!;
  const opponentId = Object.keys(state.players).find((id) => id !== aiPlayerId)!;
  const opponent = state.players[opponentId]!;

  // Resolve a pending discover/resurrect pick before anything else.
  if (state.pendingDiscover && state.pendingDiscover.playerId === aiPlayerId) {
    const opt = state.pendingDiscover.options[0];
    if (opt) return { type: "discover_choice", cardId: opt.id };
  }

  // Try playing cards
  const playableCards = player.hand.filter((c) => {
    const cost = getEffectiveCost(c, player);
    return cost <= player.mana + player.tempMana;
  });

  if (playableCards.length > 0) {
    const card = playableCards[0]!;
    const targeting = getPlayCardTargets(
      card,
      player.board,
      opponent.board,
      "hero_" + aiPlayerId,
      "hero_" + opponentId
    );
    const action: Extract<GameAction, { type: "play_card" }> = {
      type: "play_card",
      cardInstanceId: (card as Card & { instanceId: string }).instanceId,
    };
    if (targeting.needsTarget && targeting.validIds.length > 0) {
      // Prefer hitting an enemy minion/hero, otherwise take the first legal target
      const enemyIds = new Set([
        ...opponent.board.filter((s): s is MinionSlot => s !== null).map((s) => s.instanceId),
        "hero_" + opponentId,
      ]);
      action.targetInstanceId = targeting.validIds.find((id) => enemyIds.has(id)) ?? targeting.validIds[0]!;
    }
    return action;
  }

  // Try attacking with minions
  const attackers = player.board.filter(
    (s): s is MinionSlot =>
      s !== null && !s.hasAttacked && (!s.summoningSickness || s.hasCharge)
  );

  if (attackers.length > 0) {
    const attacker = attackers[0]!;
    const targets = getValidAttackTargets(
      attacker.instanceId,
      player.board,
      opponent.board,
      "hero_" + opponentId
    );
    if (targets.length > 0) {
      return {
        type: "attack",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: targets[0]!,
      };
    }
  }

  return { type: "end_turn" };
}
