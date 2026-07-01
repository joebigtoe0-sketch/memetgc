import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { computeWinStreak } from "../game/results.js";
import { getDegenBalance, isDegenConfigured } from "../lib/helius.js";
import { getTokenBalance, MIN_PLAY_TOKENS } from "../lib/solana.js";

const router: ReturnType<typeof Router> = Router();

interface PackDef { type: string; name: string; cost: number; currency: "frags" | "degen"; }
const PACKS: Record<string, PackDef> = {
  standard: { type: "standard", name: "Standard Pack", cost: 100, currency: "frags" },
  season: { type: "season", name: "Genesis Drop Pack", cost: 150, currency: "frags" },
  legendary: { type: "legendary", name: "Legendary Pack", cost: 800, currency: "frags" },
};

// ─────────────────────────── Quests ───────────────────────────

router.get("/quests", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const now = new Date();

  const activeQuests = await prisma.dailyQuest.findMany({ where: { userId, expiresAt: { gt: now } } });
  if (activeQuests.length === 0) {
    await generateDailyQuests(userId);
    const quests = await prisma.dailyQuest.findMany({ where: { userId, expiresAt: { gt: now } } });
    res.json(quests);
    return;
  }
  res.json(activeQuests);
});

router.post("/quests/:id/claim", requireAuth, async (req: AuthRequest, res) => {
  const quest = await prisma.dailyQuest.findFirst({ where: { id: String(req.params.id), userId: req.user!.userId } });
  if (!quest) { res.status(404).json({ error: "Quest not found" }); return; }
  if (!quest.completed) { res.status(400).json({ error: "Quest not completed" }); return; }
  if (quest.claimedAt) { res.status(400).json({ error: "Quest already claimed" }); return; }

  const reward = quest.rewardJson as { fragments?: number; packs?: { type: string; count: number } };
  const userId = req.user!.userId;
  await prisma.$transaction(async (tx) => {
    await tx.dailyQuest.update({ where: { id: quest.id }, data: { claimedAt: new Date() } });
    await tx.user.update({ where: { id: userId }, data: { fragments: { increment: reward.fragments ?? 0 } } });
    if (reward.packs) {
      await tx.packInventory.upsert({
        where: { userId_packType: { userId, packType: reward.packs.type } },
        update: { quantity: { increment: reward.packs.count } },
        create: { userId, packType: reward.packs.type, quantity: reward.packs.count },
      });
    }
  });
  res.json({ success: true, reward });
});

// ─────────────────────────── Packs ───────────────────────────

// GET /api/economy/packs/inventory — owned (unopened) packs
router.get("/packs/inventory", requireAuth, async (req: AuthRequest, res) => {
  const inv = await prisma.packInventory.findMany({ where: { userId: req.user!.userId, quantity: { gt: 0 } } });
  res.json(inv.map((p) => ({ packType: p.packType, quantity: p.quantity })));
});

// POST /api/economy/packs/buy — buy a pack into inventory
router.post("/packs/buy", requireAuth, async (req: AuthRequest, res) => {
  const { packType = "standard", currency = "frags", count = 1 } = req.body as { packType?: string; currency?: string; count?: number };
  const pack = PACKS[packType];
  if (!pack) { res.status(400).json({ error: "Unknown pack type" }); return; }
  const qty = Math.max(1, Math.min(40, Number(count) || 1));

  if (currency === "degen") {
    res.status(501).json({ error: "On-chain $MEMPOOL purchases are coming soon" });
    return;
  }

  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const totalCost = pack.cost * qty;
  if (!user || user.fragments < totalCost) { res.status(400).json({ error: "Not enough fragments" }); return; }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { fragments: { decrement: totalCost } } }),
    prisma.packInventory.upsert({
      where: { userId_packType: { userId, packType } },
      update: { quantity: { increment: qty } },
      create: { userId, packType, quantity: qty },
    }),
  ]);

  res.json({ success: true, packType, quantity: qty, newBalance: user.fragments - totalCost });
});

