import { Router } from "express";
import { getActiveSeason } from "../game/season.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/season — the currently active season (public)
router.get("/", async (_req, res) => {
  const season = await getActiveSeason();
  if (!season) {
    res.json({ active: null });
    return;
  }
  res.json({
    active: {
      number: season.number,
      name: season.name,
      startedAt: season.startedAt.toISOString(),
    },
  });
});

export default router;
