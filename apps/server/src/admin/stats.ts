import { prisma } from "@memetgc/db";
import type { AdminEconomyStats } from "@memetgc/types";
import { readPlatformStat } from "./platformStats.js";

const HUMAN = { isBot: false } as const;

function dec(n: bigint | number | { toNumber(): number } | null | undefined): number {
  if (n == null) return 0;
  if (typeof n === "bigint") return Number(n);
  if (typeof n === "object" && "toNumber" in n) return n.toNumber();
  return n;
}

export async function getAdminEconomyStats(): Promise<AdminEconomyStats> {
  const [
    humanCount,
    botCount,
    packsOpenedAgg,
    packsUnopenedAgg,
    marketSoldAgg,
    marketSoldCards,
    marketSoldPacks,
    activeListings,
    fragmentsCirculation,
    matchCount,
    tournamentFragClaims,
    rarityRows,
    uniqueCards,
    totalCardsAgg,
    packsBought,
    fragmentsSpentPacks,
    questFragRows,
  ] = await Promise.all([
    prisma.user.count({ where: HUMAN }),
    prisma.user.count({ where: { isBot: true } }),
    prisma.user.aggregate({ _sum: { packsOpened: true }, where: HUMAN }),
    prisma.packInventory.aggregate({
      _sum: { quantity: true },
      where: { quantity: { gt: 0 }, user: HUMAN },
    }),
    prisma.marketListing.aggregate({
      _sum: { price: true },
      _count: { id: true },
      where: { status: "sold" },
    }),
    prisma.marketListing.count({ where: { status: "sold", kind: "card" } }),
    prisma.marketListing.count({ where: { status: "sold", kind: "pack" } }),
    prisma.marketListing.count({ where: { status: "active" } }),
    prisma.user.aggregate({ _sum: { fragments: true }, where: HUMAN }),
    prisma.match.count(),
    prisma.tournamentPayout.aggregate({
      _sum: { amount: true },
      where: { currencyLabel: "fragments", status: "claimed" },
    }),
    prisma.$queryRaw<{ rarity: string; qty: bigint }[]>`
      SELECT c.rarity, SUM(ce.quantity)::bigint AS qty
      FROM collection_entries ce
      INNER JOIN cards c ON c.id = ce.card_id
      INNER JOIN users u ON u.id = ce.user_id
      WHERE u.is_bot = false
      GROUP BY c.rarity
    `,
    prisma.collectionEntry.groupBy({
      by: ["cardId"],
      where: { user: HUMAN },
      _count: { cardId: true },
    }),
    prisma.collectionEntry.aggregate({
      _sum: { quantity: true },
      where: { user: HUMAN },
    }),
    readPlatformStat("packs_bought"),
    readPlatformStat("fragments_spent_packs"),
    prisma.$queryRaw<{ total: bigint | null }[]>`
      SELECT COALESCE(SUM((reward_json->>'fragments')::int), 0)::bigint AS total
      FROM daily_quests
      WHERE claimed_at IS NOT NULL
    `,
  ]);

  const byRarity = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const row of rarityRows) {
    const key = row.rarity as keyof typeof byRarity;
    if (key in byRarity) byRarity[key] = dec(row.qty);
  }

  const questFragments = dec(questFragRows[0]?.total);

  return {
    players: { humans: humanCount, bots: botCount },
    packs: {
      opened: packsOpenedAgg._sum.packsOpened ?? 0,
      unopened: packsUnopenedAgg._sum.quantity ?? 0,
      bought: packsBought,
      fragmentsSpent: fragmentsSpentPacks,
    },
    market: {
      salesTotal: marketSoldAgg._count.id,
      salesCards: marketSoldCards,
      salesPacks: marketSoldPacks,
      tokenVolume: dec(marketSoldAgg._sum.price),
      activeListings,
    },
    collection: {
      totalCards: totalCardsAgg._sum.quantity ?? 0,
      uniqueCardIds: uniqueCards.length,
      legendaries: byRarity.legendary,
      byRarity,
    },
    fragments: {
      inCirculation: fragmentsCirculation._sum.fragments ?? 0,
      fromQuests: questFragments,
      fromTournaments: tournamentFragClaims._sum.amount ?? 0,
      trackedSourcesTotal: questFragments + (tournamentFragClaims._sum.amount ?? 0),
    },
    matches: { total: matchCount },
  };
}
