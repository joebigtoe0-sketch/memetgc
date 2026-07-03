import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, GameAction } from "@memetgc/types";
import { verifyToken } from "../middleware/auth.js";
import { prisma } from "@memetgc/db";
import { joinQueue, leaveQueue, tryMatchmake, removeBySocketId, getQueueSize, type QueueEntry } from "../matchmaking/queue.js";
import { createRoom, getRoom, getRoomByUserId, handlePlayerAction, handlePlayerDisconnect, handlePlayerReconnect, initMulligan, buildSanitizedState, type PlayerInfo } from "./room.js";
import type { Card, Keyword, CardEffect, HeroPower, Faction } from "@memetgc/types";
import { randomUUID } from "crypto";
import { getTokenBalance, MIN_PLAY_TOKENS } from "../lib/solana.js";
import { trackUserOnline, trackUserOffline } from "./online.js";

// In-memory card registry (loaded from DB on startup)
let cardRegistry: Map<string, Card> = new Map();
let lastRegistryLoad = 0;
// How long a loaded registry is considered fresh. Card data is edited rarely,
// but we reload before each match so DB card tweaks (text/effects) take effect
// without needing a full server redeploy.
const REGISTRY_TTL_MS = 60_000;

/** Reload the registry if it is stale, so card-data changes apply on the next match. */
export async function ensureFreshCardRegistry(): Promise<void> {
  if (Date.now() - lastRegistryLoad > REGISTRY_TTL_MS) {
    await loadCardRegistry();
  }
}

/** Number of cards currently loaded — used by the /health version marker. */
export function getCardRegistrySize(): number {
  return cardRegistry.size;
}

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
        art_url: c.artUrl ?? (c.id === "coin" ? "/card-art/gas_token.jpg" : `/card-art/${c.id}.jpg`),
        collectible: c.collectible,
        craftable: c.craftable,
        dust_value: c.dustValue,
        craft_cost: c.craftCost,
      } satisfies Card,
    ])
  );
  lastRegistryLoad = Date.now();
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

// ---------------------------------------------------------------------------
// Guided tutorial match
// ---------------------------------------------------------------------------

/** Fixed seed → identical shuffles/draws for every tutorial game. */
const TUTORIAL_SEED = 13372026;
const TUTORIAL_HERO_ID = "hero_satoshi";
/** Same list as the "HODL Gang" starter deck — simple bitcoin curve. */
const TUTORIAL_DECK_LIST: { id: string; qty: number }[] = [
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
];

function buildTutorialDeck(): Card[] {
  const deck: Card[] = [];
  for (const { id, qty } of TUTORIAL_DECK_LIST) {
    const card = cardRegistry.get(id);
    if (!card) continue;
    for (let i = 0; i < qty; i++) deck.push({ ...card });
  }
  return deck;
}

/**
 * Start the first-time-player tutorial: preset bitcoin deck, fixed seed so the
 * draws are always the same, and a training-dummy AI that can't win.
 */
async function beginTutorialMatch(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  userId: string,
  username: string
): Promise<void> {
  await ensureFreshCardRegistry();

  const hero = await prisma.hero.findUnique({ where: { id: TUTORIAL_HERO_ID } });
  if (!hero) {
    socket.emit("game:error", "Tutorial unavailable (hero missing)");
    return;
  }

  const playerDeck = buildTutorialDeck();
  const aiDeck = buildTutorialDeck();
  if (playerDeck.length !== 30) {
    socket.emit("game:error", "Tutorial unavailable (deck cards missing)");
    return;
  }

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { equippedCardBack: true } });

  const gameId = randomUUID();
  const p1: PlayerInfo = {
    socketId: socket.id,
    userId,
    username,
    heroId: hero.id,
    heroName: hero.name,
    heroFaction: hero.faction as Faction,
    heroPower: hero.heroPowerJson as unknown as PlayerInfo["heroPower"],
    deck: playerDeck,
    isAI: false,
    cardBack: me?.equippedCardBack ?? null,
  };
  const p2: PlayerInfo = {
    socketId: null,
    userId: "ai_opponent",
    username: "Training Bot",
    heroId: hero.id,
    heroName: hero.name,
    heroFaction: hero.faction as Faction,
    heroPower: hero.heroPowerJson as unknown as PlayerInfo["heroPower"],
    deck: aiDeck,
    isAI: true,
  };

  const room = createRoom(gameId, p1, p2, "tutorial", cardRegistry, TUTORIAL_SEED);
  socket.join(gameId);
  socket.emit("match:found", gameId);
  initMulligan(room, io);
}

/**
 * Build a room from two matched queue entries and start the mulligan.
 * Shared by the on-join matchmaking attempt and the periodic ticker.
 */
