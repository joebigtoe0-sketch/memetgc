import { prisma } from "@memetgc/db";
import {
  tierFromPoints,
  isMemepoolEligible,
  MEMEPOOL_TOP_N,
  type RankTier,
} from "./rank.js";

export interface LeaderboardRow {
  position: number;
  userId: string;
  username: string;
  rankPoints: number;
  rankTier: RankTier;
  rankStars: number;
  seasonWins: number;
  seasonLosses: number;
  isMemepool: boolean;
}

/**
 * Top players by ladder points. The top `MEMEPOOL_TOP_N` who also clear the
 * Diamond points floor are flagged as Memepool rank (live, not a fixed tier).
 */
export async function getLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const users = await prisma.user.findMany({
    where: { hasUsername: true },
    orderBy: [{ rankPoints: "desc" }, { seasonWins: "desc" }, { updatedAt: "asc" }],
    take: limit,
    select: {
      id: true,
      username: true,
      rankPoints: true,
      seasonWins: true,
      seasonLosses: true,
    },
  });

  return users.map((u, i) => {
    const position = i + 1;
    const { tier, stars } = tierFromPoints(u.rankPoints);
    const isMemepool = position <= MEMEPOOL_TOP_N && isMemepoolEligible(u.rankPoints);
    return {
      position,
      userId: u.id,
      username: u.username,
      rankPoints: u.rankPoints,
      rankTier: isMemepool ? "degen" : tier,
      rankStars: stars,
      seasonWins: u.seasonWins,
      seasonLosses: u.seasonLosses,
      isMemepool,
    };
  });
}

export interface LadderStanding {
  position: number | null; // null if outside the ranked pool (0 points / no games)
  isMemepool: boolean;
}

/**
 * A single player's live ladder position and Memepool status. Position is the
 * count of players strictly ahead + 1. Players with 0 points are unranked.
 */
export async function getLadderStanding(userId: string, rankPoints: number): Promise<LadderStanding> {
  if (rankPoints <= 0) return { position: null, isMemepool: false };

  const ahead = await prisma.user.count({
    where: { hasUsername: true, rankPoints: { gt: rankPoints } },
  });
  const position = ahead + 1;
  const isMemepool = position <= MEMEPOOL_TOP_N && isMemepoolEligible(rankPoints);
  return { position, isMemepool };
}
