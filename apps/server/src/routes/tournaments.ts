import { Router } from "express";
import { prisma } from "@memetgc/db";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/auth.js";
import { requireAdmin, isUserAdmin } from "../middleware/admin.js";
import { buildPrizeSummary, formatStartsIn } from "../tournaments/bracket.js";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const router: ReturnType<typeof Router> = Router();

const TOURNAMENT_IMAGE_DIR = path.resolve(process.cwd(), "../web/public/tournaments");

function ensureImageDir(): void {
  fs.mkdirSync(TOURNAMENT_IMAGE_DIR, { recursive: true });
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

router.post("/admin/upload-image", requireAuth, requireAdmin, async (req, res) => {
  ensureImageDir();
  const { imageBase64, filename } = req.body as { imageBase64?: string; filename?: string };
  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }
  const ext = path.extname(filename ?? ".png") || ".png";
  const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext.toLowerCase()) ? ext : ".png";
  const name = `${randomUUID()}${safeExt}`;
  const buf = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  if (buf.length > 2 * 1024 * 1024) {
    res.status(400).json({ error: "Image too large (max 2MB)" });
    return;
  }
  fs.writeFileSync(path.join(TOURNAMENT_IMAGE_DIR, name), buf);
  res.json({ imagePath: `/tournaments/${name}` });
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
  });
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
