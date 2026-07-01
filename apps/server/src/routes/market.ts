import { Router } from "express";
import { prisma, Prisma } from "@memetgc/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  getTokenBalance,
  getMintDecimals,
  verifyPurchaseTx,
  toBaseUnits,
  TREASURY_WALLET,
  MINT_ADDRESS,
} from "../lib/solana.js";

const router: ReturnType<typeof Router> = Router();

const FEE_RATE = 0.05;
const RESERVE_MS = 30_000;
const CANCEL_COOLDOWN_MS = 30_000;

/** Canonical message a seller signs to authorize a listing. Must match the frontend. */
export function buildListingMessage(args: {
  wallet: string;
  kind: string;
  itemId: string;
  price: number;
}): string {
  return [
    "List for sale on Legends of the Mempool",
    "",
    `Wallet: ${args.wallet}`,
    `Item: ${args.kind}:${args.itemId}`,
    `Price: ${args.price} $MEMPOOL`,
  ].join("\n");
}

function verifySignature(message: string, signature: string, wallet: string): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(wallet)
    );
  } catch {
    return false;
  }
}

function priceNum(p: Prisma.Decimal): number {
  return Number(p.toString());
}

// ─────────────────────────── Read endpoints ───────────────────────────

// GET /api/market/summary — lowest price + count per cardId and per packType (active only)
router.get("/summary", requireAuth, async (_req: AuthRequest, res) => {
  const grouped = await prisma.marketListing.groupBy({
    by: ["kind", "cardId", "packType"],
    where: { status: "active" },
    _min: { price: true },
    _count: { _all: true },
  });

  const cards: Record<string, { lowestPrice: number; count: number }> = {};
  const packs: Record<string, { lowestPrice: number; count: number }> = {};
  for (const g of grouped) {
    const lowest = g._min.price ? priceNum(g._min.price) : 0;
    const entry = { lowestPrice: lowest, count: g._count._all };
    if (g.kind === "card" && g.cardId) cards[g.cardId] = entry;
    else if (g.kind === "pack" && g.packType) packs[g.packType] = entry;
  }
  res.json({ cards, packs });
});

// GET /api/market/listings?kind=card&cardId=... (or packType) — 5 lowest active + total count
router.get("/listings", requireAuth, async (req: AuthRequest, res) => {
  const kind = String(req.query.kind ?? "");
  if (kind !== "card" && kind !== "pack") { res.status(400).json({ error: "Invalid kind" }); return; }
  const where: Prisma.MarketListingWhereInput = { status: "active", kind };
  if (kind === "card") {
    const cardId = req.query.cardId ? String(req.query.cardId) : null;
    if (!cardId) { res.status(400).json({ error: "cardId required" }); return; }
    where.cardId = cardId;
  } else {
    const packType = req.query.packType ? String(req.query.packType) : null;
    if (!packType) { res.status(400).json({ error: "packType required" }); return; }
    where.packType = packType;
  }

  const [rows, count] = await Promise.all([
    prisma.marketListing.findMany({ where, orderBy: [{ price: "asc" }, { createdAt: "asc" }], take: 5 }),
    prisma.marketListing.count({ where }),
  ]);

  res.json({
    count,
    listings: rows.map((r) => ({ id: r.id, price: priceNum(r.price), createdAt: r.createdAt })),
  });
});

// GET /api/market/mine — caller's non-terminal listings
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  const rows = await prisma.marketListing.findMany({
    where: { sellerId: req.user!.userId, status: { in: ["active", "reserved", "cancelling"] } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      cardId: r.cardId,
      packType: r.packType,
      price: priceNum(r.price),
      status: r.status,
      cooldownUntil: r.cooldownUntil,
      reservedUntil: r.reservedUntil,
      createdAt: r.createdAt,
    }))
  );
});

// ─────────────────────────── List (escrow) ───────────────────────────

