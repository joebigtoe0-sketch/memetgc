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
