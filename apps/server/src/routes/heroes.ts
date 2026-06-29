import { Router } from "express";
import { prisma } from "@memetgc/db";
import type { Hero, HeroPower } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

router.get("/", async (_req, res) => {
  const heroes = await prisma.hero.findMany({ orderBy: { name: "asc" } });
  res.json(
    heroes.map((h): Hero => ({
      id: h.id,
      name: h.name,
      faction: h.faction as Hero["faction"],
      hp: h.hp,
      armor: h.armor,
      hero_power: h.heroPowerJson as unknown as HeroPower,
      art_url: h.artUrl ?? undefined,
      unlock_method: h.unlockMethod as Hero["unlock_method"],
      collectible: h.collectible,
      description: h.description,
    }))
  );
});

router.get("/:id", async (req, res) => {
  const hero = await prisma.hero.findUnique({ where: { id: req.params.id } });
  if (!hero) {
    res.status(404).json({ error: "Hero not found" });
    return;
  }
  res.json({
    id: hero.id,
    name: hero.name,
    faction: hero.faction,
    hp: hero.hp,
    armor: hero.armor,
    hero_power: hero.heroPowerJson as unknown as HeroPower,
    art_url: hero.artUrl ?? undefined,
    unlock_method: hero.unlockMethod,
    description: hero.description,
  });
});

export default router;