async function beginMatch(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  entry1: QueueEntry,
  entry2: QueueEntry,
  mode: string
): Promise<void> {
  const gameId = randomUUID();

  const [deck1, deck2, hero1, hero2, user1, user2] = await Promise.all([
    getDeckCards(entry1.deckId, entry1.userId),
    getDeckCards(entry2.deckId, entry2.userId),
    prisma.hero.findUnique({ where: { id: entry1.heroId } }),
    prisma.hero.findUnique({ where: { id: entry2.heroId } }),
    prisma.user.findUnique({ where: { id: entry1.userId }, select: { equippedCardBack: true } }),
    prisma.user.findUnique({ where: { id: entry2.userId }, select: { equippedCardBack: true } }),
  ]);

  if (!hero1 || !hero2) return;

  // Pick up any recent card-data changes without needing a full redeploy.
  await ensureFreshCardRegistry();

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
    cardBack: user1?.equippedCardBack ?? null,
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
    cardBack: user2?.equippedCardBack ?? null,
  };

  const room = createRoom(gameId, p1, p2, mode, cardRegistry);

  const socket1 = io.sockets.sockets.get(entry1.socketId);
  const socket2 = io.sockets.sockets.get(entry2.socketId);

  socket1?.join(gameId);
  socket2?.join(gameId);

  socket1?.emit("match:found", gameId);
  socket2?.emit("match:found", gameId);

  initMulligan(room, io);
}

/**
 * Periodic matchmaking sweep. Ranked windows widen with wait time, so waiting
 * players must be re-checked even when no one new joins.
 */
export function startMatchmakingTicker(
  io: Server<ClientToServerEvents, ServerToClientEvents>
): NodeJS.Timeout {
  return setInterval(() => {
    void (async () => {
      for (const mode of ["ranked", "casual"] as const) {
        let match = tryMatchmake(mode);
        while (match) {
          await beginMatch(io, match[0], match[1], mode);
          match = tryMatchmake(mode);
        }
      }
    })();
  }, 3000);
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
        trackUserOnline(payload.userId);
      }
    }

    // If this user is already in an active game room (e.g. page refresh), re-join and resync
    if (authenticatedUserId) {
      const existingRoom = getRoomByUserId(authenticatedUserId);
      if (existingRoom && existingRoom.players[authenticatedUserId]) {
        existingRoom.players[authenticatedUserId]!.socketId = socket.id;
        socket.join(existingRoom.gameId);
        socket.emit("match:found", existingRoom.gameId);
        // Cancel any pending forfeit, restart turn timer, and resync state.
        handlePlayerReconnect(existingRoom, authenticatedUserId, io);
        const sanitized = buildSanitizedState(existingRoom, authenticatedUserId);
        socket.emit("game:state_update", sanitized);
      }
    }

    socket.on("queue:join", async ({ mode, deckId, heroId }) => {
      if (!authenticatedUserId || !authenticatedUsername) {
        socket.emit("game:error", "Not authenticated");
        return;
      }

      // Token gate: every queue join requires holding the minimum $MEMEPOOL (defense in depth)
      {
        const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
        if (!user?.walletAddress) {
          socket.emit("game:error", "Wallet required to play");
          return;
        }
        const hasTokens = await checkDegenBalance(user.walletAddress);
        if (!hasTokens) {
          socket.emit("game:error", `Need ${MIN_PLAY_TOKENS.toLocaleString()} $MEMEPOOL to play`);
          return;
        }
        // New players must finish the guided tutorial before playing vs humans.
        if ((mode === "casual" || mode === "ranked") && !user.tutorialDone) {
          socket.emit("game:error", "Finish the tutorial first to unlock Casual and Ranked");
          return;
        }
      }

      // Guided tutorial: fixed deck, fixed seed, harmless AI — no deck needed.
      if (mode === "tutorial") {
        leaveQueue(authenticatedUserId);
        await beginTutorialMatch(io, socket, authenticatedUserId, authenticatedUsername!);
        return;
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
        const me = await prisma.user.findUnique({ where: { id: authenticatedUserId }, select: { equippedCardBack: true } });
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
          cardBack: me?.equippedCardBack ?? null,
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

        await ensureFreshCardRegistry();
        const room = createRoom(gameId, p1, p2, mode, cardRegistry);
        socket.join(gameId);
        socket.emit("match:found", gameId);

        // Init mulligan (auto-mulligans AI, starts human timer, broadcasts state)
        initMulligan(room, io);
        return;
      }

      // Human matchmaking queue — include MMR so ranked can match by rating
      const queueUser = await prisma.user.findUnique({
        where: { id: authenticatedUserId },
        select: { mmr: true },
      });

      joinQueue({
        socketId: socket.id,
        userId: authenticatedUserId,
        username: authenticatedUsername!,
        deckId,
        heroId,
        mode,
        mmr: queueUser?.mmr ?? 1000,
        joinedAt: Date.now(),
      });

      const match = tryMatchmake(mode);
      if (match) {
        await beginMatch(io, match[0], match[1], mode);
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
      if (authenticatedUserId) trackUserOffline(authenticatedUserId);

      // If the player was in a live game, start the disconnect grace/forfeit
      // flow rather than ending it instantly. The socketId guard prevents a
      // stale disconnect (from a socket the player already replaced by
      // reconnecting) from wrongly forfeiting the match.
      if (authenticatedUserId) {
        const room = getRoomByUserId(authenticatedUserId);
        if (
          room &&
          (room.state.status === "in_progress" || room.state.status === "mulligan") &&
          room.players[authenticatedUserId]?.socketId === socket.id
        ) {
          handlePlayerDisconnect(room, authenticatedUserId, io);
        }
      }
    });
  });
}
