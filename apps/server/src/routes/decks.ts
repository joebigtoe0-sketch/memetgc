import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import type { Keyword, CardEffect } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

const COPY_LIMITS: Record<string, number> = {
  common: 4,
  rare: 3,
  epic: 2,
  legendary: 1,
};

const SaveDeckSchema = z.object({
  name: z.string().min(1).max(50),
  heroId: z.string(),
  cardIds: z.array(z.string()).length(30),
});

// GET /api/decks — get current user's decks
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const decks = await prisma.deck.findMany({
    where: { userId: req.user!.userId },
    include: { deckCards: { include: { card: true } } },
    orderBy: { updatedAt: "desc" },
  });

  res.json(
    decks.map((d) => ({
      id: d.id,
      name: d.name,
      heroId: d.heroId,
      isStarter: d.isStarter,
      factionBonusActive: d.factionBonusActive,
      cards: d.deckCards.map((dc) => ({ cardId: dc.cardId, quantity: dc.quantity })),
      cardCount: d.deckCards.reduce((sum, dc) => sum + dc.quantity, 0),
    }))
  );
});

// GET /api/decks/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const deckId = String(req.params.id);
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: req.user!.userId },
    include: { deckCards: { include: { card: true } } },
  });

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  res.json({
    id: deck.id,
    name: deck.name,
    heroId: deck.heroId,
    isStarter: deck.isStarter,
    cards: deck.deckCards.map((dc) => ({
      card: {
        id: dc.card.id,
        name: dc.card.name,
        cost: dc.card.cost,
        type: dc.card.type,
        faction: dc.card.faction,
        rarity: dc.card.rarity,
        attack: dc.card.attack,
        health: dc.card.health,
        durability: dc.card.durability,
        keywords: (dc.card.keywordsJson as unknown as Keyword[]) ?? [],
        effects: (dc.card.effectsJson as unknown as CardEffect[]) ?? [],
        text: dc.card.text,
        artUrl: dc.card.artUrl,
        collectible: dc.card.collectible,
      },
      quantity: dc.quantity,
    })),
  });
});

// POST /api/decks — save a new deck
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = SaveDeckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid deck data", details: parsed.error.flatten() });
    return;
  }

  const { name, heroId, cardIds } = parsed.data;
  const userId = req.user!.userId;

  const hero = await prisma.hero.findUnique({ where: { id: heroId } });
  if (!hero) {
    res.status(400).json({ error: "Hero not found" });
    return;
  }

  const uniqueCardIds = [...new Set(cardIds)];
  const cards = await prisma.card.findMany({ where: { id: { in: uniqueCardIds } } });
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const countMap = new Map<string, number>();
  for (const id of cardIds) {
    countMap.set(id, (countMap.get(id) ?? 0) + 1);
  }

  for (const [id, count] of countMap) {
    const card = cardMap.get(id);
    if (!card) {
      res.status(400).json({ error: `Card not found: ${id}` });
      return;
    }
    if (!card.collectible) {
      res.status(400).json({ error: `Card not collectible: ${id}` });
      return;
    }
    const limit = COPY_LIMITS[card.rarity] ?? 1;
    if (count > limit) {
      res.status(400).json({ error: `Too many copies of ${card.name} (max ${limit} for ${card.rarity})` });
      return;
    }
  }

  const owned = await prisma.collectionEntry.findMany({
    where: { userId, cardId: { in: uniqueCardIds } },
  });
  const ownedMap = new Map(owned.map((o) => [o.cardId, o.quantity]));

  for (const [id, needed] of countMap) {
    if ((ownedMap.get(id) ?? 0) < needed) {
      res.status(400).json({ error: `You don't own enough copies of card: ${id}` });
      return;
    }
  }

  const nonDegenCards = cards.filter((c) => c.faction !== "degen");
  const primaryFaction = nonDegenCards.length > 0 ? nonDegenCards[0]!.faction : "degen";
  const factionBonusActive = nonDegenCards.every((c) => c.faction === primaryFaction);

  const deck = await prisma.deck.create({
    data: {
      userId,
      name,
      heroId,
      faction: primaryFaction,
      factionBonusActive,
    },
  });

  for (const [cardId, quantity] of countMap) {
    await prisma.deckCard.create({ data: { deckId: deck.id, cardId, quantity } });
  }

  res.status(201).json({ id: deck.id, name: deck.name });
});

async function recomputeFaction(deckId: string): Promise<void> {
  const deckCards = await prisma.deckCard.findMany({ where: { deckId }, include: { card: true } });
  const nonDegen = deckCards.filter((dc) => dc.card.faction !== "degen");
  const primary = nonDegen.length > 0 ? nonDegen[0]!.card.faction : "degen";
  const bonus = nonDegen.length > 0 && nonDegen.every((dc) => dc.card.faction === primary);
  await prisma.deck.update({ where: { id: deckId }, data: { faction: primary, factionBonusActive: bonus } });
}

