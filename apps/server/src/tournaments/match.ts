import { randomUUID } from "crypto";
import { prisma } from "@memetgc/db";
import type { Card, CardEffect, Faction, Keyword, ServerToClientEvents, ClientToServerEvents } from "@memetgc/types";
import type { Server } from "socket.io";
import { getBotDeckHero, getBotIdentities } from "../bots/manager.js";
import { ensureFreshCardRegistry, getCardRegistry } from "../game/socket.js";
import { createRoom, initMulligan, type PlayerInfo } from "../game/room.js";
import { getSocketIdForUser } from "../game/socketRegistry.js";

async function getDeckCards(deckId: string, userId: string): Promise<Card[]> {
  const deckCards = await prisma.deckCard.findMany({
    where: { deck: { id: deckId, userId } },
    include: { card: true },
  });
  const cards: Card[] = [];
  for (const dc of deckCards) {
    for (let i = 0; i < dc.quantity; i++) {
      cards.push({
        id: dc.card.id,
        name: dc.card.name,
        set: dc.card.set,
        type: dc.card.type as Card["type"],
        faction: dc.card.faction as Card["faction"],
        rarity: dc.card.rarity as Card["rarity"],
        cost: dc.card.cost,
        attack: dc.card.attack ?? undefined,
        health: dc.card.health ?? undefined,
        durability: dc.card.durability ?? undefined,
        text: dc.card.text ?? undefined,
        flavor_text: dc.card.flavorText ?? undefined,
        art_url: dc.card.artUrl ?? undefined,
        keywords: (dc.card.keywordsJson as unknown as Keyword[]) ?? [],
        effects: (dc.card.effectsJson as unknown as CardEffect[]) ?? [],
        collectible: dc.card.collectible,
        craftable: dc.card.craftable,
        dust_value: dc.card.dustValue,
        craft_cost: dc.card.craftCost,
      });
    }
  }
  return cards;
}

let ioRef: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function setTournamentIo(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  ioRef = io;
}

export async function beginTournamentMatch(tournamentMatchId: string): Promise<boolean> {
  if (!ioRef) return false;

  const tm = await prisma.tournamentMatch.findUnique({
    where: { id: tournamentMatchId },
    include: {
      tournament: true,
    },
  });
  if (!tm || tm.status === "live" || tm.status === "completed") return false;
  if (!tm.player1Id || !tm.player2Id) return false;
  if (!tm.player1DeckId || !tm.player1HeroId || !tm.player2DeckId || !tm.player2HeroId) return false;

  const [u1, u2, hero1, hero2, deck1, deck2] = await Promise.all([
    prisma.user.findUnique({ where: { id: tm.player1Id }, select: { username: true, isBot: true, equippedCardBack: true } }),
    prisma.user.findUnique({ where: { id: tm.player2Id }, select: { username: true, isBot: true, equippedCardBack: true } }),
    prisma.hero.findUnique({ where: { id: tm.player1HeroId } }),
    prisma.hero.findUnique({ where: { id: tm.player2HeroId } }),
    getDeckCards(tm.player1DeckId, tm.player1Id),
    getDeckCards(tm.player2DeckId, tm.player2Id),
  ]);

  if (!u1 || !u2 || !hero1 || !hero2 || deck1.length !== 30 || deck2.length !== 30) return false;

  await ensureFreshCardRegistry();

  const gameId = randomUUID();
  const socket1 = u1.isBot ? null : getSocketIdForUser(tm.player1Id);
  const socket2 = u2.isBot ? null : getSocketIdForUser(tm.player2Id);

  const p1: PlayerInfo = {
    socketId: socket1 ?? null,
    userId: tm.player1Id,
    username: u1.username,
    heroId: tm.player1HeroId,
    heroName: hero1.name,
    heroFaction: hero1.faction as Faction,
    heroPower: hero1.heroPowerJson as unknown as PlayerInfo["heroPower"],
    deck: deck1,
    isAI: u1.isBot,
    isBot: u1.isBot,
    cardBack: u1.equippedCardBack ?? null,
  };
  const p2: PlayerInfo = {
    socketId: socket2 ?? null,
    userId: tm.player2Id,
    username: u2.username,
    heroId: tm.player2HeroId,
    heroName: hero2.name,
    heroFaction: hero2.faction as Faction,
    heroPower: hero2.heroPowerJson as unknown as PlayerInfo["heroPower"],
    deck: deck2,
    isAI: u2.isBot,
    isBot: u2.isBot,
    cardBack: u2.equippedCardBack ?? null,
  };

  const room = createRoom(gameId, p1, p2, "tournament", getCardRegistry());
  (room as typeof room & { tournamentMatchId?: string }).tournamentMatchId = tournamentMatchId;

  await prisma.tournamentMatch.update({
    where: { id: tournamentMatchId },
    data: { status: "live", gameId },
  });

  if (socket1) {
    const s = ioRef.sockets.sockets.get(socket1);
    s?.join(gameId);
    s?.emit("match:found", gameId);
  }
  if (socket2) {
    const s = ioRef.sockets.sockets.get(socket2);
    s?.join(gameId);
    s?.emit("match:found", gameId);
  }

  initMulligan(room, ioRef);
  return true;
}

