import { Router } from "express";
import { prisma } from "@memetgc/db";
import { signToken, requireAuth, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import crypto from "crypto";

const router: ReturnType<typeof Router> = Router();

const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "degen_salt").digest("hex");
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
  });

  if (existing) {
    res.status(409).json({ error: "Username or email already taken" });
    return;
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: hashPassword(password),
      fragments: 0,
      isNewPlayer: true,
    },
  });

  // Grant starter resources
  await grantStarterContent(user.id);

  const token = signToken({ userId: user.id, username: user.username });
  res.status(201).json({ token, userId: user.id, username: user.username });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, userId: user.id, username: user.username });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    fragments: user.fragments,
    rankTier: user.rankTier,
    rankStars: user.rankStars,
    boardThemeId: user.boardThemeId,
    walletAddress: user.walletAddress,
    accessTier: user.accessTier,
    isNewPlayer: user.isNewPlayer,
  });
});

// POST /api/auth/wallet — link wallet
router.post("/wallet", requireAuth, async (req: AuthRequest, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress || typeof walletAddress !== "string") {
    res.status(400).json({ error: "walletAddress required" });
    return;
  }

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { walletAddress: walletAddress.toLowerCase() },
  });

  res.json({ success: true });
});

async function grantStarterContent(userId: string): Promise<void> {
  // Fetch starter cards from DB
  const starterCardIds = [
    "bitcoin_paper_hands", "bitcoin_baby_hodl", "bitcoin_block_defender",
    "bitcoin_mining_rig", "bitcoin_cold_wallet", "bitcoin_stack_sats",
    "bitcoin_hodl_the_line", "bitcoin_hardware_security", "bitcoin_maxi",
    "bitcoin_the_halving",
    "meme_moon_boy", "meme_doge_gang", "meme_pepe_deploy", "meme_hype_wave",
    "meme_diamond_frog", "meme_viral_tweet", "meme_to_the_moon",
    "meme_elon_shill", "meme_pump_it", "meme_100x_bet",
    "stable_risk_manager", "stable_yield_farmer", "stable_liquidation",
    "stable_flash_crash", "stable_collateral", "stable_peg_defence",
    "stable_stablecoin", "stable_dai_hard", "stable_reserve_protocol", "stable_the_fed",
  ];

  for (const cardId of starterCardIds) {
    await prisma.collectionEntry.upsert({
      where: { userId_cardId: { userId, cardId } },
      update: {},
      create: { userId, cardId, quantity: 4 },
    });
  }

  const starterDecks = [
    {
      name: "HODL Gang",
      heroId: "hero_satoshi",
      cards: [
        { id: "bitcoin_paper_hands", qty: 4 },
        { id: "bitcoin_baby_hodl", qty: 4 },
        { id: "bitcoin_block_defender", qty: 3 },
        { id: "bitcoin_mining_rig", qty: 3 },
        { id: "bitcoin_cold_wallet", qty: 2 },
        { id: "bitcoin_stack_sats", qty: 3 },
        { id: "bitcoin_hodl_the_line", qty: 3 },
        { id: "bitcoin_hardware_security", qty: 3 },
        { id: "bitcoin_maxi", qty: 2 },
        { id: "bitcoin_the_halving", qty: 3 },
      ],
    },
    {
      name: "Meme Machine",
      heroId: "hero_elon",
      cards: [
        { id: "meme_moon_boy", qty: 4 },
        { id: "meme_doge_gang", qty: 4 },
        { id: "meme_pepe_deploy", qty: 3 },
        { id: "meme_hype_wave", qty: 3 },
        { id: "meme_diamond_frog", qty: 3 },
        { id: "meme_viral_tweet", qty: 3 },
        { id: "meme_to_the_moon", qty: 3 },
        { id: "meme_elon_shill", qty: 2 },
        { id: "meme_pump_it", qty: 3 },
        { id: "meme_100x_bet", qty: 2 },
      ],
    },
    {
      name: "Stablecoin Control",
      heroId: "hero_circle_ceo",
      cards: [
        { id: "stable_risk_manager", qty: 4 },
        { id: "stable_yield_farmer", qty: 3 },
        { id: "stable_liquidation", qty: 3 },
        { id: "stable_flash_crash", qty: 3 },
        { id: "stable_collateral", qty: 3 },
        { id: "stable_peg_defence", qty: 3 },
        { id: "stable_stablecoin", qty: 3 },
        { id: "stable_dai_hard", qty: 3 },
        { id: "stable_reserve_protocol", qty: 3 },
        { id: "stable_the_fed", qty: 2 },
      ],
    },
  ];

  for (const starterDeck of starterDecks) {
    const deck = await prisma.deck.create({
      data: { userId, name: starterDeck.name, heroId: starterDeck.heroId, isStarter: true },
    });
    for (const { id, qty } of starterDeck.cards) {
      await prisma.deckCard.create({ data: { deckId: deck.id, cardId: id, quantity: qty } });
    }
  }
}

export default router;