async function deckJson(deckId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId }, include: { deckCards: true } });
  if (!deck) return null;
  return {
    id: deck.id,
    name: deck.name,
    heroId: deck.heroId,
    isStarter: deck.isStarter,
    faction: deck.faction,
    factionBonusActive: deck.factionBonusActive,
    cards: deck.deckCards.map((dc) => ({ cardId: dc.cardId, quantity: dc.quantity })),
    cardCount: deck.deckCards.reduce((s, dc) => s + dc.quantity, 0),
  };
}

// POST /api/decks/new — create an empty, editable deck
router.post("/new", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const name = (typeof req.body?.name === "string" ? req.body.name : "").slice(0, 50) || "New Deck";
  const hero = await prisma.hero.findFirst({ orderBy: { id: "asc" } });
  if (!hero) { res.status(400).json({ error: "No heroes available" }); return; }
  const deck = await prisma.deck.create({
    data: { userId, name, heroId: hero.id, faction: "degen", factionBonusActive: false, isStarter: false },
  });
  res.status(201).json(await deckJson(deck.id));
});

// PATCH /api/decks/:id — rename / change hero
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ name: z.string().min(1).max(50).optional(), heroId: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const deck = await prisma.deck.findFirst({ where: { id: String(req.params.id), userId: req.user!.userId } });
  if (!deck) { res.status(404).json({ error: "Deck not found" }); return; }
  if (deck.isStarter) { res.status(403).json({ error: "Cannot edit starter decks" }); return; }
  await prisma.deck.update({ where: { id: deck.id }, data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.heroId ? { heroId: parsed.data.heroId } : {}) } });
  res.json(await deckJson(deck.id));
});

// POST /api/decks/:id/cards — add one copy of a card
router.post("/:id/cards", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const cardId = String(req.body?.cardId ?? "");
  const deck = await prisma.deck.findFirst({ where: { id: String(req.params.id), userId }, include: { deckCards: true } });
  if (!deck) { res.status(404).json({ error: "Deck not found" }); return; }
  if (deck.isStarter) { res.status(403).json({ error: "Cannot edit starter decks" }); return; }

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || !card.collectible) { res.status(400).json({ error: "Invalid card" }); return; }

  const total = deck.deckCards.reduce((s, dc) => s + dc.quantity, 0);
  if (total >= 30) { res.status(400).json({ error: "Deck is full (30 cards)" }); return; }

  const existing = deck.deckCards.find((dc) => dc.cardId === cardId);
  const have = existing?.quantity ?? 0;
  const limit = COPY_LIMITS[card.rarity] ?? 1;
  if (have + 1 > limit) { res.status(400).json({ error: `Max ${limit} copies of ${card.name}` }); return; }

  const owned = await prisma.collectionEntry.findUnique({ where: { userId_cardId: { userId, cardId } } });
  if ((owned?.quantity ?? 0) < have + 1) { res.status(400).json({ error: `You don't own enough copies of ${card.name}` }); return; }

  if (existing) await prisma.deckCard.update({ where: { id: existing.id }, data: { quantity: have + 1 } });
  else await prisma.deckCard.create({ data: { deckId: deck.id, cardId, quantity: 1 } });
  await recomputeFaction(deck.id);
  res.json(await deckJson(deck.id));
});

// DELETE /api/decks/:id/cards/:cardId — remove one copy of a card
router.delete("/:id/cards/:cardId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const deck = await prisma.deck.findFirst({ where: { id: String(req.params.id), userId }, include: { deckCards: true } });
  if (!deck) { res.status(404).json({ error: "Deck not found" }); return; }
  if (deck.isStarter) { res.status(403).json({ error: "Cannot edit starter decks" }); return; }
  const existing = deck.deckCards.find((dc) => dc.cardId === String(req.params.cardId));
  if (!existing) { res.status(400).json({ error: "Card not in deck" }); return; }
  if (existing.quantity > 1) await prisma.deckCard.update({ where: { id: existing.id }, data: { quantity: existing.quantity - 1 } });
  else await prisma.deckCard.delete({ where: { id: existing.id } });
  await recomputeFaction(deck.id);
  res.json(await deckJson(deck.id));
});

// DELETE /api/decks/:id
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const deckId = String(req.params.id);
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: req.user!.userId },
  });
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }
  if (deck.isStarter) {
    res.status(403).json({ error: "Cannot delete starter decks" });
    return;
  }
  await prisma.deck.delete({ where: { id: deckId } });
  res.json({ success: true });
});

export default router;
