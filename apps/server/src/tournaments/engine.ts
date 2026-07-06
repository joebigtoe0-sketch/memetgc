import { prisma } from "@memetgc/db";
import type { ServerToClientEvents, ClientToServerEvents } from "@memetgc/types";
import type { Server } from "socket.io";
import { getBotIdentities } from "../bots/manager.js";
import { getSocketIdForUser } from "../game/socketRegistry.js";
import {
  buildRound1Seeds,
  computeBracketSize,
  eliminationRank,
  JOIN_WINDOW_MS,
  parentSlot,
  parentSlotSide,
  totalRoundsForBracket,
} from "./bracket.js";
import { beginTournamentMatch } from "./match.js";

let ioRef: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function setTournamentEngineIo(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  ioRef = io;
}

const BOT_FILL_TARGET = 5;
const BOT_REGISTER_INTERVAL_MS = 5 * 60 * 1000;

async function getBotPool(): Promise<string[]> {
  let pool = getBotIdentities().map((b) => b.userId);
  if (pool.length === 0) {
    const dbBots = await prisma.user.findMany({ where: { isBot: true }, select: { id: true }, take: 10 });
    pool = dbBots.map((b) => b.id);
  }
  return pool;
}

/** Gradually register ladder bots into upcoming tournaments (1 every 5 min, up to 5 bots). */
async function processBotRegistrations(): Promise<void> {
  const now = Date.now();
  const upcoming = await prisma.tournament.findMany({
    where: { status: "upcoming", startAt: { gt: new Date() } },
    include: { entries: { select: { userId: true } } },
  });

  const botPool = await getBotPool();
  if (botPool.length === 0) return;

  const botSet = new Set(botPool);

  for (const t of upcoming) {
    const registered = new Set(t.entries.map((e) => e.userId));
    const botCount = t.entries.filter((e) => botSet.has(e.userId)).length;
    if (botCount >= BOT_FILL_TARGET) continue;

    const elapsed = now - t.createdAt.getTime();
    const desiredBots = Math.min(BOT_FILL_TARGET, Math.floor(elapsed / BOT_REGISTER_INTERVAL_MS) + 1);
    if (botCount >= desiredBots) continue;

    const available = botPool.filter((id) => !registered.has(id));
    const toAdd = Math.min(desiredBots - botCount, available.length);

    for (let i = 0; i < toAdd; i++) {
      const botId = available[i]!;
      await prisma.tournamentEntry.create({
        data: { tournamentId: t.id, userId: botId },
      }).catch(() => {});
    }
  }
}

async function isBot(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true } });
  return !!u?.isBot;
}

async function pickBotWinner(p1: string, p2: string): Promise<string> {
  const users = await prisma.user.findMany({
    where: { id: { in: [p1, p2] } },
    select: { id: true, mmr: true },
  });
  const a = users.find((u) => u.id === p1);
  const b = users.find((u) => u.id === p2);
  if ((a?.mmr ?? 0) >= (b?.mmr ?? 0)) return p1;
  return p2;
}

async function propagateWinner(
  tournamentId: string,
  round: number,
  slotIndex: number,
  winnerId: string,
  totalRounds: number
): Promise<void> {
  if (round >= totalRounds) return;
  const nextRound = round + 1;
  const nextSlot = parentSlot(slotIndex);
  const side = parentSlotSide(slotIndex);

  const parent = await prisma.tournamentMatch.findUnique({
    where: { tournamentId_round_slotIndex: { tournamentId, round: nextRound, slotIndex: nextSlot } },
  });
  if (!parent) return;

  const data = side === "player1" ? { player1Id: winnerId } : { player2Id: winnerId };
  await prisma.tournamentMatch.update({ where: { id: parent.id }, data });
}

async function markEliminated(
  tournamentId: string,
  userId: string,
  round: number,
  totalRounds: number,
  bracketSize: number
): Promise<void> {
  const bot = await isBot(userId);
  if (bot) return;
  const rank = eliminationRank(round, totalRounds, bracketSize);
  await prisma.tournamentEntry.updateMany({
    where: { tournamentId, userId },
    data: { finalRank: rank },
  });
}

