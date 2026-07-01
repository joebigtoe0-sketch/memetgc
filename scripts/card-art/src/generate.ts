import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { prisma } from "@memetgc/db";
import { CARDS as SEED_CARDS } from "../../../packages/db/prisma/seed.js";
import { ART_LABELS } from "../../../packages/db/prisma/art-labels.js";
import { EXPANSION_CARD_IDS } from "../../../packages/db/prisma/expansion-card-ids.js";
import { buildCardPrompt, type CardForArt } from "./promptBuilder.js";
import {
  BRIEF_FEW_SHOT,
  CREATURE_SUBJECT_RULES,
  FORCE_HUMAN_REGEN_IDS,
  getSampleArtBriefs,
} from "./creature-rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const OUTPUT_DIR = process.env.IMAGE_OUTPUT_DIR ?? path.join(REPO_ROOT, "apps/web/public/card-art");
const LOG_DIR = process.env.IMAGE_LOG_DIR ?? path.join(REPO_ROOT, "scripts/card-art/logs");
const MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const SIZE = (process.env.IMAGE_SIZE ?? "1024x1536") as "1024x1536" | "1024x1024" | "1536x1024";
const QUALITY = (process.env.IMAGE_QUALITY ?? "high") as "low" | "medium" | "high" | "auto" | "standard" | "hd";
const DELAY_MS = Number(process.env.IMAGE_DELAY_MS ?? "1500");
const BRIEF_MODEL = process.env.BRIEF_MODEL ?? "gpt-4.1";

const SAMPLE_ART_BRIEFS = getSampleArtBriefs();

interface CliArgs {
  cardId?: string;
  ids?: string[];
  set?: string;
  expansion: boolean;
  force: boolean;
  forceHumans: boolean;
  limit?: number;
  dryRun: boolean;
  all: boolean;
  source: "db" | "seed";
}

function parseArgs(): CliArgs {
  const args: CliArgs = { force: false, forceHumans: false, dryRun: false, all: false, expansion: false, source: "db" };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--force") args.force = true;
    else if (arg === "--force-humans") args.forceHumans = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--all") args.all = true;
    else if (arg === "--expansion") args.expansion = true;
    else if (arg === "--source=seed") args.source = "seed";
    else if (arg === "--source=db") args.source = "db";
    else if (arg.startsWith("--card-id=")) args.cardId = arg.slice("--card-id=".length);
    else if (arg.startsWith("--ids=")) args.ids = arg.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--set=")) args.set = arg.slice("--set=".length);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length));
  }
  if (args.expansion && !args.ids?.length) {
    args.ids = [...EXPANSION_CARD_IDS];
  }
  return args;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDirs(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function publicArtUrl(cardId: string): string {
  return `/card-art/${cardId}.png`;
}

function resolveArtBrief(card: { id: string; artLabel?: string | null }): string | null {
  const fromCard = card.artLabel?.trim();
  if (fromCard) return fromCard;
  const fromSample = SAMPLE_ART_BRIEFS[card.id]?.trim();
  if (fromSample) return fromSample;
  const fromCatalog = ART_LABELS[card.id]?.trim();
  if (fromCatalog) return fromCatalog;
  return null;
}

function shouldForceRegenerate(cardId: string, args: CliArgs, outputPath: string): boolean {
  if (args.force) return true;
  if (args.forceHumans && (FORCE_HUMAN_REGEN_IDS as readonly string[]).includes(cardId)) {
    return fs.existsSync(outputPath);
  }
  return false;
}

async function generateArtBrief(client: OpenAI, card: CardForArt): Promise<string> {
  const chat = await client.chat.completions.create({
    model: BRIEF_MODEL,
    messages: [{
      role: "user",
      content: `${CREATURE_SUBJECT_RULES}

${BRIEF_FEW_SHOT}

Write ONE creative visual description (max 40 words) for a trading card called "${card.name}" (${card.type}, ${card.rarity}, ${card.faction} faction).
Card ability: "${card.text ?? ""}".
Flavor: "${(card as { flavorText?: string }).flavorText ?? ""}".

Rules:
- Follow the creature archetype rules above strictly
- Describe ONLY what is depicted — memorable creature/object concepts, not literal ability text
- No art style words (no "digital painting", "cel-shaded", etc.)
- Start lowercase, no leading "a/an/the"
- Be specific and funny where the card is comedic`,
    }],
  });
  return chat.choices[0]?.message?.content?.trim() ?? card.name;
}

async function generateImage(client: OpenAI, prompt: string): Promise<Buffer> {
  const baseParams = { prompt, n: 1 };
  const modelChain = [MODEL, "gpt-image-2", "gpt-image-1", "dall-e-3"].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );

  let lastErr: Error | null = null;

  for (const model of modelChain) {
    try {
      const params: Record<string, unknown> = { ...baseParams, model };
      if (model === "dall-e-3") {
        params.size = SIZE === "1024x1536" ? "1024x1792" : SIZE;
        params.quality = QUALITY === "high" ? "hd" : "standard";
      } else {
        params.size = SIZE;
        params.quality = QUALITY;
      }

      const result = await client.images.generate(params as Parameters<typeof client.images.generate>[0]);
      const item = result.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
      if (item?.url) {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      }
      throw new Error("No image data in API response");
    } catch (e) {
      lastErr = e as Error;
      console.warn(`  [model ${model}] ${lastErr.message}`);
    }
  }
  throw lastErr ?? new Error("Image generation failed");
}

