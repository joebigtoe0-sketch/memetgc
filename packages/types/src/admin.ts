export interface AdminLiveGame {
  gameId: string;
  mode: string;
  status: string;
  turnNumber: number;
  activePlayerName: string | null;
  players: { userId: string; username: string; isAI: boolean; isBot: boolean }[];
  tournamentTitle: string | null;
  tournamentRound: number | null;
}

export interface AdminEconomyStats {
  players: { humans: number; bots: number };
  packs: {
    opened: number;
    unopened: number;
    /** Cumulative pack buys from the shop (tracked since platform_stats was added). */
    bought: number;
    fragmentsSpent: number;
  };
  market: {
    salesTotal: number;
    salesCards: number;
    salesPacks: number;
    /** Total $MEMEPOOL paid across completed marketplace sales. */
    tokenVolume: number;
    activeListings: number;
  };
  collection: {
    totalCards: number;
    uniqueCardIds: number;
    legendaries: number;
    byRarity: { common: number; rare: number; epic: number; legendary: number };
  };
  fragments: {
    /** Sum of current human player balances. */
    inCirculation: number;
    fromQuests: number;
    fromTournaments: number;
    /** Quest + tournament claims only (match/dust rewards not logged historically). */
    trackedSourcesTotal: number;
  };
  matches: { total: number };
}
