import type { Card, Faction } from "./card.js";
import type { HeroPower } from "./card.js";

export type TurnPhase = "pump" | "draw" | "main" | "end";
export type GameStatus = "waiting" | "mulligan" | "in_progress" | "finished";

export interface MinionSlot {
  instanceId: string;
  card: Card;
  currentAttack: number;
  currentHealth: number;
  maxHealth: number;
  hasDivineShield: boolean;
  hasTaunt: boolean;
  hasCharge: boolean;
  hasLifesteal: boolean;
  hasAttacked: boolean;
  summoningSickness: boolean;
  isSilenced: boolean;
  costModifier: number;
  tempAttackBoost: number;
  /** Frozen minions cannot attack. Thaws after `frozenTurns` of the owner's turns. */
  frozen?: boolean;
  frozenTurns?: number;
}

export interface SecretSlot {
  instanceId: string;
  card: Card;
}

export interface LocationSlot {
  card: Card;
  durability: number;
  usedThisTurn: boolean;
}

export interface PlayerState {
  playerId: string;
  playerName: string;
  heroId: string;
  heroName: string;
  heroFaction: Faction;
  hp: number;
  maxHp: number;
  armor: number;
  mana: number;
  maxMana: number;
  tempMana: number;
  fatigue: number;
  heroPowerUsed: boolean;
  heroPower: HeroPower;
  hasWeapon: boolean;
  weaponCard: Card | null;
  weaponAttack: number;
  weaponDurability: number;
  heroHasAttacked: boolean;
  /** Up to 2 location cards, played to the board and tapped once per turn. */
  locations: LocationSlot[];
  board: (MinionSlot | null)[];
  hand: Card[];
  deckPile: Card[];
  deckCount: number;
  /** When true, the top card of deckPile is revealed to the owner until it is drawn. */
  topDeckRevealed?: boolean;
  burnPile: Card[];
  secrets: SecretSlot[];
  factionBonus: Faction | null;
  factionBonusActive: boolean;
  firstSpellDiscounted: boolean;
  firstMinionHasCharge: boolean;
  firstMinionPlayed: boolean;
  gasSpikeModifier: number;
  dailyDamageReceived: number;
  packStats: PlayerPackStats;
}

export interface PlayerPackStats {
  standard_packs_since_epic: number;
  standard_packs_since_legendary: number;
}

export interface GameState {
  gameId: string;
  status: GameStatus;
  phase: TurnPhase;
  turnNumber: number;
  activePlayerId: string;
  players: Record<string, PlayerState>;
  pendingTargetAction: PendingAction | null;
  pendingDiscover: PendingDiscover | null;
  pendingMulligan: Record<string, boolean>;
  mulliganChoices: Record<string, Card[]>;
  winner: string | null;
  endReason: string | null;
  vestingEffects: VestingEffect[];
  actionLog: ActionLogEntry[];
  seed: number;
}

export interface PendingAction {
  type: "targeted_spell" | "battlecry_target" | "hero_attack" | "discover";
  sourceInstanceId?: string;
  sourceCardId: string;
  validTargets: string[];
  effectIndex?: number;
}

export interface PendingDiscover {
  playerId: string;
  options: Card[];
  sourceCardId: string;
  /**
   * How the chosen card is applied:
   * - "pool" (default): add a fresh copy to hand (generic discover)
   * - "salvage": remove the chosen card from the burn pile and add it to hand
   * - "resurrect": remove the chosen minion from the burn pile and summon it
   */
  mode?: "pool" | "salvage" | "resurrect";
  /** UI heading shown above the options. */
  prompt?: string;
  /** Cost modifier applied to the card added to hand (e.g. -3 cheaper, +1 costlier). */
  costModifier?: number;
  /** Post-summon buffs when mode === "resurrect". */
  resurrect?: {
    buffAttack?: number;
    buffHealth?: number;
    giveDivineShield?: boolean;
    giveMoonShot?: boolean;
    restoreStats?: boolean;
  };
}

export interface VestingEffect {
  playerId: string;
  effect: import("./card.js").CardEffect;
  sourceCardId: string;
  instanceId: string;
}

export interface ActionLogEntry {
  turn: number;
  playerId: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export type GameAction =
  | { type: "play_card"; cardInstanceId: string; targetInstanceId?: string; boardPosition?: number }
  | { type: "attack"; attackerInstanceId: string; defenderInstanceId: string }
  | { type: "hero_power"; targetInstanceId?: string }
  | { type: "end_turn" }
  | { type: "mulligan"; keepInstanceIds: string[]; playerId?: string }
  | { type: "surrender"; playerId?: string }
  | { type: "discover_choice"; cardId: string }
  | { type: "discard_to_ten"; discardInstanceIds: string[] }
  | { type: "tap_location"; index?: number };

export interface AnimationHint {
  type:
    | "play_card"
    | "attack"
    | "spell_cast"
    | "death"
    | "heal"
    | "armor_gain"
    | "draw"
    | "discover"
    | "peek"
    | "coin_flip"
    | "shuffle_to_deck"
    | "secret_trigger"
    | "game_over";
  data: Record<string, unknown>;
}

export interface ServerToClientEvents {
  "game:state_update": (state: SanitizedGameState) => void;
  "game:action_result": (result: { success: boolean; error?: string; animations?: AnimationHint[] }) => void;
  "game:game_over": (result: { winner: string; reason: string; fragments?: number }) => void;
  "game:rank_update": (result: { delta: number; points: number; tier: string; stars: number }) => void;
  "game:discover": (options: { cards: Card[]; sourceCardId: string }) => void;
  "game:error": (message: string) => void;
  "match:found": (matchId: string) => void;
  "queue:status": (status: { queueSize: number; estimatedWait: number }) => void;
}

export interface ClientToServerEvents {
  "game:action": (action: GameAction) => void;
  "queue:join": (opts: { mode: "practice" | "casual" | "ranked"; deckId: string; heroId: string }) => void;
  "queue:leave": () => void;
}

/** What the client sees — opponent hand is hidden */
export interface SanitizedGameState {
  gameId: string;
  status: GameStatus;
  phase: TurnPhase;
  turnNumber: number;
  activePlayerId: string;
  myState: PlayerState;
  opponentState: OpponentView;
  winner: string | null;
  endReason: string | null;
  pendingTargetAction: PendingAction | null;
  pendingDiscover: PendingDiscover | null;
}

export interface OpponentView {
  playerId: string;
  playerName: string;
  heroId: string;
  heroName: string;
  heroFaction: Faction;
  hp: number;
  maxHp: number;
  armor: number;
  mana: number;
  maxMana: number;
  heroPowerUsed: boolean;
  hasWeapon: boolean;
  weaponAttack: number;
  weaponDurability: number;
  heroHasAttacked: boolean;
  locations: LocationSlot[];
  board: (MinionSlot | null)[];
  handCount: number;
  deckCount: number;
  burnPile: Card[];
  secretCount: number;
  factionBonusActive: boolean;
}
