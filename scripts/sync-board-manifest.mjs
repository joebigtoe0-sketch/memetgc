import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boardsDir = path.join(root, "apps/web/public/boards");

const IMAGE_EXT = /\.(png|jpe?g|webp|avif)$/i;

const boards = fs
  .readdirSync(boardsDir)
  .filter((name) => IMAGE_EXT.test(name))
  .sort()
  .map((name) => `/boards/${name}`);

if (boards.length === 0) {
  console.error("No board images found in apps/web/public/boards");
  process.exit(1);
}

const manifestPath = path.join(boardsDir, "manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify({ boards }, null, 2)}\n`);
console.log(`Wrote ${boards.length} board(s) to ${path.relative(root, manifestPath)}`);
