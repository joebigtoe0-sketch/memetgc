import { PrismaClient } from "@prisma/client";
import { CARDS } from "./seed";

/**
 * Pushes card DATA for every card from the TS definitions into the DB — both the
 * mechanical JSON (effects, keywords, hero power) AND the display fields (text,
 * name, cost, stats, etc.). Safe to run repeatedly — it does not touch users,
 * collections, decks, or economy. Use after editing card data so the live server
 * (which loads cards from the DB) picks up the changes.
 *
 * The game server reloads its card registry before each match (short TTL), so
 * running this is usually enough to make card tweaks appear live without a full
 * server redeploy.
 *
 *   pnpm --filter @memetgc/db exec tsx prisma/update-card-effects.ts
 */
const prisma = new PrismaClient();

type AnyCard = Record<string, unknown>;

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

async function main() {
  let updated = 0;
  let missing = 0;
  for (const raw of CARDS) {
    const card = raw as AnyCard;
    const id = card.id as string;
    const existing = await prisma.card.findUnique({ where: { id } });
    if (!existing) {
      missing++;
      console.warn(`  ! card not in DB (skipped): ${id}`);
      continue;
    }
    await prisma.card.update({
      where: { id },
      data: {
        // Display / identity fields
        name: (card.name as string) ?? existing.name,
        set: (card.set as string) ?? existing.set,
        type: (card.type as string) ?? existing.type,
        faction: (card.faction as string) ?? existing.faction,
        rarity: (card.rarity as string) ?? existing.rarity,
        tribe: str(card.tribe),
        cost: num(card.cost) ?? existing.cost,
        attack: num(card.attack),
        health: num(card.health),
        armor: num(card.armor),
        durability: num(card.durability),
        text: str(card.text),
        flavorText: str(card.flavorText),
        artUrl: str(card.artUrl),
        collectible: (card.collectible as boolean) ?? existing.collectible,
        craftable: (card.craftable as boolean) ?? existing.craftable,
        dustValue: num(card.dustValue) ?? existing.dustValue,
        craftCost: num(card.craftCost) ?? existing.craftCost,
        // Mechanical JSON
        keywordsJson: (card.keywordsJson ?? []) as object,
        effectsJson: (card.effectsJson ?? []) as object,
        heroPowerJson: (card.heroPowerJson ?? undefined) as object | undefined,
      } as Parameters<typeof prisma.card.update>[0]["data"],
    });
    updated++;
  }
  console.log(`Done. Synced ${updated} cards (${missing} not found in DB).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
