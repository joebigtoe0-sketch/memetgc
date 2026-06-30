import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SampleCard {
  id: string;
  name: string;
  type: string;
  faction: string;
  rarity: string;
  text?: string;
  art_brief?: string;
  art_url?: string | null;
  /** When sample card id differs from seed/database id */
  _seed_id?: string;
}

let _cache: SampleCard[] | null = null;

export function loadSampleCards(): SampleCard[] {
  if (_cache) return _cache;
  const file = path.join(__dirname, "../cards.json");
  _cache = JSON.parse(fs.readFileSync(file, "utf-8")) as SampleCard[];
  return _cache;
}

/** art_brief keyed by seed/database card id */
export function getSampleArtBriefs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const card of loadSampleCards()) {
    if (!card.art_brief?.trim()) continue;
    const seedId = card._seed_id ?? card.id;
    out[seedId] = card.art_brief.trim();
  }
  return out;
}

/** Whether this card's faction/type may depict human characters in art briefs and prompts. */
export function allowsHumanSubjects(card: { type: string; faction: string; rarity: string }): boolean {
  if (card.type === "hero") return true;
  if (card.faction === "bitcoin") return true;
  if (card.type === "minion" && card.rarity === "legendary") return true;
  return false;
}

/**
 * Non-Bitcoin cards that previously generated with human characters and need --force regeneration.
 */
export const FORCE_HUMAN_REGEN_IDS = [
  "meme_moon_boy",
  "meme_elon_shill",
  "meme_100x_bet",
  "stable_risk_manager",
  "stable_yield_farmer",
] as const;

export const CREATURE_SUBJECT_RULES = `
SUBJECT RULES (mandatory for all new art briefs):

Bitcoin faction — humans ARE allowed:
- Bitcoin minions/spells/weapons may depict human characters (traders, maxis, vault guards, hodlers, etc.)
- Bitcoin may ALSO use: stone golems, armored dwarves, vault guardians, rock/metal/crystal creatures

All other factions — no humans (except heroes & legendary KOL minions):
- Ethereum, Solana, Meme, Stable, Degen: Common/Rare/Epic must be creatures, monsters, or anthropomorphized objects — never a realistic human in a suit
- Hero cards: humans allowed (Satoshi = anonymous hooded figure)
- Legendary KOL minions (non-Bitcoin): humans allowed when the card is a named character

Faction creature archetypes (use when not depicting a human):
- Bitcoin: stone golems, armored dwarves, vault guardians, creatures made of rock/metal/crystal
- Ethereum: geometric elemental spirits, crystalline beings, glowing rune constructs, circuit-patterned creatures
- Solana: fast small creatures (ferrets, lizards, insects), always mid-motion with speed trails
- Meme: frogs, cartoon animals, absurd internet creature hybrids, maximum chaos
- Stable: sentient filing cabinets, clockwork automatons, suited robots, spreadsheet golems
- Degen: feral goblins, rats, glitching creatures, wild-eyed beasts with rune tattoos
`.trim();

export const BRIEF_FEW_SHOT = `
Examples of good card art briefs (subject only, no style words):
- Paper Hands (Degen): a small scrawny goblin made entirely of crumpled paper, eyes wide with panic, mid-sprint, paper sheets peeling off its body as it flees
- Diamond Hands (Bitcoin): a battle-worn crypto trader encased from the waist down in glowing crystalline diamond, fists clenched, refusing to move
- Block Defender (Bitcoin): a broad vault guard in orange armor holding a massive golden bitcoin shield, feet planted wide blocking an incoming shockwave
- Cold Wallet (Stable): a sturdy iron lockbox creature with stubby legs and a combination dial for a face, arms crossed firmly, faint teal force field shimmering around its body
- Moon Boy (Meme): a wide-eyed cartoon frog in a tiny rocket suit, mid-leap upward toward the moon, tongue out in excitement, pink energy trails behind it
`.trim();
