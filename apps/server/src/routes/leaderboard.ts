import { Router } from "express";
import { getLeaderboard } from "../game/leaderboard.js";
import { getActiveSeason } from "../game/season.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/leaderboard — top ranked players (public)
router.get("/", async (_req, res) => {
  const [rows, season] = await Promise.all([getLeaderboard(100), getActiveSeason()]);
  res.json({
    season: season ? { number: season.number, name: season.name } : null,
    players: rows.map((r) => ({
      position: r.position,
      username: r.username,
      rankTier: r.rankTier,
      rankStars: r.rankStars,
      rankPoints: r.rankPoints,
      seasonWins: r.seasonWins,
      seasonLosses: r.seasonLosses,
      isMemepool: r.isMemepool,
    })),
  });
});

export default router;
