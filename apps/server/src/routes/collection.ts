import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import type { Keyword, CardEffect } from "@memetgc/types";
import {
  adjustCollectionQuantity,
  aggregateOwnership,
  deckCopiesForCard,
  resolveUpgradePath,
  type UpgradePath,
} from "../lib/collectionFrames.js";

const router: ReturnType<typeof Router> = Router();

type DbCard = NonNullable<Awaited<ReturnType<typeof prisma.card.findUnique>>>;

function cardJson(card: DbCard) {
  return {
    id: card.id,
    name: card.name,
    cost: card.cost,
    type: card.type,
    faction: card.faction,
    rarity: card.rarity,
    attack: card.attack ?? undefined,
    health: card.health ?? undefined,
    durability: card.durability ?? undefined,
    text: card.text ?? undefined,
    flavor_text: card.flavorText ?? undefined,
    art_url: card.artUrl ?? (card.id === "coin" ? "/card-art/gas_token.jpg" : `/card-art/${card.id}.jpg`),
    keywords: (card.keywordsJson as unknown as Keyword[]) ?? [],
    effects: (card.effectsJson as unknown as CardEffect[]) ?? [],
    dust_value: card.dustValue,
    craft_cost: card.craftCost,
    collectible: card.collectible,
    craftable: card.craftable,
  };
}

// GET /api/collection — current user's collection (aggregated per card)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const entries = await prisma.collectionEntry.findMany({
    where: { userId: req.user!.userId },
    include: { card: true },
    orderBy: [{ card: { cost: "asc" } }, { card: { name: "asc" } }],
  });

  const byCard = new Map<string, { card: DbCard; ownership: NonNullable<ReturnType<typeof aggregateOwnership> extends Map<string, infer V> ? V : never> }>();
  const ownershipMap = aggregateOwnership(entries);

  for (const e of entries) {
    if (!byCard.has(e.cardId)) {
      byCard.set(e.cardId, { card: e.card, ownership: ownershipMap.get(e.cardId)! });
    }
  }

  res.json(
    Array.from(byCard.entries()).map(([cardId, { card, ownership }]) => ({
      cardId,
      quantity: ownership.totalQuantity,
      defaultQuantity: ownership.defaultQuantity,
      silverQuantity: ownership.silverQuantity,
      goldQuantity: ownership.goldQuantity,
      displayFrameTier: ownership.displayFrameTier,
      card: {
        ...cardJson(card),
        frameTier: ownership.displayFrameTier,
      },
    }))
  );
});

// POST /api/collection/upgrade — destroy copies to mint a silver/gold frame version
router.post("/upgrade", requireAuth, async (req: AuthRequest, res) => {
  const { cardId, path } = req.body as { cardId?: string; path?: UpgradePath };
  if (!cardId || !path || !["silver", "gold_default", "gold_silver"].includes(path)) {
    res.status(400).json({ error: "cardId and path (silver | gold_default | gold_silver) required" });
    return;
  }

  const userId = req.user!.userId;
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || !card.collectible) {
    res.status(400).json({ error: "Invalid card" });
    return;
  }

  const rows = await prisma.collectionEntry.findMany({ where: { userId, cardId } });
  const ownership = aggregateOwnership(rows).get(cardId);
  if (!ownership) {
    res.status(400).json({ error: "You don't own this card" });
    return;
  }

  const deckCopies = await deckCopiesForCard(userId, cardId);
  const plan = resolveUpgradePath(path, ownership, deckCopies);
  if (!plan.ok) {
    res.status(400).json({ error: plan.error });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await adjustCollectionQuantity(tx, userId, cardId, plan.fromTier, -plan.cost);
    await adjustCollectionQuantity(tx, userId, cardId, plan.toTier, 1);
  });

  const updated = await prisma.collectionEntry.findMany({ where: { userId, cardId }, include: { card: true } });
  const next = aggregateOwnership(updated).get(cardId)!;

  res.json({
    success: true,
    cardId,
    path,
    defaultQuantity: next.defaultQuantity,
    silverQuantity: next.silverQuantity,
    goldQuantity: next.goldQuantity,
    quantity: next.totalQuantity,
    displayFrameTier: next.displayFrameTier,
  });
});

// POST /api/collection/dust — dust a card (default-tier copies only)
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
    where: { userId_cardId_frameTier: { userId, cardId, frameTier: "default" } },
  });
  if (!entry || entry.quantity < quantity) {
    res.status(400).json({ error: "Not enough copies to dust" });
    return;
  }

  const fragmentsGained = card.dustValue * quantity;

  await prisma.$transaction(async (tx) => {
    await adjustCollectionQuantity(tx, userId, cardId, "default", -quantity);
    await tx.user.update({
      where: { id: userId },
      data: { fragments: { increment: fragmentsGained } },
    });
  });

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
  res.json({ fragmentsGained, newBalance: updatedUser!.fragments });
});

// POST /api/collection/craft — craft a card (adds a default-tier copy)
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

  await prisma.$transaction(async (tx) => {
    await adjustCollectionQuantity(tx, userId, cardId, "default", 1);
    await tx.user.update({
      where: { id: userId },
      data: { fragments: { decrement: card.craftCost } },
    });
  });

  res.json({ success: true, fragmentsSpent: card.craftCost });
});

export default router;
