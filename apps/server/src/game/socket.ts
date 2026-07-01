import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, GameAction } from "@memetgc/types";
import { verifyToken } from "../middleware/auth.js";
import { prisma } from "@memetgc/db";
import { joinQueue, leaveQueue, tryMatchmake, removeBySocketId, getQueueSize } from "../matchmaking/queue.js";
import { createRoom, getRoom, getRoomByUserId, handlePlayerAction, initMulligan, type PlayerInfo } from "./room.js";
import type { Card, Keyword, CardEffect, HeroPower, Faction } from "@memetgc/types";
import { randomUUID } from "crypto";
import { sanitizeState } from "@memetgc/game-engine";
import { getTokenBalance, MIN_PLAY_TOKENS } from "../lib/solana.js";

// In-memory card registry (loaded from DB on startup)
let cardRegistry: Map<string, Card> = new Map();

export async function loadCardRegistry(): Promise<void> {
  const cards = await prisma.card.findMany();
  cardRegistry = new Map(
    cards.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        set: c.set,
        type: c.type as Card["type"],
        faction: c.faction as Card["faction"],
        rarity: c.rarity as Card["rarity"],
        tribe: c.tribe ?? undefined,
        cost: c.cost,
        attack: c.attack ?? undefined,
        health: c.health ?? undefined,
        durability: c.durability ?? undefined,
        armor: c.armor ?? undefined,
        text: c.text ?? undefined,
        flavor_text: c.flavorText ?? undefined,
        keywords: (c.keywordsJson as unknown as Keyword[]) ?? [],
        effects: (c.effectsJson as unknown as CardEffect[]) ?? [],
        hero_power: (c.heroPowerJson as unknown as HeroPower) ?? undefined,
        art_url: c.artUrl ?? undefined,
        collectible: c.collectible,
        craftable: c.craftable,
        dust_value: c.dustValue,
        craft_cost: c.craftCost,
      } satisfies Card,
    ])
  );
  console.log(`Card registry loaded: ${cardRegistry.size} cards`);
}

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
        hero_power: (dc.card.heroPowerJson as unknown as HeroPower) ?? undefined,
        collectible: dc.card.collectible,
        craftable: dc.card.craftable,
        dust_value: dc.card.dustValue,
        craft_cost: dc.card.craftCost,
      });
    }
  }
  return cards;
}

