import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@memetgc/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ART_DIR = path.join(REPO_ROOT, "apps/web/public/card-art");

/** Rebuild manifest.json from on-disk PNGs and sync art_url into the database. */
async function run(): Promise<void> {
  const files = fs.readdirSync(ART_DIR).filter((f) => f.endsWith(".png")).sort();
  const manifest: Record<string, string> = {};

  console.log(`Found ${files.length} card art PNGs.\n`);

  for (const file of files) {
    const id = file.replace(/\.png$/, "");
    const url = `/card-art/${id}.png`;
    manifest[id] = url;
    await prisma.card.updateMany({ where: { id }, data: { artUrl: url } });
    console.log(`  ${id}`);
  }

  const manifestPath = path.join(ART_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${manifestPath} (${files.length} entries) and synced database art_url.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