const ListSchema = z.object({
  kind: z.enum(["card", "pack"]),
  cardId: z.string().optional(),
  packType: z.string().optional(),
  price: z.number().positive().max(1_000_000_000),
  signature: z.string().min(1),
  message: z.string().min(1),
});

router.post("/list", requireAuth, async (req: AuthRequest, res) => {
  const parsed = ListSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { kind, cardId, packType, price, signature, message } = parsed.data;
  const itemId = kind === "card" ? cardId : packType;
  if (!itemId) { res.status(400).json({ error: "Item id required" }); return; }

  // Round price to 6 decimals to match the DB precision.
  const roundedPrice = Math.round(price * 1e6) / 1e6;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.walletAddress) { res.status(400).json({ error: "Wallet required" }); return; }

  // Verify the seller signed the canonical listing message.
  const expected = buildListingMessage({ wallet: user.walletAddress, kind, itemId, price: roundedPrice });
  if (message !== expected || !verifySignature(message, signature, user.walletAddress)) {
    res.status(401).json({ error: "Signature verification failed" });
    return;
  }

  try {
    const listing = await prisma.$transaction(async (tx) => {
      if (kind === "card") {
        const entry = await tx.collectionEntry.findUnique({
          where: { userId_cardId: { userId: user.id, cardId: itemId } },
        });
        if (!entry || entry.quantity < 1) throw new Error("INSUFFICIENT");
        await tx.collectionEntry.update({
          where: { userId_cardId: { userId: user.id, cardId: itemId } },
          data: { quantity: { decrement: 1 } },
        });
      } else {
        const inv = await tx.packInventory.findUnique({
          where: { userId_packType: { userId: user.id, packType: itemId } },
        });
        if (!inv || inv.quantity < 1) throw new Error("INSUFFICIENT");
        await tx.packInventory.update({
          where: { userId_packType: { userId: user.id, packType: itemId } },
          data: { quantity: { decrement: 1 } },
        });
      }

      return tx.marketListing.create({
        data: {
          sellerId: user.id,
          kind,
          cardId: kind === "card" ? itemId : null,
          packType: kind === "pack" ? itemId : null,
          price: new Prisma.Decimal(roundedPrice),
          status: "active",
        },
      });
    });

    res.json({ id: listing.id, price: priceNum(listing.price), status: listing.status });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT") {
      res.status(400).json({ error: "You don't own this item" });
      return;
    }
    console.error("market/list failed:", err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// ─────────────────────────── Cancel ───────────────────────────

router.post("/listings/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const listing = await prisma.marketListing.findFirst({ where: { id, sellerId: req.user!.userId } });
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.status === "cancelling") {
    res.json({ status: "cancelling", cooldownUntil: listing.cooldownUntil });
    return;
  }
  if (listing.status !== "active" && listing.status !== "reserved") {
    res.status(400).json({ error: "Listing cannot be cancelled" });
    return;
  }

  const now = Date.now();
  const cooldownUntil = listing.status === "reserved" && listing.reservedUntil
    ? new Date(Math.max(listing.reservedUntil.getTime(), now + CANCEL_COOLDOWN_MS))
    : new Date(now + CANCEL_COOLDOWN_MS);

  const updated = await prisma.marketListing.updateMany({
    where: { id, status: { in: ["active", "reserved"] } },
    data: { status: "cancelling", cooldownUntil },
  });
  if (updated.count === 0) { res.status(409).json({ error: "Listing state changed" }); return; }

  res.json({ status: "cancelling", cooldownUntil });
});

// ─────────────────────────── Reserve ───────────────────────────

const ReserveSchema = z.object({
  kind: z.enum(["card", "pack"]),
  cardId: z.string().optional(),
  packType: z.string().optional(),
});

