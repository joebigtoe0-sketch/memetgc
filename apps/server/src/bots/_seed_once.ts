import "dotenv/config";
import { ensureBots } from "./manager.js";
import { prisma } from "@memetgc/db";

async function main() {
  await ensureBots();
  const bots = await prisma.user.findMany({
    where: { isBot: true },
    select: { id: true, username: true, mmr: true },
  });
  for (const b of bots) {
    const cards = await prisma.collectionEntry.aggregate({ where: { userId: b.id }, _sum: { quantity: true } });
    const deck = await prisma.deck.findFirst({ where: { userId: b.id }, include: { deckCards: true } });
    const deckSize = deck?.deckCards.reduce((s, dc) => s + dc.quantity, 0) ?? 0;
    console.log(`${b.username}: mmr=${b.mmr} collection=${cards._sum.quantity} deck="${deck?.name}" hero=${deck?.heroId} cards=${deckSize}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
