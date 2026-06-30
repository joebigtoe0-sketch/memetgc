import { prisma } from "@memetgc/db";
import type { GameRoom } from "./room.js";
import type { Card } from "@memetgc/types";

const WIN_POINTS = 15;
const LOSS_POINTS = 10;
const FIRST_WIN_BONUS = 50;

/**
 * Persist season stats, rank points, first-win bonus and daily-quest progress
 * for the human players in a finished room. Fire-and-forget; never throws.
 */
export async function recordMatchResults(room: GameRoom): Promise<void> {
  try {
    const winnerId = room.state.winner ?? null;
    const humans = Object.values(room.players).filter((p) => !p.isAI);
    if (humans.length === 0) return;

    const now = new Date();

    for (const player of humans) {
      const userId = player.userId;
      const isWinner = winnerId === userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;

      // Enemy minions that died this game ≈ minions this player destroyed
      const oppState = Object.values(room.state.players).find((s) => s.playerId !== userId);
      const minionsDestroyed = (oppState?.burnPile ?? []).filter((c: Card) => c.type === "minion").length;

      // First win of the day → bonus fragments (doubled reward)
      let bonusFragments = 0;
      let firstWinToday = user.firstWinToday;
      if (isWinner && !user.firstWinToday) {
        bonusFragments = FIRST_WIN_BONUS;
        firstWinToday = true;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          seasonWins: { increment: isWinner ? 1 : 0 },
          seasonLosses: { increment: isWinner ? 0 : 1 },
          rankPoints: Math.max(0, user.rankPoints + (isWinner ? WIN_POINTS : -LOSS_POINTS)),
          firstWinToday,
          fragments: { increment: bonusFragments },
        },
      });

      await updateQuests(userId, isWinner, minionsDestroyed, now);
    }

    // Record the match for win-streak history
    const [p1, p2] = Object.values(room.players);
    if (p1 && !p1.isAI) {
      await prisma.match.create({
        data: {
          player1Id: p1.userId,
          player2Id: p2 && !p2.isAI ? p2.userId : null,
          mode: room.mode,
          winnerId: winnerId,
          endReason: room.state.endReason ?? "hero_death",
          turnCount: room.state.turnNumber ?? null,
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
