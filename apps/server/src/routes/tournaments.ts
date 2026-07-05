import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/auth.js";
import { requireAdmin, isUserAdmin } from "../middleware/admin.js";
import { buildPrizeSummary, formatStartsIn } from "../tournaments/bracket.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router: ReturnType<typeof Router> = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC_DIR = path.resolve(__dirname, "../../../web/public");
const TOURNAMENT_IMAGES_DIR = path.join(WEB_PUBLIC_DIR, "tournament-images");
const FACTION_IMAGES_DIR = path.join(WEB_PUBLIC_DIR, "factions");

const FACTION_IDS = ["bitcoin", "ethereum", "solana", "meme", "stable", "degen"] as const;
const ALLOWED_IMAGE_PREFIXES = ["/tournament-images/", "/factions/"];

function listImageFiles(dir: string, urlPrefix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `${urlPrefix}${f}`);
}

function isAllowedImagePath(imagePath: string): boolean {
  if (!ALLOWED_IMAGE_PREFIXES.some((p) => imagePath.startsWith(p))) return false;
  const rel = imagePath.replace(/^\//, "");
  const abs = path.resolve(WEB_PUBLIC_DIR, rel);
  if (!abs.startsWith(WEB_PUBLIC_DIR)) return false;
  return fs.existsSync(abs);
}

const DEFAULT_TIERS = [
  { rankLabel: "1st", rankMin: 1, rankMax: 1 },
  { rankLabel: "2nd", rankMin: 2, rankMax: 2 },
  { rankLabel: "3rd - 4th", rankMin: 3, rankMax: 4 },
  { rankLabel: "5th - 8th", rankMin: 5, rankMax: 8 },
  { rankLabel: "9th - 16th", rankMin: 9, rankMax: 16 },
];

async function mapTournamentListItem(
  t: {
    id: string;
    title: string;
    description: string;
    imagePath: string | null;
    startAt: Date;
    status: string;
    maxSlots: number;
    bracketSize: number;
    currentRound: number;
    totalRounds: number;
    _count?: { entries: number };
  },
  prizeTiers: { amount: number | null; currency: string; customLabel: string | null }[],
  userId?: string
) {
  const registeredCount = t._count?.entries ?? await prisma.tournamentEntry.count({ where: { tournamentId: t.id } });
  const startsInMs = t.status === "upcoming" ? Math.max(0, t.startAt.getTime() - Date.now()) : null;
  let userRegistered = false;
  if (userId) {
    const e = await prisma.tournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId: t.id, userId } },
    });
    userRegistered = !!e;
  }
  const liveMatchCount =
    t.status === "live"
      ? await prisma.tournamentMatch.count({
          where: { tournamentId: t.id, status: "awaiting_join" },
        })
      : 0;

  return {
    id: t.id,
    title: t.title,
    description: t.description,
    imagePath: t.imagePath,
    startAt: t.startAt.toISOString(),
    status: t.status,
    maxSlots: t.maxSlots,
    registeredCount,
    bracketSize: t.bracketSize,
    currentRound: t.currentRound,
    totalRounds: t.totalRounds,
    startsInMs,
    startsInLabel: startsInMs !== null ? formatStartsIn(startsInMs) : null,
    totalPrizeSummary: buildPrizeSummary(prizeTiers),
    userRegistered,
    liveMatchCount,
  };
}

