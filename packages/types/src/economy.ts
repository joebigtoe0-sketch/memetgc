export type AccessTier = "practice" | "casual" | "ranked" | "tournament";
export type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "degen";
export type PackType = "standard" | "faction" | "legendary" | "season";

export interface PlayerProfile {
  id: string;
  username: string;
  walletAddress?: string;
  accessTier: AccessTier;
  fragments: number;
  rankTier: RankTier;
  rankStars: number;
  rankPoints: number;
  seasonWins: number;
  seasonLosses: number;
  boardThemeId: string;
  packStats: PackStats;
  dailyQuestsLastRefresh: string;
  firstWinToday: boolean;
  createdAt: string;
}

export interface PackStats {
  standard_packs_since_epic: number;
  standard_packs_since_legendary: number;
  faction_packs_since_epic: number;
  faction_packs_since_legendary: number;
}

export interface DailyQuest {
  id: string;
  playerId: string;
  type: QuestType;
  description: string;
  progress: number;
  target: number;
  reward: QuestReward;
  completed: boolean;
  claimedAt?: string;
  expiresAt: string;
}

export type QuestType =
  | "daily_login"
  | "win_games"
  | "play_faction_cards"
  | "win_undamaged"
  | "destroy_minions";

export interface QuestReward {
  fragments?: number;
  packs?: { type: PackType; count: number };
  card?: { rarity: string; faction?: string };
}

export interface PackOpenResult {
  cards: Array<{ card: import("./card.js").Card; isNew: boolean }>;
  pityCorrected: boolean;
}

export interface CollectionEntry {
  cardId: string;
  quantity: number;
}

export interface Deck {
  id: string;
  playerId: string;
  name: string;
  heroId: string;
  cardIds: string[];
  faction?: string;
  factionBonusActive: boolean;
  isStarter: boolean;
  createdAt: string;
  updatedAt: string;
}