// POST /api/economy/packs/open — open one owned pack from inventory
router.post("/packs/open", requireAuth, async (req: AuthRequest, res) => {
  const { packType = "standard", faction } = req.body as { packType?: string; faction?: string };
  if (!PACKS[packType]) { res.status(400).json({ error: "Unknown pack type" }); return; }
  const userId = req.user!.userId;

  const inv = await prisma.packInventory.findUnique({ where: { userId_packType: { userId, packType } } });
  if (!inv || inv.quantity <= 0) { res.status(400).json({ error: "You don't own this pack" }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const cards = await generatePackCards(packType, faction, user, userId);

  await prisma.$transaction([
    prisma.packInventory.update({ where: { userId_packType: { userId, packType } }, data: { quantity: { decrement: 1 } } }),
    prisma.user.update({ where: { id: userId }, data: { packsOpened: { increment: 1 } } }),
    ...cards.map((c) =>
      prisma.collectionEntry.upsert({
        where: { userId_cardId: { userId, cardId: c.cardId } },
        update: { quantity: { increment: 1 } },
        create: { userId, cardId: c.cardId, quantity: 1 },
      })
    ),
  ]);

  // Join full card data so the reveal UI can render real cards
  const cardRows = await prisma.card.findMany({ where: { id: { in: cards.map((c) => c.cardId) } } });
  const byId = new Map(cardRows.map((c) => [c.id, c]));
  const detailed = cards.map((c) => {
    const card = byId.get(c.cardId)!;
    return {
      id: card.id, name: card.name, cost: card.cost, type: card.type, faction: card.faction,
      rarity: card.rarity, tribe: card.tribe ?? undefined, attack: card.attack ?? undefined,
      health: card.health ?? undefined, durability: card.durability ?? undefined,
      text: card.text ?? undefined, keywords: (card.keywordsJson as unknown[]) ?? [],
    };
  });

  res.json({ cards: detailed, remaining: inv.quantity - 1 });
});

// ─────────────────────────── $DEGEN balance ───────────────────────────

router.get("/degen-balance", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.walletAddress) { res.json({ balance: 0, configured: isDegenConfigured() }); return; }
  const balance = await getDegenBalance(user.walletAddress);
  res.json({ balance, configured: isDegenConfigured() });
});

// ─────────────────────────── Access gate ───────────────────────────

// GET /api/economy/access — does the wallet hold enough $MEMPOOL to play?
router.get("/access", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const required = MIN_PLAY_TOKENS;
  if (!user?.walletAddress) {
    res.json({ balance: 0, required, hasAccess: false });
    return;
  }
  const balance = await getTokenBalance(user.walletAddress);
  res.json({ balance, required, hasAccess: balance >= required });
});

// ─────────────────────────── Profile ───────────────────────────

