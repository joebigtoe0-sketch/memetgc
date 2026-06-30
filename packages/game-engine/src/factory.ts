import type { Card, Faction } from "@memetgc/types";
import type { MinionSlot, PlayerState, GameState, SecretSlot } from "@memetgc/types";
import { nextInstanceId, shuffle, seededRng, deepClone } from "./utils.js";

export function createMinionSlot(card: Card): MinionSlot {
  return {
    instanceId: nextInstanceId(),
    card: deepClone(card),
    currentAttack: card.attack ?? 0,
    currentHealth: card.health ?? 1,
    maxHealth: card.health ?? 1,
    hasDivineShield: card.keywords?.some((k) => k.id === "divine_shield") ?? false,
    hasTaunt: card.keywords?.some((k) => k.id === "taunt") ?? false,
    hasCharge: card.keywords?.some((k) => k.id === "charge") ?? false,
    hasLifesteal: card.keywords?.some((k) => k.id === "lifesteal") ?? false,
    hasAttacked: false,
    summoningSickness: true,
    isSilenced: false,
    costModifier: 0,
    tempAttackBoost: 0,
  };
}

export function createSecretSlot(card: Card): SecretSlot {
  return {
    instanceId: nextInstanceId(),
    card: deepClone(card),
  };
}

export function createPlayerState(
  playerId: string,
  heroId: string,
  heroName: string,
  heroFaction: Faction,
  heroPower: PlayerState["heroPower"],
  deck: Card[],
  isPlayer1: boolean,
  seed: number
): PlayerState {
  const rng = seededRng(seed + (isPlayer1 ? 0 : 1));
  const shuffledDeck = shuffle([...deck], rng);

  // Faction bonus is tied to the HERO's faction, not the deck composition.
  // This keeps things sane when mixing heroes with off-faction / custom decks.
  const factionBonus = heroFaction;

  const handSize = isPlayer1 ? 3 : 4;
  const hand = shuffledDeck.splice(0, handSize);

  if (!isPlayer1) {
    // P2 gets the Coin
    hand.push({
      id: "coin",
      name: "The Coin",
      set: "tokens",
      type: "spell",
      faction: "degen",
      rarity: "common",
      cost: 0,
      text: "Gain 1 Gas this turn only.",
      collectible: false,
      craftable: false,
      dust_value: 0,
      craft_cost: 0,
    });
  }

  return {
    playerId,
    heroId,
    heroName,
    heroFaction,
    hp: 30,
    maxHp: 30,
    armor: factionBonus === "bitcoin" ? 5 : 0,
    mana: 0,
    maxMana: 0,
    tempMana: 0,
    fatigue: 0,
    heroPowerUsed: false,
    heroPower,
    hasWeapon: false,
    weaponCard: null,
    weaponAttack: 0,
    weaponDurability: 0,
    heroHasAttacked: false,
    locationCard: null,
    locationDurability: 0,
    locationUsedThisTurn: false,
    board: Array(7).fill(null),
    hand: hand.map((c) => ({ ...c, instanceId: nextInstanceId() } as Card & { instanceId: string })) as Card[],
    deckPile: shuffledDeck.map((c) => ({ ...c, instanceId: nextInstanceId() } as Card & { instanceId: string })) as Card[],
    deckCount: shuffledDeck.length,
    burnPile: [],
    secrets: [],
    factionBonus,
    factionBonusActive: true,
    firstSpellDiscounted: false,
    firstMinionHasCharge: false,
    firstMinionPlayed: false,
    gasSpikeModifier: 0,
    dailyDamageReceived: 0,
    packStats: {
      standard_packs_since_epic: 0,
      standard_packs_since_legendary: 0,
    },
  };
}

export function createGameState(
  gameId: string,
  player1: { id: string; heroId: string; heroName: string; heroFaction: Faction; heroPower: PlayerState["heroPower"]; deck: Card[] },
  player2: { id: string; heroId: string; heroName: string; heroFaction: Faction; heroPower: PlayerState["heroPower"]; deck: Card[] },
  seed = Date.now()
): GameState {
  const p1State = createPlayerState(player1.id, player1.heroId, player1.heroName, player1.heroFaction, player1.heroPower, player1.deck, true, seed);
  const p2State = createPlayerState(player2.id, player2.heroId, player2.heroName, player2.heroFaction, player2.heroPower, player2.deck, false, seed);

  return {
    gameId,
    status: "mulligan",
    phase: "pump",
    turnNumber: 0,
    activePlayerId: player1.id,
    players: {
      [player1.id]: p1State,
      [player2.id]: p2State,
    },
    pendingTargetAction: null,
    pendingDiscover: null,
    pendingMulligan: { [player1.id]: false, [player2.id]: false },
    mulliganChoices: { [player1.id]: [], [player2.id]: [] },
    winner: null,
    endReason: null,
    vestingEffects: [],
    actionLog: [],
    seed,
  };
}
