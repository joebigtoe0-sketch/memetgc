import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { computeWinStreak } from "../game/results.js";
import { getDegenBalance, isDegenConfigured } from "../lib/helius.js";
import { getTokenBalance, MIN_PLAY_TOKENS } from "../lib/solana.js";
import { tierFromPoints } from "../game/rank.js";
import { getLadderStanding } from "../game/leaderboard.js";

const router: ReturnType<typeof Router> = Router();

interface PackDef { type: string; name: string; cost: number; currency: "frags" | "degen"; }
const PACKS: Record<string, PackDef> = {
  standard: { type: "standard", name: "Standard Pack", cost: 100, currency: "frags" },
  season: { type: "season", name: "Genesis Drop Pack", cost: 150, currency: "frags" },
};

/** Pack types players may still open from inventory (no longer sold). */
const LEGACY_PACK_TYPES = new Set(["legendary", "faction"]);

function isOpenablePackType(packType: string): boolean {
  return packType in PACKS || LEGACY_PACK_TYPES.has(packType);
}

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

  const reward = quest.rewardJson as { fragments?: number };
  const userId = req.user!.userId;
  const fragments = reward.fragments ?? 0;
  await prisma.$transaction(async (tx) => {
    await tx.dailyQuest.update({ where: { id: quest.id }, data: { claimedAt: new Date() } });
    if (fragments > 0) {
      await tx.user.update({ where: { id: userId }, data: { fragments: { increment: fragments } } });
    }
  });
  res.json({ success: true, reward: { fragments } });
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
    res.status(501).json({ error: "On-chain $MEMEPOOL purchases are coming soon" });
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
  if (!isOpenablePackType(packType)) { res.status(400).json({ error: "Unknown pack type" }); return; }
  const userId = req.user!.userId;

  const inv = await prisma.packInventory.findUnique({ where: { userId_packType: { userId, packType } } });
  if (!inv || inv.quantity <= 0) { res.status(400).json({ error: "You don't own this pack" }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const cards = await generatePackCards(packType, faction);

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
      art_url: card.artUrl ?? `/card-art/${card.id}.png`,
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

// GET /api/economy/access — does the wallet hold enough $MEMEPOOL to play?
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

  const [collection, questsDone, recent, winStreak, cosmetics] = await Promise.all([
    prisma.collectionEntry.findMany({ where: { userId }, include: { card: true } }),
    prisma.dailyQuest.count({ where: { userId, claimedAt: { not: null } } }),
    prisma.match.findMany({
      where: { OR: [{ player1Id: userId }, { player2Id: userId }], endedAt: { not: null } },
      orderBy: { endedAt: "desc" }, take: 8,
    }),
    computeWinStreak(userId),
    prisma.userCosmetic.findMany({ where: { userId }, select: { type: true, value: true } }),
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
  const { tier, stars } = tierFromPoints(user.rankPoints);
  const standing = await getLadderStanding(user.id, user.rankPoints);
  res.json({
    username: user.username,
    walletAddress: user.walletAddress,
    fragments: user.fragments,
    rankTier: standing.isMemepool ? "degen" : tier,
    rankStars: stars,
    rankPoints: user.rankPoints,
    ladderPosition: standing.position,
    isMemepool: standing.isMemepool,
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
    cosmetics,
    equippedCardBack: user.equippedCardBack,
    equippedBadge: user.equippedBadge,
  });
});

// POST /api/economy/cosmetics/equip — equip an owned card back or badge (value:null unequips)
router.post("/cosmetics/equip", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { type, value } = req.body as { type?: string; value?: string | null };

  if (type !== "card_back" && type !== "badge") {
    res.status(400).json({ error: "type must be 'card_back' or 'badge'" });
    return;
  }

  if (value != null) {
    const owned = await prisma.userCosmetic.findFirst({ where: { userId, type, value } });
    if (!owned) {
      res.status(403).json({ error: "You don't own that cosmetic" });
      return;
    }
  }

  const field = type === "card_back" ? "equippedCardBack" : "equippedBadge";
  await prisma.user.update({ where: { id: userId }, data: { [field]: value ?? null } });
  res.json({ ok: true, type, value: value ?? null });
});

// ─────────────────────────── Generators ───────────────────────────

/** Per-card rate so P(≥1 legendary in 5 cards) ≈ 1 / packsPerLegendary */
function perCardLegendaryRate(packsPerLegendary: number): number {
  return 1 - (1 - 1 / packsPerLegendary) ** (1 / 5);
}

const PACK_RARITY_ODDS: Record<string, { legendary: number; epic: number; rare: number }> = {
  standard: {
    legendary: perCardLegendaryRate(50), // ~1 legendary per 50 packs
    epic: 0.12,
    rare: 0.23,
  },
  season: {
    legendary: perCardLegendaryRate(100), // ~1 legendary per 100 packs
    epic: 0.10,
    rare: 0.21,
  },
  faction: {
    legendary: perCardLegendaryRate(50),
    epic: 0.12,
    rare: 0.23,
  },
};

function rollRarity(odds: { legendary: number; epic: number; rare: number }): string {
  const roll = Math.random();
  if (roll < odds.legendary) return "legendary";
  if (roll < odds.legendary + odds.epic) return "epic";
  if (roll < odds.legendary + odds.epic + odds.rare) return "rare";
  return "common";
}

async function generatePackCards(
  packType: string,
  faction: string | undefined,
): Promise<Array<{ cardId: string; rarity: string }>> {
  const where: Record<string, unknown> = { collectible: true };
  if (packType === "faction" && faction) where.faction = faction;
  if (packType === "season") where.set = "genesis_drop";
  if (packType === "standard") where.set = { not: "genesis_drop" };
  if (packType === "legendary") {
    where.rarity = { in: ["legendary", "epic", "rare"] };
    where.set = { not: "genesis_drop" };
  }

  const allCards = await prisma.card.findMany({ where });
  if (allCards.length === 0) return [];

  const odds = PACK_RARITY_ODDS[packType] ?? PACK_RARITY_ODDS.standard;
  const getByRarity = (rarity: string) => allCards.filter((c) => c.rarity === rarity);
  const pick = (pool: typeof allCards) => pool[Math.floor(Math.random() * pool.length)]!;
  const cards: Array<{ cardId: string; rarity: string }> = [];

  const addCard = (rarity: string) => {
    const pool = getByRarity(rarity);
    const card = pick(pool.length > 0 ? pool : allCards);
    cards.push({ cardId: card.id, rarity: card.rarity });
  };

  // Legacy legendary packs (inventory only): 1 guaranteed legendary + 4 rolled cards
  if (packType === "legendary") {
    addCard("legendary");
    for (let i = 0; i < 4; i++) addCard(rollRarity(odds));
    return cards;
  }

  // All 5 slots use the same rarity roll — no pity, no guaranteed rare+ slot
  for (let i = 0; i < 5; i++) {
    addCard(rollRarity(odds));
  }

  return cards;
}

import { QUEST_FRAGMENTS } from "../game/matchRewards.js";

async function generateDailyQuests(userId: string): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const questTemplates = [
    { type: "daily_login", description: "Log in today", target: 1, reward: { fragments: QUEST_FRAGMENTS.low } },
    {
      type: "win_games",
      description: "Win 3 games (Casual or Ranked)",
      target: 3,
      reward: { fragments: QUEST_FRAGMENTS.medium },
    },
    {
      type: "destroy_minions",
      description: "Destroy 15 minions (Casual or Ranked)",
      target: 15,
      reward: { fragments: QUEST_FRAGMENTS.high },
    },
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