async function resolveBotOnlyMatch(matchId: string): Promise<void> {
  const tm = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!tm || !tm.player1Id || !tm.player2Id) return;

  const winnerId = await pickBotWinner(tm.player1Id, tm.player2Id);
  const loserId = winnerId === tm.player1Id ? tm.player2Id : tm.player1Id;

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      status: "completed",
      winnerId,
      player1Score: winnerId === tm.player1Id ? 2 : 0,
      player2Score: winnerId === tm.player2Id ? 2 : 0,
    },
  });

  await propagateWinner(tm.tournamentId, tm.round, tm.slotIndex, winnerId, tm.tournament.totalRounds);
  await markEliminated(tm.tournamentId, loserId, tm.round, tm.tournament.totalRounds, tm.tournament.bracketSize);
}

async function forfeitMatch(matchId: string, winnerId: string, loserId: string): Promise<void> {
  const tm = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!tm) return;

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      status: "forfeited",
      winnerId,
      player1Score: winnerId === tm.player1Id ? 2 : 0,
      player2Score: winnerId === tm.player2Id ? 2 : 0,
    },
  });

  await propagateWinner(tm.tournamentId, tm.round, tm.slotIndex, winnerId, tm.tournament.totalRounds);
  await markEliminated(tm.tournamentId, loserId, tm.round, tm.tournament.totalRounds, tm.tournament.bracketSize);
}

async function advanceByeMatch(
  tm: { id: string; tournamentId: string; round: number; slotIndex: number; player1Id: string | null; player2Id: string | null },
  winnerId: string,
  tournament: { totalRounds: number; bracketSize: number }
): Promise<void> {
  await prisma.tournamentMatch.update({
    where: { id: tm.id },
    data: {
      status: "completed",
      winnerId,
      player1Score: winnerId === tm.player1Id ? 2 : 0,
      player2Score: winnerId === tm.player2Id ? 2 : 0,
    },
  });
  await propagateWinner(tm.tournamentId, tm.round, tm.slotIndex, winnerId, tournament.totalRounds);
}

async function openMatch(matchId: string): Promise<void> {
  const tm = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!tm || tm.status !== "pending") return;

  if (!tm.player1Id && !tm.player2Id) {
    await prisma.tournamentMatch.update({ where: { id: tm.id }, data: { status: "completed" } });
    return;
  }

  if (tm.player1Id && !tm.player2Id) {
    await advanceByeMatch(tm, tm.player1Id, tm.tournament);
    return;
  }
  if (!tm.player1Id && tm.player2Id) {
    await advanceByeMatch(tm, tm.player2Id, tm.tournament);
    return;
  }

  const p1Bot = await isBot(tm.player1Id!);
  const p2Bot = await isBot(tm.player2Id!);

  if (p1Bot && p2Bot) {
    await resolveBotOnlyMatch(matchId);
    return;
  }

  const deadline = new Date(Date.now() + JOIN_WINDOW_MS);
  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: { status: "awaiting_join", joinDeadline: deadline },
  });

  const p1Id = tm.player1Id!;
  const p2Id = tm.player2Id!;

  // Notify human participants
  for (const uid of [p1Id, p2Id]) {
    if (await isBot(uid)) continue;
    const oppId = uid === p1Id ? p2Id : p1Id;
    const [tournament, opp] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: tm.tournamentId } }),
      prisma.user.findUnique({ where: { id: oppId }, select: { username: true } }),
    ]);
    const socketId = getSocketIdForUser(uid);
    if (socketId && ioRef && tournament) {
      ioRef.to(socketId).emit("tournament:match_ready", {
        matchId,
        tournamentId: tm.tournamentId,
        opponentName: opp?.username ?? "Opponent",
        joinDeadline: deadline.toISOString(),
        round: tm.round,
      });
    }
  }
}

async function openRoundMatches(tournamentId: string, round: number): Promise<void> {
  const matches = await prisma.tournamentMatch.findMany({
    where: { tournamentId, round, status: "pending" },
  });
  for (const m of matches) {
    if (m.player1Id && m.player2Id) await openMatch(m.id);
  }
}

