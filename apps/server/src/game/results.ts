import { prisma } from "@memetgc/db";
import type { GameRoom } from "./room.js";
import type { Card } from "@memetgc/types";
import {
  computeMatchFragments,
  computeEloDelta,
  isQuestEligibleMode,
  shouldTrackSeasonStats,
} from "./matchRewards.js";
import { tierFromPoints } from "./rank.js";
import { getActiveSeasonId } from "./season.js";

/**
 * Persist season stats, rank points, match fragments and daily-quest progress
 * for human players in a finished room. Fire-and-forget; never throws.
 */
export async function recordMatchResults(room: GameRoom): Promise<void> {
  try {
    const winnerId = room.state.winner ?? null;
    const humans = Object.values(room.players).filter((p) => !p.isAI);
    if (humans.length === 0) return;

    const now = new Date();
    const endReason = room.state.endReason ?? "hero_death";
    const turnNumber = room.state.turnNumber ?? 0;
    const trackStats = shouldTrackSeasonStats(room.mode, endReason, turnNumber);
    const trackQuests = isQuestEligibleMode(room.mode) && trackStats;
    const isRanked = room.mode === "ranked";

    // Snapshot both players' MMR up-front so each Elo calc uses pre-match ratings.
    const userSnapshots = new Map<string, { mmr: number; rankPoints: number; games: number }>();
    if (isRanked && trackStats) {
      for (const player of humans) {
        const u = await prisma.user.findUnique({
          where: { id: player.userId },
          select: { mmr: true, rankPoints: true, seasonWins: true, seasonLosses: true },
        });
        if (u) {
          userSnapshots.set(player.userId, {
            mmr: u.mmr,
            rankPoints: u.rankPoints,
            games: u.seasonWins + u.seasonLosses,
          });
        }
      }
    }

    for (const player of humans) {
      const userId = player.userId;
      const isWinner = winnerId === userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;

      const oppState = Object.values(room.state.players).find((s) => s.playerId !== userId);
      const minionsDestroyed = (oppState?.burnPile ?? []).filter((c: Card) => c.type === "minion").length;

      const matchFragments = computeMatchFragments({
        mode: room.mode,
        isWinner,
        endReason,
        turnNumber,
        playerId: userId,
        winnerId,
      });

      const updateData: {
        seasonWins?: { increment: number };
        seasonLosses?: { increment: number };
        rankPoints?: number;
        mmr?: number;
        seasonPeakPoints?: number;
        rankTier?: string;
        rankStars?: number;
        fragments?: { increment: number };
      } = {};

      if (trackStats) {
        updateData.seasonWins = { increment: isWinner ? 1 : 0 };
        updateData.seasonLosses = { increment: isWinner ? 0 : 1 };
      }

      // Ranked: Elo update applied to both hidden MMR and visible ladder points.
      if (isRanked && trackStats) {
        const me = userSnapshots.get(userId);
        const oppId = Object.values(room.state.players).find((s) => s.playerId !== userId)?.playerId;
        const opp = oppId ? userSnapshots.get(oppId) : undefined;
        const myMmr = me?.mmr ?? user.mmr;
        const oppMmr = opp?.mmr ?? myMmr; // vs unknown/AI-less: neutral expectation
        const delta = computeEloDelta({
          myMmr,
          oppMmr,
          isWinner,
          gamesPlayed: me?.games ?? 0,
          myPoints: user.rankPoints,
        });
        const newPoints = Math.max(0, user.rankPoints + delta);
        const newMmr = Math.max(0, myMmr + delta);
        const { tier, stars } = tierFromPoints(newPoints);
        updateData.rankPoints = newPoints;
        updateData.mmr = newMmr;
        updateData.rankTier = tier;
        updateData.rankStars = stars;
        updateData.seasonPeakPoints = Math.max(user.seasonPeakPoints, newPoints);
      }

      if (matchFragments > 0) {
        updateData.fragments = { increment: matchFragments };
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: updateData });
      }

      if (trackQuests) {
        await updateQuests(userId, isWinner, minionsDestroyed, now);
      }
    }

    const seasonId = isRanked ? await getActiveSeasonId() : null;
    const [p1, p2] = Object.values(room.players);
    if (p1 && !p1.isAI) {
      await prisma.match.create({
        data: {
          player1Id: p1.userId,
          player2Id: p2 && !p2.isAI ? p2.userId : null,
          mode: room.mode,
          winnerId: winnerId,
          endReason,
          turnCount: turnNumber || null,
          seasonId,
          endedAt: now,
        },
      }).catch(() => {});
    }
  } catch {
    // Never let stats recording break game cleanup
  }
}

async function updateQuests(userId: string, isWinner: boolean, minionsDestroyed: number, now: Date): Promise<void> {
  const quests = await prisma.dailyQuest.findMany({
    where: { userId, expiresAt: { gt: now }, claimedAt: null },
  });

  for (const q of quests) {
    let inc = 0;
    if (q.type === "win_games" && isWinner) inc = 1;
    else if (q.type === "destroy_minions") inc = minionsDestroyed;
    if (inc <= 0) continue;

    const progress = Math.min(q.target, q.progress + inc);
    await prisma.dailyQuest.update({
      where: { id: q.id },
      data: { progress, completed: progress >= q.target },
    });
  }
}

/** Current consecutive-win streak from match history. */
export async function computeWinStreak(userId: string): Promise<number> {
  const matches = await prisma.match.findMany({
    where: { OR: [{ player1Id: userId }, { player2Id: userId }], endedAt: { not: null } },
    orderBy: { endedAt: "desc" },
    take: 30,
  });
  let streak = 0;
  for (const m of matches) {
    if (m.winnerId === userId) streak++;
    else break;
  }
  return streak;
}
