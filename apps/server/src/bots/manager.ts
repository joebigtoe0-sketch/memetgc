import { prisma } from "@memetgc/db";
import { joinQueue, leaveQueue, getQueueEntries, isQueued, rankedMmrWindow } from "../matchmaking/queue.js";
import { getRoomByUserId } from "../game/room.js";

/**
 * Disguised AI ladder players ("bots"). Each one is a real User row with a
 * random 60-card collection and a deck built from it. They hop into the
 * casual/ranked queues when a human has been waiting, play through the normal
 * room machinery with the smart AI + human-like pacing, and gain/lose real MMR
 * and ladder points like anyone else.
 *
 * When a human is waiting, one bot joins to fill the slot — picked at random
 * (casual) or at random among bots in the ranked MMR window. Bots never queue
 * on their own and never play each other.
 */

const COPY_LIMITS: Record<string, number> = { common: 4, rare: 3, epic: 2, legendary: 1 };
const BOT_CARDS_GRANTED = 60;

const BOT_PROFILES: { username: string; deckName: string; startMmr: number }[] = [
  { username: "HodlGorilla", deckName: "Gorilla Grip", startMmr: 960 },
  { username: "rugpull_survivor", deckName: "Never Again", startMmr: 1020 },
  { username: "SatsStacker21", deckName: "Stack City", startMmr: 1090 },
  { username: "gasfee_victim", deckName: "Pain Train", startMmr: 950 },
  { username: "DiamondDennis", deckName: "Hands of Stone", startMmr: 1150 },
];

interface BotIdentity {
  userId: string;
  username: string;
  deckId: string;
  heroId: string;
}

let bots: BotIdentity[] = [];

/** Create bot accounts, collections and decks if they don't exist yet. Idempotent. */
export async function ensureBots(): Promise<void> {
  const identities: BotIdentity[] = [];

  for (const profile of BOT_PROFILES) {
    try {
      let user = await prisma.user.findUnique({ where: { username: profile.username } });
      if (user && !user.isBot) {
        // A real player already owns this name — leave them alone.
        console.warn(`[bots] username "${profile.username}" taken by a real user, skipping`);
        continue;
      }
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: profile.username,
            hasUsername: true,
            isNewPlayer: false,
            tutorialDone: true,
            isBot: true,
            mmr: profile.startMmr,
          },
        });
      }

      // Random collection: 60 pulls (duplicates allowed) from all collectible cards.
      const owned = await prisma.collectionEntry.count({ where: { userId: user.id } });
      if (owned === 0) {
        await grantRandomCards(user.id, BOT_CARDS_GRANTED);
      }

      // One deck built from whatever they pulled.
      let deck = await prisma.deck.findFirst({ where: { userId: user.id }, include: { deckCards: true } });
      if (!deck) {
        const built = await buildBotDeck(user.id, profile.deckName);
        deck = built;
      }
      if (!deck) {
        console.warn(`[bots] could not build a deck for ${profile.username}, skipping`);
        continue;
      }

      identities.push({ userId: user.id, username: user.username, deckId: deck.id, heroId: deck.heroId });
    } catch (err) {
      console.error(`[bots] failed to seed ${profile.username}:`, err);
    }
  }

  bots = identities;
  console.log(`[bots] ${bots.length} ladder bots ready: ${bots.map((b) => b.username).join(", ")}`);
}

/** Add `count` random collectible cards (dupes allowed) to a user's collection. */
async function grantRandomCards(userId: string, count: number): Promise<void> {
  const pool = await prisma.card.findMany({ where: { collectible: true }, select: { id: true } });
  if (pool.length === 0) return;

  const pulls = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const cardId = pool[Math.floor(Math.random() * pool.length)]!.id;
    pulls.set(cardId, (pulls.get(cardId) ?? 0) + 1);
  }

  for (const [cardId, quantity] of pulls) {
    await prisma.collectionEntry.upsert({
      where: { userId_cardId_frameTier: { userId, cardId, frameTier: "default" } },
      update: { quantity: { increment: quantity } },
      create: { userId, cardId, quantity, frameTier: "default" },
    });
  }
}

/**
 * Build a legal 30-card deck out of the bot's collection: lean into whichever
 * faction they own the most of, fill the rest by cost curve. Tops the
 * collection up with more random cards if 60 pulls weren't enough for 30
 * deck-legal copies (respecting per-rarity copy limits).
 */