async function checkRoundComplete(tournamentId: string, round: number): Promise<void> {
  const open = await prisma.tournamentMatch.count({
    where: {
      tournamentId,
      round,
      status: { in: ["pending", "awaiting_join", "live"] },
    },
  });
  if (open > 0) return;

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return;

  if (round >= tournament.totalRounds) {
    const final = await prisma.tournamentMatch.findFirst({
      where: { tournamentId, round: tournament.totalRounds },
    });
    if (final?.winnerId) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: "finished", winnerId: final.winnerId },
      });
      await prisma.tournamentEntry.updateMany({
        where: { tournamentId, userId: final.winnerId },
        data: { finalRank: 1 },
      });
      await distributePrizes(tournamentId);
      ioRef?.emit("tournament:bracket_update", { tournamentId });
    }
    return;
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { currentRound: round + 1 },
  });

  ioRef?.emit("tournament:round_start", { tournamentId, round: round + 1 });
  await openRoundMatches(tournamentId, round + 1);
  ioRef?.emit("tournament:bracket_update", { tournamentId });
}

export async function onTournamentMatchComplete(gameId: string, winnerId: string | null): Promise<void> {
  const tm = await prisma.tournamentMatch.findFirst({
    where: { gameId },
    include: { tournament: true },
  });
  if (!tm || !winnerId) return;

  const loserId = winnerId === tm.player1Id ? tm.player2Id : tm.player1Id;
  if (!loserId) return;

  await prisma.tournamentMatch.update({
    where: { id: tm.id },
    data: {
      status: "completed",
      winnerId,
      player1Score: winnerId === tm.player1Id ? 2 : 1,
      player2Score: winnerId === tm.player2Id ? 2 : 1,
    },
  });

  await propagateWinner(tm.tournamentId, tm.round, tm.slotIndex, winnerId, tm.tournament.totalRounds);
  await markEliminated(tm.tournamentId, loserId, tm.round, tm.tournament.totalRounds, tm.tournament.bracketSize);
  await checkRoundComplete(tm.tournamentId, tm.round);
  ioRef?.emit("tournament:bracket_update", { tournamentId: tm.tournamentId });
}

async function distributePrizes(tournamentId: string): Promise<void> {
  const existing = await prisma.tournamentPayout.count({ where: { tournamentId } });
  if (existing > 0) return;

  const [tiers, entries] = await Promise.all([
    prisma.tournamentPrizeTier.findMany({ where: { tournamentId } }),
    prisma.tournamentEntry.findMany({
      where: { tournamentId, finalRank: { not: null } },
      select: { userId: true, finalRank: true },
    }),
  ]);

  for (const entry of entries) {
    const rank = entry.finalRank!;
    const tier = tiers.find((t) => rank >= t.rankMin && rank <= t.rankMax && t.amount);
    if (!tier || !tier.amount) continue;

    await prisma.tournamentPayout.create({
      data: {
        tournamentId,
        userId: entry.userId,
        rank,
        amount: tier.amount,
        currencyLabel: tier.currency === "fragments" ? "fragments" : tier.customLabel ?? "custom",
        status: tier.currency === "fragments" ? "pending_claim" : "pending_manual",
      },
    });
  }
}

