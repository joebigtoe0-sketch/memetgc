import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import type { PackType } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

const PACK_COSTS: Record<PackType, number> = {
  standard: 100,
  faction: 120,
  legendary: 800,
  season: 150,
};

// GET /api/economy/quests — get daily quests
router.get("/quests", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Refresh quests if expired
  const activeQuests = await prisma.dailyQuest.findMany({
    where: { userId, expiresAt: { gt: now } },
  });

  if (activeQuests.length === 0) {
    await generateDailyQuests(userId);
    const quests = await prisma.dailyQuest.findMany({ where: { userId, expiresAt: { gt: now } } });
    res.json(quests);
    return;
  }

  res.json(activeQuests);
});

// POST /api/economy/quests/:id/claim — claim a completed quest
router.post("/quests/:id/claim", requireAuth, async (req: AuthRequest, res) => {
  const quest = await prisma.dailyQuest.findFirst({
    where: { id: String(req.params.id), userId: req.user!.userId },
  });

  if (!quest) {
    res.status(404).json({ error: "Quest not found" });
    return;
  }
  if (!quest.completed) {
    res.status(400).json({ error: "Quest not completed" });
    return;
  }
  if (quest.claimedAt) {
    res.status(400).json({ error: "Quest already claimed" });
    return;
  }

  const reward = quest.rewardJson as { fragments?: number };
  await prisma.$transaction([
    prisma.dailyQuest.update({ where: { id: quest.id }, data: { claimedAt: new Date() } }),
    prisma.user.update({
      where: { id: req.user!.userId },
      data: { fragments: { increment: reward.fragments ?? 0 } },
    }),
  ]);

  res.json({ success: true, reward });
});

// POST /api/economy/packs/open — open a pack
router.post("/packs/open", requireAuth, async (req: AuthRequest, res) => {
  const { packType = "standard", faction } = req.body as { packType?: PackType; faction?: string };
  const cost = PACK_COSTS[packType];
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.fragments < cost) {
    res.status(400).json({ error: "Not enough fragments" });
    return;
  }

  const cards = await generatePackCards(packType, faction, user, userId);

  await prisma.user.update({
    where: { id: userId },
    data: { fragments: { decrement: cost } },
  });

  for (const { cardId } of cards) {
    await prisma.collectionEntry.upsert({
      where: { userId_cardId: { userId, cardId } },
      update: { quantity: { increment: 1 } },
      create: { userId, cardId, quantity: 1 },
    });
  }

  res.json({ cards, newBalance: user.fragments - cost });
});

// GET /api/economy/profile — economy profile
router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    fragments: user.fragments,
    rankTier: user.rankTier,
    rankStars: user.rankStars,
    rankPoints: user.rankPoints,
    seasonWins: user.seasonWins,
    seasonLosses: user.seasonLosses,
    accessTier: user.accessTier,
    packStats: {
      standard_packs_since_epic: user.standardPacksEpic,
      standard_packs_since_legendary: user.standardPacksLegendary,
    },
  });
});

async function generatePackCards(
  packType: PackType,
  faction: string | undefined,
  user: { standardPacksEpic: number; standardPacksLegendary: number },
  userId: string
): Promise<Array<{ cardId: string; rarity: string }>> {
  const where: Record<string, unknown> = { collectible: true };
  if (packType === "faction" && faction) where.faction = faction;
  if (packType === "legendary") where.rarity = { in: ["legendary", "epic", "rare"] };

  const allCards = await prisma.card.findMany({ where });
  if (allCards.length === 0) return [];

  const getByRarity = (rarity: string) => allCards.filter((c) => c.rarity === rarity);

  const pick = (pool: typeof allCards) => pool[Math.floor(Math.random() * pool.length)]!;

  const cards: Array<{ cardId: string; rarity: string }> = [];

  // Pity timer check
  let guaranteedLegendary = packType === "legendary";
  let guaranteedEpic = user.standardPacksEpic >= 19;
  if (user.standardPacksLegendary >= 39) guaranteedLegendary = true;

  // Slot 1 — guaranteed Rare+
  const rareOrHigher = allCards.filter((c) => ["rare", "epic", "legendary"].includes(c.rarity));
  const slot1 = pick(rareOrHigher.length > 0 ? rareOrHigher : allCards);
  cards.push({ cardId: slot1.id, rarity: slot1.rarity });

  // Slots 2-5
  for (let i = 0; i < 4; i++) {
    let rarity: string;
    const roll = Math.random();

    if (guaranteedLegendary && i === 1) {
      rarity = "legendary";
      guaranteedLegendary = false;
    } else if (guaranteedEpic && i === 1) {
      rarity = "epic";
      guaranteedEpic = false;
    } else if (roll < 0.05) {
      rarity = "legendary";
    } else if (roll < 0.2) {
      rarity = "epic";
    } else {
      rarity = "common";
    }

    const pool = getByRarity(rarity);
    const card = pick(pool.length > 0 ? pool : allCards);
    cards.push({ cardId: card.id, rarity: card.rarity });
  }

  // Update pity counters
  const hasEpicOrLeg = cards.some((c) => ["epic", "legendary"].includes(c.rarity));
  const hasLeg = cards.some((c) => c.rarity === "legendary");

  await prisma.user.update({
    where: { id: userId },
    data: {
      standardPacksEpic: hasEpicOrLeg ? 0 : { increment: 1 },
      standardPacksLegendary: hasLeg ? 0 : { increment: 1 },
    },
  });

  return cards;
}

async function generateDailyQuests(userId: string): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const questTemplates = [
    { type: "daily_login", description: "Log in today", target: 1, reward: { fragments: 10 } },
    { type: "win_games", description: "Win 3 games", target: 3, reward: { fragments: 50, packs: { type: "standard", count: 1 } } },
    { type: "destroy_minions", description: "Destroy 15 minions", target: 15, reward: { fragments: 50 } },
  ];

  for (const q of questTemplates) {
    await prisma.dailyQuest.create({
      data: {
        userId,
        type: q.type,
        description: q.description,
        target: q.target,
        rewardJson: q.reward,
        expiresAt: tomorrow,
        // Daily login quest auto-completes
        completed: q.type === "daily_login",
        progress: q.type === "daily_login" ? 1 : 0,
      },
    });
  }
}

export default router;
