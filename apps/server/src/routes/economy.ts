import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { computeWinStreak } from "../game/results.js";
import { getDegenBalance, isDegenConfigured } from "../lib/helius.js";
import { getTokenBalance, getTokenBalanceForMint, MIN_PLAY_TOKENS } from "../lib/solana.js";
import { tierFromPoints } from "../game/rank.js";
import { getLadderStanding } from "../game/leaderboard.js";
import { generateDailyQuests, updateQuests } from "../game/dailyQuests.js";
import { bumpPlatformStat } from "../admin/platformStats.js";
import { CARD_BACKS, getCardBackDef, getSeasonReward, type SeasonRewardTier } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

interface PackDef { type: string; name: string; cost: number; currency: "frags" | "degen"; }
const PACKS: Record<string, PackDef> = {
  standard: { type: "standard", name: "Standard Pack", cost: 100, currency: "frags" },
  season: { type: "season", name: "Genesis Drop Pack", cost: 150, currency: "frags" },
};

/** Discounted multi-pack bundles — must match shop UI prices exactly. */
const BUNDLES: Record<string, { packType: string; count: number; cost: number; name: string }> = {
  starter: { packType: "standard", count: 5, cost: 450, name: "Starter Bundle" },
  memepool: { packType: "standard", count: 15, cost: 1250, name: "Memepool Bundle" },
  genesis_trio: { packType: "season", count: 3, cost: 400, name: "Genesis Trio" },
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

// POST /api/economy/packs/buy — buy pack(s) into inventory
router.post("/packs/buy", requireAuth, async (req: AuthRequest, res) => {
  const { packType = "standard", currency = "frags", count = 1, bundleId } = req.body as {
    packType?: string;
    currency?: string;
    count?: number;
    bundleId?: string;
  };

  if (currency === "degen") {
    res.status(501).json({ error: "On-chain $MEMEPOOL purchases are coming soon" });
    return;
  }

  let grantPackType: string;
  let qty: number;
  let totalCost: number;

  if (bundleId) {
    const bundle = BUNDLES[bundleId];
    if (!bundle) { res.status(400).json({ error: "Unknown bundle" }); return; }
    grantPackType = bundle.packType;
    qty = bundle.count;
    totalCost = bundle.cost;
  } else {
    const pack = PACKS[packType];
    if (!pack) { res.status(400).json({ error: "Unknown pack type" }); return; }
    grantPackType = pack.type;
    qty = Math.max(1, Math.min(40, Number(count) || 1));
    totalCost = pack.cost * qty;
  }

  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.fragments < totalCost) { res.status(400).json({ error: "Not enough fragments" }); return; }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { fragments: { decrement: totalCost } } }),
    prisma.packInventory.upsert({
      where: { userId_packType: { userId, packType: grantPackType } },
      update: { quantity: { increment: qty } },
      create: { userId, packType: grantPackType, quantity: qty },
    }),
  ]);

  void bumpPlatformStat("packs_bought", qty);
  void bumpPlatformStat("fragments_spent_packs", totalCost);

  res.json({ success: true, packType: grantPackType, quantity: qty, newBalance: user.fragments - totalCost });
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
        where: { userId_cardId_frameTier: { userId, cardId: c.cardId, frameTier: "default" } },
        update: { quantity: { increment: 1 } },
        create: { userId, cardId: c.cardId, frameTier: "default", quantity: 1 },
      })
    ),
  ]);

  await updateQuests(userId, { packsOpened: 1 }, new Date());

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
      art_url: card.artUrl ?? (card.id === "coin" ? "/card-art/gas_token.jpg" : `/card-art/${card.id}.jpg`),
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

  const [collection, questsDone, recent, winStreak, cosmetics, allMatches] = await Promise.all([
    prisma.collectionEntry.findMany({ where: { userId }, include: { card: true } }),
    prisma.dailyQuest.count({ where: { userId, claimedAt: { not: null } } }),
    prisma.match.findMany({
      where: { OR: [{ player1Id: userId }, { player2Id: userId }], endedAt: { not: null } },
      orderBy: { endedAt: "desc" }, take: 8,
    }),
    computeWinStreak(userId),
    prisma.userCosmetic.findMany({ where: { userId }, select: { type: true, value: true } }),
    prisma.match.findMany({
      where: { OR: [{ player1Id: userId }, { player2Id: userId }], endedAt: { not: null } },
      select: { mode: true, winnerId: true },
    }),
  ]);

  // Per-mode win/loss breakdown, derived from match history.
  const modeStats = {
    ranked: { wins: 0, losses: 0 },
    casual: { wins: 0, losses: 0 },
    practice: { wins: 0, losses: 0 },
  };
  for (const m of allMatches) {
    const bucket = modeStats[m.mode as keyof typeof modeStats];
    if (!bucket) continue;
    if (m.winnerId === userId) bucket.wins++;
    else bucket.losses++;
  }

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
  const rankedGames = modeStats.ranked.wins + modeStats.ranked.losses;
  const casualGames = modeStats.casual.wins + modeStats.casual.losses;
  const practiceGames = modeStats.practice.wins + modeStats.practice.losses;
  const { tier, stars } = tierFromPoints(user.rankPoints);
  const standing = await getLadderStanding(user.id, user.rankPoints);
  const peakInfo = tierFromPoints(user.seasonPeakPoints);
  const rewardTier: SeasonRewardTier = standing.isMemepool ? "degen" : peakInfo.tier;
  const seasonReward = getSeasonReward(rewardTier);
  res.json({
    username: user.username,
    walletAddress: user.walletAddress,
    fragments: user.fragments,
    rankTier: standing.isMemepool ? "degen" : tier,
    rankStars: stars,
    rankPoints: user.rankPoints,
    ladderPosition: standing.position,
    isMemepool: standing.isMemepool,
    seasonPeakPoints: user.seasonPeakPoints,
    seasonPeakTier: peakInfo.tier,
    seasonPeakStars: peakInfo.stars,
    seasonRewardTier: rewardTier,
    seasonReward: {
      tier: seasonReward.tier,
      label: seasonReward.label,
      fragments: seasonReward.fragments,
      cardBack: seasonReward.cardBack,
      badge: seasonReward.badge,
    },
    seasonWins: wins,
    seasonLosses: losses,
    modeStats,
    winStreak,
    rankedWinStreak: winStreak,
    gameCounts: {
      ranked: rankedGames,
      casual: casualGames,
      practice: practiceGames,
      pvp: rankedGames + casualGames,
      total: rankedGames + casualGames + practiceGames,
    },
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
    tutorialDone: user.tutorialDone,
  });
});

