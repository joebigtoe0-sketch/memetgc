import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import type { Keyword, CardEffect } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

// GET /api/collection — current user's collection
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const entries = await prisma.collectionEntry.findMany({
    where: { userId: req.user!.userId },
    include: { card: true },
    orderBy: [{ card: { cost: "asc" } }, { card: { name: "asc" } }],
  });

  res.json(
    entries.map((e) => ({
      cardId: e.cardId,
      quantity: e.quantity,
      card: {
        id: e.card.id,
        name: e.card.name,
        cost: e.card.cost,
        type: e.card.type,
        faction: e.card.faction,
        rarity: e.card.rarity,
        attack: e.card.attack ?? undefined,
        health: e.card.health ?? undefined,
        durability: e.card.durability ?? undefined,
        text: e.card.text ?? undefined,
        flavor_text: e.card.flavorText ?? undefined,
        art_url: e.card.artUrl ?? undefined,
        keywords: (e.card.keywordsJson as unknown as Keyword[]) ?? [],
        effects: (e.card.effectsJson as unknown as CardEffect[]) ?? [],
        dust_value: e.card.dustValue,
        craft_cost: e.card.craftCost,
        collectible: e.card.collectible,
        craftable: e.card.craftable,
      },
    }))
  );
});

// POST /api/collection/dust — dust a card
router.post("/dust", requireAuth, async (req: AuthRequest, res) => {
  const { cardId, quantity } = req.body as { cardId: string; quantity: number };
  if (!cardId || typeof quantity !== "number" || quantity < 1) {
    res.status(400).json({ error: "cardId and quantity required" });
    return;
  }

  const userId = req.user!.userId;
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || !card.craftable) {
    res.status(400).json({ error: "Card not dustable" });
    return;
  }

  const entry = await prisma.collectionEntry.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });
  if (!entry || entry.quantity < quantity) {
    res.status(400).json({ error: "Not enough copies to dust" });
    return;
  }

  const fragmentsGained = card.dustValue * quantity;

  await prisma.$transaction([
    prisma.collectionEntry.update({
      where: { userId_cardId: { userId, cardId } },
      data: { quantity: { decrement: quantity } },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { fragments: { increment: fragmentsGained } },
    }),
  ]);

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
  res.json({ fragmentsGained, newBalance: updatedUser!.fragments });
});

// POST /api/collection/craft — craft a card
router.post("/craft", requireAuth, async (req: AuthRequest, res) => {
  const { cardId } = req.body as { cardId: string };
  if (!cardId) {
    res.status(400).json({ error: "cardId required" });
    return;
  }

  const userId = req.user!.userId;
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || !card.craftable || !card.collectible) {
    res.status(400).json({ error: "Card not craftable" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.fragments < card.craftCost) {
    res.status(400).json({ error: "Not enough fragments" });
    return;
  }

  await prisma.$transaction([
    prisma.collectionEntry.upsert({
      where: { userId_cardId: { userId, cardId } },
      update: { quantity: { increment: 1 } },
      create: { userId, cardId, quantity: 1 },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { fragments: { decrement: card.craftCost } },
    }),
  ]);

  res.json({ success: true, fragmentsSpent: card.craftCost });
});

export default router;