export async function tryStartTournamentMatchIfReady(tournamentMatchId: string): Promise<void> {
  const tm = await prisma.tournamentMatch.findUnique({ where: { id: tournamentMatchId } });
  if (!tm || tm.status !== "awaiting_join") return;
  if (!tm.player1Ready || !tm.player2Ready) return;
  await beginTournamentMatch(tournamentMatchId);
}

export async function setPlayerReady(
  matchId: string,
  userId: string,
  deckId: string,
  heroId: string
): Promise<{ ok: boolean; error?: string }> {
  const tm = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!tm) return { ok: false, error: "Match not found" };
  if (tm.status !== "awaiting_join") return { ok: false, error: "Match is not open for join" };
  if (tm.joinDeadline && new Date() > tm.joinDeadline) return { ok: false, error: "Join window expired" };

  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: { deckCards: true },
  });
  if (!deck) return { ok: false, error: "Deck not found" };
  const cardCount = deck.deckCards.reduce((s, dc) => s + dc.quantity, 0);
  if (cardCount !== 30) return { ok: false, error: "Deck must have 30 cards" };
  if (deck.isStarter) return { ok: false, error: "Starter decks not allowed in tournaments" };

  const hero = await prisma.hero.findUnique({ where: { id: heroId } });
  if (!hero) return { ok: false, error: "Hero not found" };

  let side: "player1" | "player2" | null = null;
  if (tm.player1Id === userId) side = "player1";
  else if (tm.player2Id === userId) side = "player2";
  else return { ok: false, error: "You are not in this match" };

  const data =
    side === "player1"
      ? { player1DeckId: deckId, player1HeroId: heroId, player1Ready: true }
      : { player2DeckId: deckId, player2HeroId: heroId, player2Ready: true };

  await prisma.tournamentMatch.update({ where: { id: matchId }, data });

  // Auto-ready bot opponent
  const updated = await prisma.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!updated) return { ok: true };
  const oppId = side === "player1" ? updated.player2Id : updated.player1Id;
  if (oppId) {
    const opp = await prisma.user.findUnique({ where: { id: oppId }, select: { isBot: true } });
    if (opp?.isBot) {
      const botDh = await getBotDeckHero(oppId);
      if (botDh) {
        const botData =
          side === "player1"
            ? { player2DeckId: botDh.deckId, player2HeroId: botDh.heroId, player2Ready: true }
            : { player1DeckId: botDh.deckId, player1HeroId: botDh.heroId, player1Ready: true };
        await prisma.tournamentMatch.update({ where: { id: matchId }, data: botData });
      }
    }
  }

  await tryStartTournamentMatchIfReady(matchId);
  return { ok: true };
}
