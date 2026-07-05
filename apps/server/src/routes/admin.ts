import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { isUserAdmin, requireAdmin } from "../middleware/admin.js";
import { listActiveGames } from "../game/room.js";
import { getPublicOnlineCount } from "../game/online.js";

const router: ReturnType<typeof Router> = Router();

router.get("/check", requireAuth, async (req: AuthRequest, res) => {
  const isAdmin = await isUserAdmin(req.user!.userId);
  res.json({ isAdmin });
});

router.get("/live-games", requireAuth, requireAdmin, async (_req, res) => {
  const games = listActiveGames();
  const gameIds = games.map((g) => g.gameId);

  const tournamentLinks = gameIds.length
    ? await prisma.tournamentMatch.findMany({
        where: { gameId: { in: gameIds } },
        select: {
          gameId: true,
          round: true,
          tournament: { select: { title: true } },
        },
      })
    : [];

  const tourneyByGame = new Map(
    tournamentLinks.filter((t) => t.gameId).map((t) => [t.gameId!, t])
  );

  const liveTournamentCount = await prisma.tournament.count({ where: { status: "live" } });

  res.json({
    games: games.map((g) => {
      const link = tourneyByGame.get(g.gameId);
      const activePlayer = g.players.find((p) => p.userId === g.activePlayerId);
      return {
        gameId: g.gameId,
        mode: g.mode,
        status: g.status,
        turnNumber: g.turnNumber,
        activePlayerName: activePlayer?.username ?? null,
        players: g.players,
        tournamentTitle: link?.tournament.title ?? null,
        tournamentRound: link?.round ?? null,
      };
    }),
    liveTournamentCount,
    onlineCount: getPublicOnlineCount().display,
  });
});

export default router;
