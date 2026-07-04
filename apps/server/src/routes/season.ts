import { Router } from "express";
import { getActiveSeason } from "../game/season.js";
import { SEASON_REWARDS, SEASON_DURATION_DAYS, seasonDaysRemaining, seasonEndsAt, seasonProgressPct } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

// GET /api/season — active season + reward table (public)
router.get("/", async (_req, res) => {
  const season = await getActiveSeason();
  if (!season) {
    res.json({ active: null, rewards: SEASON_REWARDS });
    return;
  }
  const endsAt = seasonEndsAt(season.startedAt, SEASON_DURATION_DAYS);
  res.json({
    active: {
      number: season.number,
      name: season.name,
      startedAt: season.startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      daysRemaining: seasonDaysRemaining(season.startedAt),
      progressPct: seasonProgressPct(season.startedAt),
      durationDays: SEASON_DURATION_DAYS,
    },
    rewards: SEASON_REWARDS,
  });
});

export default router;
