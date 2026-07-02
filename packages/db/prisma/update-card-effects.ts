import { PrismaClient } from "@prisma/client";
import { CARDS } from "./seed";

/**
 * Pushes ONLY the mechanical JSON (effects, keywords, hero power) for every card
 * from the TS definitions into the DB. Safe to run repeatedly — it does not touch
 * users, collections, decks, or economy. Use after editing card effect/target
 * data so the live server (which loads effects from the DB) picks up the changes.
 *
 *   pnpm --filter @memetgc/db exec tsx prisma/update-card-effects.ts
 */
const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  let missing = 0;
  for (const card of CARDS) {
    const existing = await prisma.card.findUnique({ where: { id: card.id } });
    if (!existing) {
      missing++;
      console.warn(`  ! card not in DB (skipped): ${card.id}`);
      continue;
    }
    await prisma.card.update({
      where: { id: card.id },
      data: {
        keywordsJson: (card as { keywordsJson?: unknown }).keywordsJson ?? [],
        effectsJson: (card as { effectsJson?: unknown }).effectsJson ?? [],
        heroPowerJson: (card as { heroPowerJson?: unknown }).heroPowerJson ?? undefined,
      } as Parameters<typeof prisma.card.update>[0]["data"],
    });
    updated++;
  }
  console.log(`Done. Updated ${updated} cards' effects (${missing} not found in DB).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