export async function startTournament(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.status !== "upcoming") return;

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    select: { userId: true, id: true },
  });

  if (entries.length < 1) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "cancelled" } });
    return;
  }

  const entryIds = entries.map((e) => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: entryIds } },
    select: { id: true, isBot: true },
  });
  const humanIds = users.filter((u) => !u.isBot).map((u) => u.id);
  const registeredBotIds = users.filter((u) => u.isBot).map((u) => u.id);

  if (humanIds.length < 1) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "cancelled" } });
    return;
  }

  const participantCount = humanIds.length + registeredBotIds.length;
  const bracketSize = computeBracketSize(participantCount, tournament.maxSlots);

  // Only pad with extra unique bots if the bracket has empty slots — never duplicate.
  const usedIds = new Set([...humanIds, ...registeredBotIds]);
  const botPool = (await getBotPool()).filter((id) => !usedIds.has(id));
  const fillBotIds: string[] = [];
  for (let i = 0; i < bracketSize - participantCount && i < botPool.length; i++) {
    fillBotIds.push(botPool[i]!);
    usedIds.add(botPool[i]!);
  }

  const allBotIds = [...registeredBotIds, ...fillBotIds];
  const seeds = buildRound1Seeds(humanIds, allBotIds, bracketSize);

  const totalRounds = totalRoundsForBracket(bracketSize);

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: "live",
      bracketSize,
      totalRounds,
      currentRound: 1,
    },
  });

  seeds.forEach((uid, idx) => {
    if (!uid) return;
    void prisma.tournamentEntry.updateMany({
      where: { tournamentId, userId: uid },
      data: { seedIndex: idx },
    });
  });

  const round1Count = bracketSize / 2;
  for (let slot = 0; slot < round1Count; slot++) {
    await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: 1,
        slotIndex: slot,
        player1Id: seeds[slot * 2] ?? null,
        player2Id: seeds[slot * 2 + 1] ?? null,
        status: "pending",
      },
    });
  }

  // Pre-create empty slots for later rounds
  for (let round = 2; round <= totalRounds; round++) {
    const count = bracketSize / 2 ** round;
    for (let slot = 0; slot < count; slot++) {
      await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round,
          slotIndex: slot,
          status: "pending",
        },
      });
    }
  }

  await openRoundMatches(tournamentId, 1);
  ioRef?.emit("tournament:bracket_update", { tournamentId });
}

async function processExpiredJoinWindows(): Promise<void> {
  const expired = await prisma.tournamentMatch.findMany({
    where: {
      status: "awaiting_join",
      joinDeadline: { lt: new Date() },
    },
    include: { tournament: true },
  });

  for (const tm of expired) {
    if (!tm.player1Id || !tm.player2Id) continue;
    const p1Bot = await isBot(tm.player1Id);
    const p2Bot = await isBot(tm.player2Id);

    if (p1Bot && p2Bot) {
      await resolveBotOnlyMatch(tm.id);
      await checkRoundComplete(tm.tournamentId, tm.round);
      continue;
    }

    const p1Ready = tm.player1Ready;
    const p2Ready = tm.player2Ready;

    if (p1Ready && !p2Ready) {
      await forfeitMatch(tm.id, tm.player1Id, tm.player2Id);
    } else if (p2Ready && !p1Ready) {
      await forfeitMatch(tm.id, tm.player2Id, tm.player1Id);
    } else if (!p1Ready && !p2Ready) {
      // Neither joined — higher seed (player1) advances by default
      await forfeitMatch(tm.id, tm.player1Id, tm.player2Id);
    } else {
      // Both ready but match didn't start — try now
      await beginTournamentMatch(tm.id);
    }
    await checkRoundComplete(tm.tournamentId, tm.round);
  }
}

async function tick(): Promise<void> {
  const now = new Date();

  await processBotRegistrations();

  const due = await prisma.tournament.findMany({
    where: { status: "upcoming", startAt: { lte: now } },
  });
  for (const t of due) {
    await startTournament(t.id);
  }

  await processExpiredJoinWindows();

  // Re-check rounds for any tournaments with completed rounds
  const live = await prisma.tournament.findMany({ where: { status: "live" } });
  for (const t of live) {
    const pendingInRound = await prisma.tournamentMatch.count({
      where: { tournamentId: t.id, round: t.currentRound, status: { in: ["pending", "awaiting_join", "live"] } },
    });
    if (pendingInRound === 0) {
      await checkRoundComplete(t.id, t.currentRound);
    }
  }
}

export function startTournamentTicker(): NodeJS.Timeout {
  return setInterval(() => {
    void tick().catch((err) => console.error("[tournaments] ticker error:", err));
  }, 10_000);
}

export { checkRoundComplete, openRoundMatches };