async function buildBotDeck(userId: string, deckName: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const entries = await prisma.collectionEntry.findMany({
      where: { userId },
      include: { card: true },
    });

    // Aggregate quantities across frame tiers
    const byCard = new Map<string, { card: (typeof entries)[number]["card"]; qty: number }>();
    for (const e of entries) {
      const cur = byCard.get(e.cardId);
      if (cur) cur.qty += e.quantity;
      else byCard.set(e.cardId, { card: e.card, qty: e.quantity });
    }

    // Majority faction by owned copies
    const factionCount = new Map<string, number>();
    for (const { card, qty } of byCard.values()) {
      factionCount.set(card.faction, (factionCount.get(card.faction) ?? 0) + qty);
    }
    const topFaction = [...factionCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "bitcoin";

    // Preferred faction first, then cheap-to-expensive for a sane curve
    const candidates = [...byCard.values()].sort((a, b) => {
      const af = a.card.faction === topFaction ? 0 : 1;
      const bf = b.card.faction === topFaction ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.card.cost - b.card.cost;
    });

    const picks = new Map<string, number>();
    let total = 0;
    for (const { card, qty } of candidates) {
      if (total >= 30) break;
      const limit = COPY_LIMITS[card.rarity] ?? 1;
      const take = Math.min(qty, limit, 30 - total);
      if (take > 0) {
        picks.set(card.id, take);
        total += take;
      }
    }

    if (total < 30) {
      // Not enough legal copies — pull some more cards and try again.
      await grantRandomCards(userId, 15);
      continue;
    }

    const hero =
      (await prisma.hero.findFirst({ where: { faction: topFaction } })) ??
      (await prisma.hero.findFirst());
    if (!hero) return null;

    const deck = await prisma.deck.create({
      data: { userId, name: deckName, heroId: hero.id, isStarter: false },
      include: { deckCards: true },
    });
    for (const [cardId, quantity] of picks) {
      await prisma.deckCard.create({ data: { deckId: deck.id, cardId, quantity } });
    }
    return deck;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Queue behavior
// ---------------------------------------------------------------------------

const TICK_MS = 5_000;
// A human must have waited at least this long (randomized per player) before a
// bot "happens" to queue up — instant matches every time would be a tell.
const MIN_WAIT_MS = 6_000;
const EXTRA_WAIT_MS = 12_000;

/** per (userId+mode) randomized wait threshold, so bot arrival times vary */
const waitThresholds = new Map<string, number>();

export function startBotTicker(): NodeJS.Timeout {
  return setInterval(() => {
    void tick().catch((err) => console.error("[bots] ticker error:", err));
  }, TICK_MS);
}

async function tick(): Promise<void> {
  if (bots.length === 0) return;
  if (waitThresholds.size > 500) waitThresholds.clear();

  for (const mode of ["casual", "ranked"] as const) {
    const entries = getQueueEntries(mode);
    const humans = entries.filter((e) => !e.isBot);
    const botsQueued = entries.filter((e) => e.isBot);

    // Nobody real is waiting — pull any lingering bots out so two bots never
    // end up alone in a queue together.
    if (humans.length === 0) {
      for (const b of botsQueued) leaveQueue(b.userId);
      continue;
    }

    // One bot per unmatched human at most.
    if (botsQueued.length >= humans.length) continue;

    const seeker = [...humans].sort((a, b) => a.joinedAt - b.joinedAt)[0]!;
    const key = seeker.userId + ":" + mode;
    let threshold = waitThresholds.get(key);
    if (threshold === undefined) {
      threshold = MIN_WAIT_MS + Math.random() * EXTRA_WAIT_MS;
      waitThresholds.set(key, threshold);
    }
    if (Date.now() - seeker.joinedAt < threshold) continue;

    const idle = bots.filter((b) => !isQueued(b.userId) && !getRoomByUserId(b.userId));
    if (idle.length === 0) continue;

    // Ranked: send the bot whose rating is closest to the waiting player so
    // the MMR window matches them quickly. Casual: anyone.
    const users = await prisma.user.findMany({
      where: { id: { in: idle.map((b) => b.userId) } },
      select: { id: true, mmr: true },
    });
    const mmrById = new Map(users.map((u) => [u.id, u.mmr]));

    let pool = idle;
    if (mode === "ranked") {
      const waitedMs = Date.now() - seeker.joinedAt;
      const window = rankedMmrWindow(waitedMs);
      const inWindow = idle.filter(
        (b) => Math.abs((mmrById.get(b.userId) ?? 1000) - seeker.mmr) <= window
      );
      if (inWindow.length > 0) pool = inWindow;
    }

    const pick = pool[Math.floor(Math.random() * pool.length)]!;

    joinQueue({
      socketId: "",
      userId: pick.userId,
      username: pick.username,
      deckId: pick.deckId,
      heroId: pick.heroId,
      mode,
      mmr: mmrById.get(pick.userId) ?? 1000,
      joinedAt: Date.now(),
      isBot: true,
    });
    waitThresholds.delete(key);
  }
}
