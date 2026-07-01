/**
 * Manual season rollover (admin script).
 *
 * Usage:
 *   tsx prisma/end-season.ts --confirm [nextSeasonName]
 *
 * What it does for the active season:
 *   1. Determines each ranked participant's reward tier from their season peak
 *      points (highest reached). Memepool tier = live top-N by final points.
 *   2. Grants tier rewards (fragments + unique card back; Memepool also a badge).
 *   3. Soft-floor resets rank points / MMR and recomputes tier/stars.
 *   4. Closes the season and opens the next one.
 *
 * Without --confirm it prints a dry-run summary and changes nothing.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const confirm = process.argv.includes("--confirm");
const nextNameArg = process.argv.find((a) => !a.startsWith("--") && !a.includes("end-season") && !a.includes("tsx") && !a.includes("node"));

// ── Ladder math (kept in sync with apps/server/src/game/rank.ts) ──────────────
type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "degen";
const TIER_FLOORS: { tier: Tier; floor: number }[] = [
  { tier: "diamond", floor: 2000 },
  { tier: "platinum", floor: 1500 },
  { tier: "gold", floor: 1000 },
  { tier: "silver", floor: 500 },
  { tier: "bronze", floor: 0 },
];
const POINTS_PER_STAR = 100;
const STARS_PER_TIER = 5;
const MEMEPOOL_TOP_N = 100;
const MEMEPOOL_MIN_POINTS = 2000;

function tierFromPoints(points: number): { tier: Tier; stars: number } {
  const p = Math.max(0, Math.floor(points));
  const band = TIER_FLOORS.find((b) => p >= b.floor) ?? TIER_FLOORS[TIER_FLOORS.length - 1]!;
  const stars = Math.min(STARS_PER_TIER - 1, Math.floor((p - band.floor) / POINTS_PER_STAR));
  return { tier: band.tier, stars };
}

// ── Reward table (matches the Seasons section in the docs) ────────────────────
const REWARDS: Record<Tier, { fragments: number; cardBack: boolean; badge: boolean }> = {
  bronze: { fragments: 150, cardBack: false, badge: false },
  silver: { fragments: 500, cardBack: false, badge: false },
  gold: { fragments: 800, cardBack: true, badge: false },
  platinum: { fragments: 1500, cardBack: true, badge: false },
  diamond: { fragments: 2500, cardBack: true, badge: false },
  degen: { fragments: 6000, cardBack: true, badge: true }, // Memepool
};

// Soft reset: compress points toward the floor and MMR toward the 1000 baseline.
function softResetPoints(points: number): number {
  return Math.round(Math.max(0, points) * 0.4);
}
function softResetMmr(mmr: number): number {
  return Math.round(1000 + (mmr - 1000) * 0.5);
}

async function main(): Promise<void> {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { number: "desc" },
  });
  if (!season) {
    console.error("No active season found. Nothing to end.");
    process.exit(1);
  }

  console.log(`Active season: #${season.number} "${season.name}"`);

  // Ranked participants this season.
  const participants = await prisma.user.findMany({
    where: {
      OR: [{ seasonPeakPoints: { gt: 0 } }, { rankPoints: { gt: 0 } }, { seasonWins: { gt: 0 } }, { seasonLosses: { gt: 0 } }],
    },
    select: { id: true, username: true, rankPoints: true, mmr: true, seasonPeakPoints: true },
  });

  // Memepool = current top-N by points (that clear the Diamond floor).
  const memepoolSet = new Set(
    [...participants]
      .filter((p) => p.rankPoints >= MEMEPOOL_MIN_POINTS)
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .slice(0, MEMEPOOL_TOP_N)
      .map((p) => p.id)
  );

  const cardBackValue = `cardback_s${season.number}`;
  const badgeValue = `badge_memepool_s${season.number}`;

  const summary: Record<Tier, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0, degen: 0 };

  for (const p of participants) {
    const rewardTier: Tier = memepoolSet.has(p.id) ? "degen" : tierFromPoints(p.seasonPeakPoints).tier;
    summary[rewardTier]++;

    if (!confirm) continue;

    const reward = REWARDS[rewardTier];
    const newPoints = softResetPoints(p.rankPoints);
    const newMmr = softResetMmr(p.mmr);
    const { tier, stars } = tierFromPoints(newPoints);

    await prisma.user.update({
      where: { id: p.id },
      data: {
        fragments: { increment: reward.fragments },
        rankPoints: newPoints,
        mmr: newMmr,
        rankTier: tier,
        rankStars: stars,
        seasonWins: 0,
        seasonLosses: 0,
        seasonPeakPoints: 0,
        ...(reward.badge ? { equippedBadge: badgeValue } : {}),
      },
    });

    if (reward.cardBack) {
      await prisma.userCosmetic.upsert({
        where: { userId_type_value: { userId: p.id, type: "card_back", value: cardBackValue } },
        update: {},
        create: { userId: p.id, type: "card_back", value: cardBackValue, seasonId: season.id },
      });
    }
    if (reward.badge) {
      await prisma.userCosmetic.upsert({
        where: { userId_type_value: { userId: p.id, type: "badge", value: badgeValue } },
        update: {},
        create: { userId: p.id, type: "badge", value: badgeValue, seasonId: season.id },
      });
    }
  }

  console.log("\nReward tier distribution:");
  for (const t of Object.keys(summary) as Tier[]) {
    console.log(`  ${t.padEnd(9)} ${summary[t]}`);
  }

  if (!confirm) {
    console.log("\nDRY RUN — no changes written. Re-run with --confirm to apply.");
    return;
  }

  // Close current season, open the next.
  const nextNumber = season.number + 1;
  const nextName = nextNameArg ?? `Season ${nextNumber}`;
  await prisma.season.update({
    where: { id: season.id },
    data: { isActive: false, endedAt: new Date() },
  });
  await prisma.season.create({
    data: { number: nextNumber, name: nextName, isActive: true },
  });

  console.log(`\nSeason #${season.number} closed. Opened season #${nextNumber} "${nextName}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
