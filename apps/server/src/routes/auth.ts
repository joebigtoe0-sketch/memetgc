import { Router } from "express";
import { prisma } from "@memetgc/db";
import { signToken, requireAuth, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";

const router: ReturnType<typeof Router> = Router();

const WalletSchema = z.object({ walletAddress: z.string().min(32).max(64) });
const VerifySchema = z.object({ walletAddress: z.string().min(32).max(64), signature: z.string().min(1) });
const UsernameSchema = z.object({ username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/) });

function isValidSolanaAddress(addr: string): boolean {
  try {
    return bs58.decode(addr).length === 32;
  } catch {
    return false;
  }
}

function buildSignInMessage(wallet: string, nonce: string): string {
  return `Sign in to Degen TCG\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

async function generateHandle(wallet: string): Promise<string> {
  const base = `degen_${wallet.slice(0, 4)}${wallet.slice(-4)}`.toLowerCase();
  let candidate = base;
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
    candidate = `${base}_${crypto.randomBytes(2).toString("hex")}`;
  }
  return `${base}_${crypto.randomBytes(4).toString("hex")}`;
}

// POST /api/auth/nonce — begin Sign-In-With-Solana; returns a message to sign
router.post("/nonce", async (req, res) => {
  const parsed = WalletSchema.safeParse(req.body);
  if (!parsed.success || !isValidSolanaAddress(parsed.data.walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const walletAddress = parsed.data.walletAddress;
  const nonce = crypto.randomBytes(16).toString("hex");

  let user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) {
    const username = await generateHandle(walletAddress);
    user = await prisma.user.create({
      data: { username, walletAddress, hasUsername: false, isNewPlayer: true, authNonce: nonce },
    });
    try {
      await grantStarterContent(user.id);
    } catch (err) {
      console.error("grantStarterContent failed:", err);
    }
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { authNonce: nonce } });
  }

  res.json({ message: buildSignInMessage(walletAddress, nonce) });
});

// POST /api/auth/verify — verify the signed nonce, return a JWT
router.post("/verify", async (req, res) => {
  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success || !isValidSolanaAddress(parsed.data.walletAddress)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { walletAddress, signature } = parsed.data;

  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user || !user.authNonce) {
    res.status(401).json({ error: "Request a nonce first" });
    return;
  }

  const message = buildSignInMessage(walletAddress, user.authNonce);
  let valid = false;
  try {
    valid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(walletAddress)
    );
  } catch {
    valid = false;
  }

  if (!valid) {
    res.status(401).json({ error: "Signature verification failed" });
    return;
  }

  // Consume nonce so the signature can't be replayed
  await prisma.user.update({ where: { id: user.id }, data: { authNonce: null } });

  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, userId: user.id, username: user.username, hasUsername: user.hasUsername });
});

// POST /api/auth/username — set chosen username (first-time onboarding / rename)
router.post("/username", requireAuth, async (req: AuthRequest, res) => {
  const parsed = UsernameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username must be 3-20 chars (letters, numbers, underscore)" });
    return;
  }
  const username = parsed.data.username;

  const existing = await prisma.user.findFirst({ where: { username, NOT: { id: req.user!.userId } } });
  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { username, hasUsername: true },
  });

  // Reissue token so the embedded username stays in sync
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, username: user.username, hasUsername: true });
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
    hasUsername: user.hasUsername,
    fragments: user.fragments,
    rankTier: user.rankTier,
    rankStars: user.rankStars,
    boardThemeId: user.boardThemeId,
    walletAddress: user.walletAddress,
    accessTier: user.accessTier,
    isNewPlayer: user.isNewPlayer,
  });
});

async function grantStarterContent(userId: string): Promise<void> {
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

  // Starter booster packs (opened from the Packs page)
  await prisma.packInventory.upsert({
    where: { userId_packType: { userId, packType: "standard" } },
    update: { quantity: { increment: 5 } },
    create: { userId, packType: "standard", quantity: 5 },
  });

  // Some starter fragments to spend in the shop
  await prisma.user.update({ where: { id: userId }, data: { fragments: { increment: 300 } } });

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