router.get("/", optionalAuth, async (req: AuthRequest, res) => {
  const tournaments = await prisma.tournament.findMany({
    include: {
      prizeTiers: true,
      _count: { select: { entries: true } },
    },
  });

  const statusOrder: Record<string, number> = { upcoming: 0, live: 1, finished: 2, cancelled: 3 };
  tournaments.sort((a, b) => {
    const sa = statusOrder[a.status] ?? 9;
    const sb = statusOrder[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.startAt.getTime() - b.startAt.getTime();
  });

  const items = await Promise.all(
    tournaments.map((t) => mapTournamentListItem(t, t.prizeTiers, req.user?.userId))
  );
  res.json({ tournaments: items, liveCount: items.filter((t) => t.status === "live").length });
});

router.get("/active-match", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const match = await prisma.tournamentMatch.findFirst({
    where: {
      status: "awaiting_join",
      OR: [{ player1Id: userId }, { player2Id: userId }],
      joinDeadline: { gt: new Date() },
    },
    include: { tournament: true },
    orderBy: { joinDeadline: "asc" },
  });
  if (!match || !match.joinDeadline) {
    res.json({ match: null });
    return;
  }
  const oppId = match.player1Id === userId ? match.player2Id : match.player1Id;
  const opp = oppId
    ? await prisma.user.findUnique({ where: { id: oppId }, select: { username: true } })
    : null;
  res.json({
    match: {
      matchId: match.id,
      tournamentId: match.tournamentId,
      tournamentTitle: match.tournament.title,
      opponentName: opp?.username ?? "Opponent",
      joinDeadline: match.joinDeadline.toISOString(),
      round: match.round,
    },
  });
});

router.get("/admin/check", requireAuth, async (req: AuthRequest, res) => {
  const isAdmin = await isUserAdmin(req.user!.userId);
  res.json({ isAdmin });
});

router.get("/admin/available-images", requireAuth, requireAdmin, async (_req, res) => {
  const tournamentImages = listImageFiles(TOURNAMENT_IMAGES_DIR, "/tournament-images/").map((path) => ({
    path,
    label: path.split("/").pop() ?? path,
    category: "tournament" as const,
  }));

  const factionImages = FACTION_IDS.flatMap((id) => {
    const file = `${id}.png`;
    const abs = path.join(FACTION_IMAGES_DIR, file);
    if (!fs.existsSync(abs)) return [];
    return [{ path: `/factions/${file}`, label: id, category: "faction" as const }];
  });

  res.json({ images: [...tournamentImages, ...factionImages] });
});