/**
 * Whether a user may use a given card back id.
 *  - default: always
 *  - token-gated: wallet must currently hold >= min of the mint
 *  - cosmetic (season reward etc.): must own the matching UserCosmetic
 */
async function canUseCardBack(
  userId: string,
  walletAddress: string | null,
  cardBackId: string
): Promise<boolean> {
  const def = CARD_BACKS.find((c) => c.id === cardBackId);
  if (def) {
    if (def.gate.type === "default") return true;
    if (def.gate.type === "token") {
      if (!walletAddress) return false;
      const balance = await getTokenBalanceForMint(walletAddress, def.gate.mint);
      return balance >= def.gate.min;
    }
    // cosmetic-gated registry entry falls through to ownership check below
  }
  const owned = await prisma.userCosmetic.findFirst({ where: { userId, type: "card_back", value: cardBackId } });
  return !!owned;
}

// GET /api/economy/card-backs — all selectable card backs with ownership/eligibility
router.get("/card-backs", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Live token balances for any token-gated card backs (one call per distinct mint).
  const tokenGates = CARD_BACKS.filter((c) => c.gate.type === "token");
  const mintBalances = new Map<string, number>();
  if (user.walletAddress) {
    await Promise.all(
      tokenGates.map(async (c) => {
        if (c.gate.type !== "token") return;
        if (mintBalances.has(c.gate.mint)) return;
        const bal = await getTokenBalanceForMint(user.walletAddress!, c.gate.mint);
        mintBalances.set(c.gate.mint, bal);
      })
    );
  }

  const ownedCosmetics = await prisma.userCosmetic.findMany({
    where: { userId, type: "card_back" },
    select: { value: true },
  });
  const ownedSet = new Set(ownedCosmetics.map((c) => c.value));

  const items = CARD_BACKS.map((c) => {
    let unlocked = false;
    let balance: number | undefined;
    if (c.gate.type === "default") {
      unlocked = true;
    } else if (c.gate.type === "token") {
      balance = mintBalances.get(c.gate.mint) ?? 0;
      unlocked = !!user.walletAddress && balance >= c.gate.min;
    } else {
      unlocked = ownedSet.has(c.id);
    }
    return {
      id: c.id,
      name: c.name,
      image: c.image,
      description: c.description,
      gate: c.gate,
      unlocked,
      ...(balance != null ? { balance } : {}),
    };
  });

  res.json({ equipped: user.equippedCardBack ?? getCardBackDef(null).id, cardBacks: items });
});

// POST /api/economy/cosmetics/equip — equip an owned/eligible card back or badge (value:null unequips)
router.post("/cosmetics/equip", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { type, value } = req.body as { type?: string; value?: string | null };

  if (type !== "card_back" && type !== "badge") {
    res.status(400).json({ error: "type must be 'card_back' or 'badge'" });
    return;
  }

  if (type === "card_back") {
    // Normalize the default id to null (matches the DB default / "no back equipped").
    const cardBackId = value && value !== getCardBackDef(null).id ? value : null;
    if (cardBackId != null) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletAddress: true } });
      const allowed = await canUseCardBack(userId, user?.walletAddress ?? null, cardBackId);
      if (!allowed) {
        res.status(403).json({ error: "This card back is locked" });
        return;
      }
    }
    await prisma.user.update({ where: { id: userId }, data: { equippedCardBack: cardBackId } });
    res.json({ ok: true, type, value: cardBackId });
    return;
  }

  // Badges: must own the cosmetic.
  if (value != null) {
    const owned = await prisma.userCosmetic.findFirst({ where: { userId, type, value } });
    if (!owned) {
      res.status(403).json({ error: "You don't own that cosmetic" });
      return;
    }
  }
  await prisma.user.update({ where: { id: userId }, data: { equippedBadge: value ?? null } });
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

export default router;
