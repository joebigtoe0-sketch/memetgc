import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@memetgc/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ART_DIR = path.join(REPO_ROOT, "apps/web/public/card-art");

/** Push local /card-art/*.png URLs into the database art_url column. */
async function run(): Promise<void> {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Syncing ${files.length} art URLs to database...\n`);
  let updated = 0;
  for (const file of files) {
    const id = file.replace(/\.png$/, "");
    const url = `/card-art/${id}.png`;
    await prisma.card.updateMany({ where: { id }, data: { artUrl: url } });
    updated++;
    console.log(`  ${id} → ${url}`);
  }
  console.log(`\nDone. Updated ${updated} cards.`);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