async function checkDegenBalance(walletAddress: string): Promise<boolean> {
  const balance = await getTokenBalance(walletAddress);
  return balance >= MIN_PLAY_TOKENS;
}

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    let authenticatedUserId: string | null = null;
    let authenticatedUsername: string | null = null;

    // Authenticate on connection via token in handshake
    const token = socket.handshake.auth.token as string | undefined;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        authenticatedUserId = payload.userId;
        authenticatedUsername = payload.username;
      }
    }

    // If this user is already in an active game room (e.g. page refresh), re-join and resync
    if (authenticatedUserId) {
      const existingRoom = getRoomByUserId(authenticatedUserId);
      if (existingRoom && existingRoom.players[authenticatedUserId]) {
        existingRoom.players[authenticatedUserId]!.socketId = socket.id;
        socket.join(existingRoom.gameId);
        socket.emit("match:found", existingRoom.gameId);
        const sanitized = sanitizeState(existingRoom.state, authenticatedUserId);
        socket.emit("game:state_update", sanitized);
      }
    }

    socket.on("queue:join", async ({ mode, deckId, heroId }) => {
      if (!authenticatedUserId || !authenticatedUsername) {
        socket.emit("game:error", "Not authenticated");
        return;
      }

      // Token gate: every queue join requires holding the minimum $MEMPOOL (defense in depth)
      {
        const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
        if (!user?.walletAddress) {
          socket.emit("game:error", "Wallet required to play");
          return;
        }
        const hasTokens = await checkDegenBalance(user.walletAddress);
        if (!hasTokens) {
          socket.emit("game:error", `Need ${MIN_PLAY_TOKENS.toLocaleString()} $MEMPOOL to play`);
          return;
        }
      }

      const deckRecord = await prisma.deck.findFirst({
        where: { id: deckId, userId: authenticatedUserId },
        include: { deckCards: true },
      });
      if (!deckRecord) {
        socket.emit("game:error", "Deck not found");
        return;
      }
      const cardCount = deckRecord.deckCards.reduce((s, dc) => s + dc.quantity, 0);
      if (cardCount !== 30) {
        socket.emit("game:error", `Deck must have 30 cards (${cardCount}/30)`);
        return;
      }
      if (mode === "ranked" && deckRecord.isStarter) {
        socket.emit("game:error", "Ranked requires your own custom deck");
        return;
      }

      leaveQueue(authenticatedUserId);

      if (mode === "practice") {
        // Immediately match with AI
        const deck = await getDeckCards(deckId, authenticatedUserId);
        const hero = await prisma.hero.findUnique({ where: { id: heroId } });
        if (!hero || deck.length !== 30) {
          socket.emit("game:error", deck.length === 0 ? "Invalid deck or hero" : `Deck must have 30 cards (${deck.length}/30)`);
          return;
        }

        // Build AI opponent with a random starter deck
        const aiDecks = await prisma.deck.findMany({
          where: { isStarter: true },
          include: { deckCards: { include: { card: true } } },
          take: 1,
        });
        const aiDeckData = aiDecks[0];
        if (!aiDeckData) {
          socket.emit("game:error", "No AI deck available");
          return;
        }

        const aiHero = await prisma.hero.findUnique({ where: { id: aiDeckData.heroId } });
        if (!aiHero) {
          socket.emit("game:error", "No AI hero available");
          return;
        }

        const aiDeck: Card[] = [];
        for (const dc of aiDeckData.deckCards) {
          for (let i = 0; i < dc.quantity; i++) {
            aiDeck.push({
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

        const gameId = randomUUID();
        const p1: PlayerInfo = {
          socketId: socket.id,
          userId: authenticatedUserId,
          username: authenticatedUsername!,
          heroId,
          heroName: hero.name,
          heroFaction: hero.faction as Faction,
          heroPower: hero.heroPowerJson as unknown as PlayerInfo["heroPower"],
          deck,
          isAI: false,
        };
        const p2: PlayerInfo = {
          socketId: null,
          userId: "ai_opponent",
          username: "AI",
          heroId: aiHero.id,
          heroName: aiHero.name,
          heroFaction: aiHero.faction as Faction,
          heroPower: aiHero.heroPowerJson as unknown as PlayerInfo["heroPower"],
          deck: aiDeck,
          isAI: true,
        };

        const room = createRoom(gameId, p1, p2, mode, cardRegistry);
        socket.join(gameId);
        socket.emit("match:found", gameId);

        // Init mulligan (auto-mulligans AI, starts human timer, broadcasts state)
        initMulligan(room, io);
        return;
      }

      // Human matchmaking queue
      joinQueue({
        socketId: socket.id,
        userId: authenticatedUserId,
        username: authenticatedUsername!,
        deckId,
        heroId,
        mode,
        joinedAt: Date.now(),
      });

      const match = tryMatchmake(mode);
      if (match) {
        const [entry1, entry2] = match;
        const gameId = randomUUID();

        const [deck1, deck2, hero1, hero2] = await Promise.all([
          getDeckCards(entry1.deckId, entry1.userId),
          getDeckCards(entry2.deckId, entry2.userId),
          prisma.hero.findUnique({ where: { id: entry1.heroId } }),
          prisma.hero.findUnique({ where: { id: entry2.heroId } }),
        ]);

        if (!hero1 || !hero2) return;

        const p1: PlayerInfo = {
          socketId: entry1.socketId,
          userId: entry1.userId,
          username: entry1.username,
          heroId: entry1.heroId,
          heroName: hero1.name,
          heroFaction: hero1.faction as Faction,
          heroPower: hero1.heroPowerJson as unknown as PlayerInfo["heroPower"],
          deck: deck1,
          isAI: false,
        };
        const p2: PlayerInfo = {
          socketId: entry2.socketId,
          userId: entry2.userId,
          username: entry2.username,
          heroId: entry2.heroId,
          heroName: hero2.name,
          heroFaction: hero2.faction as Faction,
          heroPower: hero2.heroPowerJson as unknown as PlayerInfo["heroPower"],
          deck: deck2,
          isAI: false,
        };

        const room = createRoom(gameId, p1, p2, mode, cardRegistry);

        // Get sockets and join room
        const socket1 = io.sockets.sockets.get(entry1.socketId);
        const socket2 = io.sockets.sockets.get(entry2.socketId);

        socket1?.join(gameId);
        socket2?.join(gameId);

        socket1?.emit("match:found", gameId);
        socket2?.emit("match:found", gameId);

        // Init mulligan (starts timers, broadcasts state to both)
        initMulligan(room, io);
      } else {
        socket.emit("queue:status", {
          queueSize: getQueueSize(mode),
          estimatedWait: getQueueSize(mode) * 30,
        });
      }
    });

    socket.on("queue:leave", () => {
      if (authenticatedUserId) leaveQueue(authenticatedUserId);
    });

    socket.on("game:action", (action: GameAction) => {
      if (!authenticatedUserId) return;

      const room = getRoomByUserId(authenticatedUserId);
      if (!room) {
        socket.emit("game:error", "Not in a game");
        return;
      }

      if (room.state.activePlayerId !== authenticatedUserId && action.type !== "mulligan" && action.type !== "surrender") {
        socket.emit("game:error", "Not your turn");
        return;
      }

      // Inject the authenticated userId for actions that need it
      const resolvedAction = (action.type === "mulligan" || action.type === "surrender")
        ? { ...action, playerId: authenticatedUserId }
        : action;

      handlePlayerAction(room, authenticatedUserId, resolvedAction, io);
    });

    socket.on("disconnect", () => {
      removeBySocketId(socket.id);

      // If player was in a game, they forfeit
      if (authenticatedUserId) {
        const room = getRoomByUserId(authenticatedUserId);
        if (room && room.state.status === "in_progress") {
          const opponentId = Object.keys(room.players).find((id) => id !== authenticatedUserId);
          if (opponentId) {
            const opponentInfo = room.players[opponentId];
            if (opponentInfo?.socketId) {
              io.to(opponentInfo.socketId).emit("game:game_over", {
                winner: opponentId,
                reason: "opponent_disconnected",
              });
            }
          }
        }
      }
    });
  });
}