router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [collection, questsDone, recent, winStreak] = await Promise.all([
    prisma.collectionEntry.findMany({ where: { userId }, include: { card: true } }),
    prisma.dailyQuest.count({ where: { userId, claimedAt: { not: null } } }),
    prisma.match.findMany({
      where: { OR: [{ player1Id: userId }, { player2Id: userId }], endedAt: { not: null } },
      orderBy: { endedAt: "desc" }, take: 8,
    }),
    computeWinStreak(userId),
  ]);

  const cardsOwned = collection.reduce((s, c) => s + c.quantity, 0);
  const legendaries = collection.filter((c) => c.card.rarity === "legendary").reduce((s, c) => s + c.quantity, 0);

  // Faction mastery from owned-card composition
  const factionCounts: Record<string, number> = {};
  for (const c of collection) factionCounts[c.card.faction] = (factionCounts[c.card.faction] ?? 0) + c.quantity;
  const factionMastery = ["bitcoin", "meme", "ethereum", "stable", "solana", "degen"].map((f) => ({
    faction: f,
    level: Math.max(1, Math.min(20, Math.floor((factionCounts[f] ?? 0) / 3) + 1)),
  }));

  // Recent matches with opponent names
  const oppIds = recent.map((m) => (m.player1Id === userId ? m.player2Id : m.player1Id)).filter((x): x is string => !!x);
  const opps = oppIds.length ? await prisma.user.findMany({ where: { id: { in: oppIds } } }) : [];
  const oppName = new Map(opps.map((o) => [o.id, o.username]));
  const recentMatches = recent.map((m) => {
    const oppId = m.player1Id === userId ? m.player2Id : m.player1Id;
    const won = m.winnerId === userId;
    return {
      opponent: oppId ? (oppName.get(oppId) ?? "Player") : "AI",
      won, mode: m.mode, delta: won ? 15 : -10,
      endedAt: m.endedAt?.toISOString() ?? null,
    };
  });

  const wins = user.seasonWins, losses = user.seasonLosses, games = wins + losses;
  res.json({
    username: user.username,
    walletAddress: user.walletAddress,
    fragments: user.fragments,
    rankTier: user.rankTier,
    rankStars: user.rankStars,
    rankPoints: user.rankPoints,
    seasonWins: wins,
    seasonLosses: losses,
    winStreak,
    level: Math.max(1, Math.floor(user.rankPoints / 100) + 1),
    games,
    cardsOwned,
    legendaries,
    packsOpened: user.packsOpened,
    questsDone,
    factionMastery,
    recentMatches,
    accessTier: user.accessTier,
  });
});

// ─────────────────────────── Generators ───────────────────────────

async function generatePackCards(
  packType: string,
  faction: string | undefined,
  user: { standardPacksEpic: number; standardPacksLegendary: number },
  userId: string
): Promise<Array<{ cardId: string; rarity: string }>> {
  const where: Record<string, unknown> = { collectible: true };
  if (packType === "faction" && faction) where.faction = faction;
  if (packType === "season") where.set = { in: ["genesis", "genesis_drop"] };
  if (packType === "standard") where.set = { not: "genesis_drop" };
  if (packType === "legendary") {
    where.rarity = { in: ["legendary", "epic", "rare"] };
    where.set = { not: "genesis_drop" };
  }

  const allCards = await prisma.card.findMany({ where });
  if (allCards.length === 0) return [];

  const legendaryRate = packType === "season" ? 0.01 : 0.05;
  const epicRate = 0.15;

  const getByRarity = (rarity: string) => allCards.filter((c) => c.rarity === rarity);
  const pick = (pool: typeof allCards) => pool[Math.floor(Math.random() * pool.length)]!;
  const cards: Array<{ cardId: string; rarity: string }> = [];

  let guaranteedLegendary = packType === "legendary";
  let guaranteedEpic = user.standardPacksEpic >= 19;
  if (user.standardPacksLegendary >= 39) guaranteedLegendary = true;

  const rareOrHigher = allCards.filter((c) => ["rare", "epic", "legendary"].includes(c.rarity));
  const slot1 = pick(rareOrHigher.length > 0 ? rareOrHigher : allCards);
  cards.push({ cardId: slot1.id, rarity: slot1.rarity });

  for (let i = 0; i < 4; i++) {
    let rarity: string;
    const roll = Math.random();
    if (guaranteedLegendary && i === 1) { rarity = "legendary"; guaranteedLegendary = false; }
    else if (guaranteedEpic && i === 1) { rarity = "epic"; guaranteedEpic = false; }
    else if (roll < legendaryRate) rarity = "legendary";
    else if (roll < legendaryRate + epicRate) rarity = "epic";
    else rarity = "common";
    const pool = getByRarity(rarity);
    const card = pick(pool.length > 0 ? pool : allCards);
    cards.push({ cardId: card.id, rarity: card.rarity });
  }

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
        userId, type: q.type, description: q.description, target: q.target, rewardJson: q.reward,
        expiresAt: tomorrow,
        completed: q.type === "daily_login",
        progress: q.type === "daily_login" ? 1 : 0,
      },
    });
  }
}

export default router;
