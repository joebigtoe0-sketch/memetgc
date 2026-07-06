export type TournamentStatus = "upcoming" | "live" | "finished" | "cancelled";
export type TournamentMatchStatus = "pending" | "awaiting_join" | "live" | "completed" | "forfeited";
export type PrizeCurrency = "fragments" | "custom";

export interface TournamentPrizeTierDto {
  rankLabel: string;
  rankMin: number;
  rankMax: number;
  amount: number | null;
  currency: PrizeCurrency;
  customLabel?: string | null;
}

export interface TournamentListItem {
  id: string;
  title: string;
  description: string;
  imagePath: string | null;
  startAt: string;
  status: TournamentStatus;
  maxSlots: number;
  registeredCount: number;
  bracketSize: number;
  currentRound: number;
  totalRounds: number;
  startsInMs: number | null;
  startsInLabel?: string | null;
  totalPrizeSummary: string;
  userRegistered: boolean;
  liveMatchCount: number;
  /** Set when the user has unclaimed fragment prizes from a finished tournament. */
  claimableReward?: { amount: number; rank: number } | null;
}

export interface TournamentMatchDto {
  id: string;
  round: number;
  slotIndex: number;
  player1Id: string | null;
  player2Id: string | null;
  player1Name: string | null;
  player2Name: string | null;
  winnerId: string | null;
  status: TournamentMatchStatus;
  joinDeadline: string | null;
  player1Score: number;
  player2Score: number;
  isUserMatch: boolean;
}

export interface TournamentDetail extends TournamentListItem {
  prizeTiers: TournamentPrizeTierDto[];
  matches: TournamentMatchDto[];
  winnerName: string | null;
  userActiveMatch: {
    matchId: string;
    tournamentId: string;
    tournamentTitle: string;
    opponentName: string;
    joinDeadline: string;
    round: number;
  } | null;
  userPayout: {
    amount: number;
    rank: number;
    currencyLabel: string;
    status: "pending_claim" | "claimed" | "pending_manual" | "paid";
  } | null;
}

export interface ActiveTournamentMatch {
  matchId: string;
  tournamentId: string;
  tournamentTitle: string;
  opponentName: string;
  joinDeadline: string;
  round: number;
}

export interface TournamentPendingClaim {
  tournamentId: string;
  tournamentTitle: string;
  amount: number;
  rank: number;
}

export interface TournamentMatchReadyEvent {
  matchId: string;
  tournamentId: string;
  opponentName: string;
  joinDeadline: string;
  round: number;
}