router.post("/admin/create", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body as {
    title?: string;
    description?: string;
    startAt?: string;
    maxSlots?: number;
    imagePath?: string;
    prizeTiers?: {
      rankLabel: string;
      rankMin: number;
      rankMax: number;
      amount: number | null;
      currency: string;
      customLabel?: string | null;
    }[];
  };

  if (!body.title?.trim() || !body.startAt) {
    res.status(400).json({ error: "title and startAt required" });
    return;
  }
  if (body.imagePath && !isAllowedImagePath(body.imagePath)) {
    res.status(400).json({ error: "Invalid tournament image" });
    return;
  }
  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    res.status(400).json({ error: "Invalid startAt" });
    return;
  }

  const tiers = body.prizeTiers?.length ? body.prizeTiers : DEFAULT_TIERS.map((t) => ({
    ...t,
    amount: null,
    currency: "fragments",
    customLabel: null,
  }));

  const tournament = await prisma.tournament.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() ?? "",
      startAt,
      maxSlots: body.maxSlots ?? 64,
      imagePath: body.imagePath ?? null,
      prizeTiers: {
        create: tiers.map((t) => ({
          rankLabel: t.rankLabel,
          rankMin: t.rankMin,
          rankMax: t.rankMax,
          amount: t.amount,
          currency: t.currency ?? "fragments",
          customLabel: t.customLabel ?? null,
        })),
      },
    },
    include: { prizeTiers: true },
  });

  res.json({ tournament: await mapTournamentListItem(tournament, tournament.prizeTiers) });
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      prizeTiers: { orderBy: { rankMin: "asc" } },
      matches: { orderBy: [{ round: "asc" }, { slotIndex: "asc" }] },
      _count: { select: { entries: true } },
    },
  });
  if (!tournament) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const userIds = new Set<string>();
  for (const m of tournament.matches) {
    if (m.player1Id) userIds.add(m.player1Id);
    if (m.player2Id) userIds.add(m.player2Id);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, username: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.username]));

  const userId = req.user?.userId;
  let userActiveMatch = null;
  if (userId) {
    const am = tournament.matches.find(
      (m) =>
        m.status === "awaiting_join" &&
        (m.player1Id === userId || m.player2Id === userId) &&
        m.joinDeadline &&
        m.joinDeadline > new Date()
    );
    if (am && am.joinDeadline) {
      const oppId = am.player1Id === userId ? am.player2Id : am.player1Id;
      userActiveMatch = {
        matchId: am.id,
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        opponentName: oppId ? nameById.get(oppId) ?? "Opponent" : "Opponent",
        joinDeadline: am.joinDeadline.toISOString(),
        round: am.round,
      };
    }
  }

  let winnerName: string | null = null;
  if (tournament.winnerId) {
    winnerName = nameById.get(tournament.winnerId) ?? null;
    if (!winnerName) {
      const w = await prisma.user.findUnique({ where: { id: tournament.winnerId }, select: { username: true } });
      winnerName = w?.username ?? null;
    }
  }

  const base = await mapTournamentListItem(tournament, tournament.prizeTiers, userId);

  let userPayout = null;
  if (userId) {
    const payout = await prisma.tournamentPayout.findFirst({
      where: { tournamentId: id, userId },
      orderBy: { createdAt: "desc" },
    });
    if (payout) {
      userPayout = {
        amount: payout.amount,
        rank: payout.rank,
        currencyLabel: payout.currencyLabel,
        status: payout.status as "pending_claim" | "claimed" | "pending_manual" | "paid",
      };
    }
  }

  res.json({
    ...base,
    prizeTiers: tournament.prizeTiers.map((t) => ({
      rankLabel: t.rankLabel,
      rankMin: t.rankMin,
      rankMax: t.rankMax,
      amount: t.amount,
      currency: t.currency,
      customLabel: t.customLabel,
    })),
    matches: tournament.matches.map((m) => ({
      id: m.id,
      round: m.round,
      slotIndex: m.slotIndex,
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      player1Name: m.player1Id ? nameById.get(m.player1Id) ?? "TBD" : null,
      player2Name: m.player2Id ? nameById.get(m.player2Id) ?? "TBD" : null,
      winnerId: m.winnerId,
      status: m.status,
      joinDeadline: m.joinDeadline?.toISOString() ?? null,
      player1Score: m.player1Score,
      player2Score: m.player2Score,
      isUserMatch: userId ? m.player1Id === userId || m.player2Id === userId : false,
    })),
    winnerName,
    userActiveMatch,
    userPayout,
  });
});

router.post("/:id/claim-reward", requireAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const userId = req.user!.userId;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament || tournament.status !== "finished") {
    res.status(400).json({ error: "No rewards to claim" });
    return;
  }

  const payout = await prisma.tournamentPayout.findFirst({
    where: { tournamentId: id, userId, status: "pending_claim", currencyLabel: "fragments" },
  });
  if (!payout) {
    res.status(400).json({ error: "Nothing to claim" });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { fragments: { increment: payout.amount } },
    }),
    prisma.tournamentPayout.update({
      where: { id: payout.id },
      data: { status: "claimed" },
    }),
  ]);

  res.json({ ok: true, amount: payout.amount });
});

router.post("/:id/register", requireAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (tournament.status !== "upcoming" || tournament.startAt <= new Date()) {
    res.status(400).json({ error: "Registration closed" });
    return;
  }
  const count = await prisma.tournamentEntry.count({ where: { tournamentId: tournament.id } });
  if (count >= tournament.maxSlots) {
    res.status(400).json({ error: "Tournament full" });
    return;
  }
  await prisma.tournamentEntry.upsert({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: req.user!.userId } },
    create: { tournamentId: tournament.id, userId: req.user!.userId },
    update: {},
  });
  res.json({ ok: true });
});

router.delete("/:id/register", requireAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament || tournament.status !== "upcoming" || tournament.startAt <= new Date()) {
    res.status(400).json({ error: "Cannot withdraw" });
    return;
  }
  await prisma.tournamentEntry.deleteMany({
    where: { tournamentId: tournament.id, userId: req.user!.userId },
  });
  res.json({ ok: true });
});

export default router;
