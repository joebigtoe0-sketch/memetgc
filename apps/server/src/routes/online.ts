import { Router } from "express";
import { getPublicOnlineCount } from "../game/online.js";

const router: ReturnType<typeof Router> = Router();

/** Public — no auth. Used on the login screen. */
router.get("/", (_req, res) => {
  const { display } = getPublicOnlineCount();
  res.json({ online: display });
});

export default router;