router.post("/reserve", requireAuth, async (req: AuthRequest, res) => {
  const parsed = ReserveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { kind, cardId, packType } = parsed.data;
  const itemId = kind === "card" ? cardId : packType;
  if (!itemId) { res.status(400).json({ error: "Item id required" }); return; }

  const buyer = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!buyer?.walletAddress) { res.status(400).json({ error: "Wallet required" }); return; }

  const where: Prisma.MarketListingWhereInput = { status: "active", kind };
  if (kind === "card") where.cardId = itemId;
  else where.packType = itemId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lowest = await tx.marketListing.findFirst({
        where,
        orderBy: [{ price: "asc" }, { createdAt: "asc" }],
      });
      if (!lowest) throw new Error("NONE");
      if (lowest.sellerId === buyer.id) throw new Error("OWN");

      const price = priceNum(lowest.price);
      const total = Math.round(price * (1 + FEE_RATE) * 1e6) / 1e6;

      // Check buyer's on-chain balance covers price + fee.
      const balance = await getTokenBalance(buyer.walletAddress!);
      if (balance < total) throw new Error("BALANCE");

      const claimed = await tx.marketListing.updateMany({
        where: { id: lowest.id, status: "active" },
        data: {
          status: "reserved",
          reservedById: buyer.id,
          reservedUntil: new Date(Date.now() + RESERVE_MS),
        },
      });
      if (claimed.count === 0) throw new Error("RACE");

      const seller = await tx.user.findUnique({ where: { id: lowest.sellerId } });
      if (!seller?.walletAddress) throw new Error("SELLER");

      return { listing: lowest, sellerWallet: seller.walletAddress, price, total };
    });

    const decimals = await getMintDecimals();
    const feeAmount = Math.round(result.price * FEE_RATE * 1e6) / 1e6;

    res.json({
      listingId: result.listing.id,
      sellerWallet: result.sellerWallet,
      treasuryWallet: TREASURY_WALLET,
      mint: MINT_ADDRESS,
      decimals,
      sellerAmount: result.price,
      feeAmount,
      total: result.total,
      reservedUntil: new Date(Date.now() + RESERVE_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NONE") { res.status(404).json({ error: "No listings available" }); return; }
    if (msg === "OWN") { res.status(400).json({ error: "You cannot buy your own listing" }); return; }
    if (msg === "BALANCE") { res.status(402).json({ error: "Insufficient $MEMPOOL balance" }); return; }
    if (msg === "RACE") { res.status(409).json({ error: "Listing just got reserved, try again" }); return; }
    if (msg === "SELLER") { res.status(409).json({ error: "Seller wallet unavailable" }); return; }
    console.error("market/reserve failed:", err);
    res.status(500).json({ error: "Failed to reserve listing" });
  }
});

// ─────────────────────────── Confirm ───────────────────────────

const ConfirmSchema = z.object({
  listingId: z.string().min(1),
  signature: z.string().min(1),
});