type CardRow = {
  id: string;
  name: string;
  type: string;
  faction: string;
  rarity: string;
  set?: string;
  text: string | null;
  artLabel: string | null;
  artUrl: string | null;
  collectible?: boolean;
  flavorText?: string | null;
};

async function loadCards(args: CliArgs): Promise<CardRow[]> {
  if (args.source === "seed") {
    let cards = SEED_CARDS.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      faction: c.faction,
      rarity: c.rarity,
      set: (c as { set?: string }).set,
      text: c.text ?? null,
      artLabel: resolveArtBrief({ id: c.id, artLabel: (c as { artLabel?: string }).artLabel }),
      artUrl: (c as { artUrl?: string }).artUrl ?? null,
      collectible: c.collectible !== false,
      flavorText: (c as { flavorText?: string }).flavorText ?? null,
    }));
    if (args.set) cards = cards.filter((c) => c.set === args.set);
    if (args.cardId) cards = cards.filter((c) => c.id === args.cardId);
    if (args.ids?.length) cards = cards.filter((c) => args.ids!.includes(c.id));
    if (!args.all) cards = cards.filter((c) => !c.artUrl);
    return cards;
  }

  if (args.cardId) {
    const card = await prisma.card.findUnique({ where: { id: args.cardId } });
    if (!card) throw new Error(`Card not found: ${args.cardId}`);
    return [{
      ...card,
      artLabel: resolveArtBrief(card),
    }];
  }

  const where: Record<string, unknown> = args.all ? {} : { artUrl: null };
  if (args.set) where.set = args.set;
  let rows = await prisma.card.findMany({
    where,
    orderBy: [{ faction: "asc" }, { cost: "asc" }, { name: "asc" }],
  });
  if (args.ids?.length) rows = rows.filter((c) => args.ids!.includes(c.id));
  if (args.cardId) rows = rows.filter((c) => c.id === args.cardId);
  return rows.map((card) => ({ ...card, artLabel: resolveArtBrief(card) }));
}

