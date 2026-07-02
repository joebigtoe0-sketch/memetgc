import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@memetgc/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ART_DIR = path.join(REPO_ROOT, "apps/web/public/card-art");

dotenv.config({ path: path.join(REPO_ROOT, "packages/db/.env") });

/** Card ids whose on-disk JPG basename differs from the card id. */
const ART_FILE_ALIASES: Record<string, string> = {
  coin: "gas_token",
};

/** Rebuild manifest.json from on-disk JPGs and sync art_url into the database. */
async function run(): Promise<void> {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".jpg")).sort();
  const manifest: Record<string, string> = {};

  console.log(`Found ${files.length} card art JPGs.\n`);

  for (const file of files) {
    const id = file.replace(/\.jpg$/, "");
    manifest[id] = `/card-art/${file}`;
  }

  // Map card ids to aliased art files (e.g. coin → gas_token.jpg).
  for (const [cardId, fileBase] of Object.entries(ART_FILE_ALIASES)) {
    const file = `${fileBase}.jpg`;
    if (files.includes(file)) {
      manifest[cardId] = `/card-art/${file}`;
    }
  }

  const manifestPath = path.join(ART_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifestPath} (${files.length} entries).\n`);

  let synced = 0;
  try {
    for (const [id, url] of Object.entries(manifest)) {
      const result = await prisma.card.updateMany({ where: { id }, data: { artUrl: url } });
      if (result.count > 0) {
        synced++;
        console.log(`  ${id} → ${url}`);
      }
    }
    console.log(`\nSynced ${synced} art_url values to the database.`);
  } catch (e) {
    console.warn(`\nDatabase sync failed (${(e as Error).message}).`);
    console.warn("manifest.json was still updated — in-game art works via JPG paths + cardArtUrl rewrite.");
    console.warn("Re-run `pnpm art:sync` when your Railway database is reachable.");
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