router.post("/confirm", requireAuth, async (req: AuthRequest, res) => {
  const parsed = ConfirmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { listingId, signature } = parsed.data;

  const buyer = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!buyer?.walletAddress) { res.status(400).json({ error: "Wallet required" }); return; }

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.status === "sold") { res.json({ status: "sold" }); return; }
  if (listing.status !== "reserved" && listing.status !== "cancelling") {
    res.status(409).json({ error: "Listing is not reserved" });
    return;
  }
  if (listing.reservedById !== buyer.id) { res.status(403).json({ error: "Not your reservation" }); return; }

  // Block signature reuse.
  const existing = await prisma.marketListing.findUnique({ where: { txSignature: signature } });
  if (existing && existing.id !== listing.id) {
    res.status(409).json({ error: "Signature already used" });
    return;
  }

  const seller = await prisma.user.findUnique({ where: { id: listing.sellerId } });
  if (!seller?.walletAddress) { res.status(409).json({ error: "Seller wallet unavailable" }); return; }

  const decimals = await getMintDecimals();
  const price = priceNum(listing.price);
  const feeAmount = Math.round(price * FEE_RATE * 1e6) / 1e6;
  const sellerBaseUnits = toBaseUnits(price, decimals);
  const feeBaseUnits = toBaseUnits(feeAmount, decimals);

  const ok = await verifyPurchaseTx(signature, {
    buyer: buyer.walletAddress,
    sellerWallet: seller.walletAddress,
    treasury: TREASURY_WALLET,
    sellerBaseUnits,
    feeBaseUnits,
  });

  if (!ok) {
    // Not yet confirmed on-chain (or invalid). Client should retry a few times.
    res.status(409).json({ error: "Transaction not confirmed yet", pending: true });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically flip reserved -> sold; guards against double-processing.
      const flipped = await tx.marketListing.updateMany({
        where: {
          id: listing.id,
          status: { in: ["reserved", "cancelling"] },
          reservedById: buyer.id,
        },
        data: {
          status: "sold",
          buyerId: buyer.id,
          txSignature: signature,
          soldAt: new Date(),
        },
      });
      if (flipped.count === 0) throw new Error("RACE");

      if (listing.kind === "card" && listing.cardId) {
        await tx.collectionEntry.upsert({
          where: { userId_cardId: { userId: buyer.id, cardId: listing.cardId } },
          update: { quantity: { increment: 1 } },
          create: { userId: buyer.id, cardId: listing.cardId, quantity: 1 },
        });
      } else if (listing.kind === "pack" && listing.packType) {
        await tx.packInventory.upsert({
          where: { userId_packType: { userId: buyer.id, packType: listing.packType } },
          update: { quantity: { increment: 1 } },
          create: { userId: buyer.id, packType: listing.packType, quantity: 1 },
        });
      }
    });

    res.json({ status: "sold" });
  } catch (err) {
    if (err instanceof Error && err.message === "RACE") {
      res.status(409).json({ error: "Listing already settled" });
      return;
    }
    console.error("market/confirm failed:", err);
    res.status(500).json({ error: "Failed to settle listing" });
  }
});

// ─────────────────────────── Sweeper ───────────────────────────

async function sweep(): Promise<void> {
  const now = new Date();
  try {
    // Expire stale reservations back to active (not while seller is cancelling).
    await prisma.marketListing.updateMany({
      where: { status: "reserved", reservedUntil: { lt: now } },
      data: { status: "active", reservedById: null, reservedUntil: null },
    });

    // Clear expired buyer holds on listings already in cancel flow.
    await prisma.marketListing.updateMany({
      where: { status: "cancelling", reservedUntil: { lt: now } },
      data: { reservedById: null, reservedUntil: null },
    });

    // Finalize cancellations past cooldown: return the asset to the seller.
    const toReturn = await prisma.marketListing.findMany({
      where: { status: "cancelling", cooldownUntil: { lt: now } },
    });
    for (const listing of toReturn) {
      try {
        await prisma.$transaction(async (tx) => {
          const flipped = await tx.marketListing.updateMany({
            where: { id: listing.id, status: "cancelling" },
            data: { status: "cancelled", cancelledAt: new Date() },
          });
          if (flipped.count === 0) return;
          if (listing.kind === "card" && listing.cardId) {
            await tx.collectionEntry.upsert({
              where: { userId_cardId: { userId: listing.sellerId, cardId: listing.cardId } },
              update: { quantity: { increment: 1 } },
              create: { userId: listing.sellerId, cardId: listing.cardId, quantity: 1 },
            });
          } else if (listing.kind === "pack" && listing.packType) {
            await tx.packInventory.upsert({
              where: { userId_packType: { userId: listing.sellerId, packType: listing.packType } },
              update: { quantity: { increment: 1 } },
              create: { userId: listing.sellerId, packType: listing.packType, quantity: 1 },
            });
          }
        });
      } catch (err) {
        console.error("market sweeper: return asset failed", listing.id, err);
      }
    }
  } catch (err) {
    console.error("market sweeper failed:", err);
  }
}

let sweeperTimer: NodeJS.Timeout | null = null;
export function startMarketSweeper(): void {
  if (sweeperTimer) return;
  sweeperTimer = setInterval(() => { void sweep(); }, 15_000);
  void sweep();
}

export default router;