function writeManifest(entries: Record<string, string>): void {
  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  let existing: Record<string, string> = {};
  if (fs.existsSync(manifestPath)) {
    try { existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8")); } catch { /* ignore */ }
  }
  fs.writeFileSync(manifestPath, JSON.stringify({ ...existing, ...entries }, null, 2));
}

async function saveArtUrl(cardId: string, url: string, source: "db" | "seed"): Promise<void> {
  if (source === "seed") {
    writeManifest({ [cardId]: url });
    return;
  }
  await prisma.card.update({ where: { id: cardId }, data: { artUrl: url } });
}

async function run(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY. Copy scripts/card-art/.env.example to scripts/card-art/.env and add your key.");
    process.exit(1);
  }

  const args = parseArgs();
  ensureDirs();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let cards: CardRow[];
  try {
    cards = await loadCards(args);
  } catch (e) {
    if (args.source === "db") {
      console.warn(`DB unavailable (${(e as Error).message}), falling back to seed data. Use --source=seed to skip this warning.\n`);
      args.source = "seed";
      cards = await loadCards(args);
    } else throw e;
  }

  let pending = cards.filter((c) => c.collectible !== false);
  if (!args.all && !args.force && !args.forceHumans) {
    pending = pending.filter((c) => !c.artUrl);
  }

  if (args.forceHumans) {
    const humanSet = new Set(FORCE_HUMAN_REGEN_IDS);
    pending = pending.filter((c) => humanSet.has(c.id as typeof FORCE_HUMAN_REGEN_IDS[number]));
  }

  if (args.limit && args.limit > 0) pending = pending.slice(0, args.limit);

  console.log(`\nLegends of the Memepool — Card Art Generator`);
  console.log(`  Model:     ${MODEL} (falls back: gpt-image-2 → gpt-image-1 → dall-e-3)`);
  console.log(`  Brief:     ${BRIEF_MODEL} + hand-written catalog (${Object.keys(ART_LABELS).length} cards)`);
  console.log(`  Source:    ${args.source}`);
  console.log(`  Output:    ${OUTPUT_DIR}`);
  console.log(`  Cards:     ${pending.length} to process (${cards.length} loaded)\n`);

  if (pending.length === 0) {
    console.log("Nothing to generate — all cards already have art. Use --force to regenerate.");
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const card of pending) {
    const outputPath = path.join(OUTPUT_DIR, `${card.id}.png`);
    const url = publicArtUrl(card.id);

    if (!shouldForceRegenerate(card.id, args, outputPath) && fs.existsSync(outputPath)) {
      console.log(`[SKIP] ${card.id} — art file exists`);
      writeManifest({ [card.id]: url });
      continue;
    }

    let subjectDescription = card.artLabel?.trim() || null;
    if (!subjectDescription) {
      console.log(`[BRIEF] ${card.id} — no catalog brief, generating via LLM...`);
      subjectDescription = await generateArtBrief(client, card as CardForArt);
      console.log(`        → ${subjectDescription}`);
    } else {
      console.log(`[BRIEF] ${card.id} — ${subjectDescription}`);
    }

    const prompt = buildCardPrompt(card as CardForArt, subjectDescription);
    const logPath = path.join(LOG_DIR, `${card.id}.txt`);
    fs.writeFileSync(logPath, `card: ${card.name}\nbrief: ${subjectDescription}\nsource: ${card.artLabel ? "catalog" : "llm"}\n\n--- PROMPT ---\n${prompt}\n`);

    if (args.dryRun) {
      console.log(`[DRY]  ${card.id} (${card.name}) — prompt logged to ${logPath}`);
      continue;
    }

    console.log(`[GEN]  ${card.id} (${card.name}) — ${card.faction}/${card.rarity}...`);
    try {
      const image = await generateImage(client, prompt);
      fs.writeFileSync(outputPath, image);
      await saveArtUrl(card.id, url, args.source);
      console.log(`[OK]   ${card.id} → ${url}`);
      ok++;
    } catch (e) {
      console.error(`[FAIL] ${card.id} — ${(e as Error).message}`);
      fail++;
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${ok} generated, ${fail} failed.`);
}

run()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch { /* seed-only mode */ }
  });
