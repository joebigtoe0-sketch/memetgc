export interface CardForArt {
  id: string;
  name: string;
  type: string;
  faction: string;
  rarity: string;
  text?: string | null;
  artBrief?: string | null;
}

export const FACTION_PALETTES: Record<string, { primary: string; secondary: string; accent: string; mood: string }> = {
  bitcoin: { primary: "burnt orange", secondary: "dark charcoal", accent: "warm gold", mood: "rugged, weathered, industrial, vault-like" },
  ethereum: { primary: "electric indigo-blue", secondary: "deep violet", accent: "bright cyan", mood: "geometric, glowing circuitry, crystalline" },
  solana: { primary: "emerald green", secondary: "dark teal", accent: "neon lime", mood: "kinetic, motion blur energy, fast" },
  meme: { primary: "hot pink", secondary: "bright yellow", accent: "white", mood: "playful, cartoonish, exaggerated, comedic" },
  stable: { primary: "seafoam teal", secondary: "cool gray", accent: "mint white", mood: "clean, sterile, corporate, minimal" },
  degen: { primary: "slate gray", secondary: "black", accent: "blood red", mood: "chaotic, reckless, frayed edges, gritty" },
};

const CROP_HINT =
  "subject large and readable when cropped to a short wide card art window, face or focal object in upper-center third of frame";

const MINION_POSE: Record<string, string> = {
  common: "slightly exaggerated cartoon proportions, oversized expressive eyes, comedic dynamic pose, playful energy",
  rare: "slightly exaggerated cartoon proportions, oversized expressive eyes, comedic dynamic pose, playful energy",
  epic: "confident heroic pose, dynamic action, subtle humor in expression or props, more grounded proportions than common cards",
  legendary: "epic iconic pose, dramatic atmosphere, legendary character presence, slightly more realistic proportions",
};

function getPose(card: CardForArt): string {
  if (card.type === "weapon") {
    return "dramatic product-shot angle, object feels powerful and iconic, no human faces";
  }
  if (card.type === "location") {
    return "grand establishing atmosphere, architectural presence, no character focus";
  }
  if (card.type === "spell") {
    return "frozen instant of magical impact, energy burst mid-action, dramatic motion lines";
  }
  if (card.type === "hero") {
    return MINION_POSE[card.rarity] ?? MINION_POSE.legendary!;
  }
  return MINION_POSE[card.rarity] ?? MINION_POSE.common!;
}

function getComposition(card: CardForArt): string {
  switch (card.type) {
    case "minion":
      if (card.rarity === "legendary" || card.rarity === "epic") {
        return `dynamic three-quarter body action pose, ${CROP_HINT}`;
      }
      return `chest-up to three-quarter body, ${CROP_HINT}`;
    case "hero":
      return `chest-up portrait, ${CROP_HINT}`;
    case "weapon":
      return `weapon or gear object as sole subject, angled diagonally across frame, no characters, ${CROP_HINT}`;
    case "location":
      return `wide environmental shot, location structure as subject, ${CROP_HINT}`;
    case "spell":
      return `spell effect erupting from center of frame, ${CROP_HINT}`;
    default:
      return `centered subject, ${CROP_HINT}`;
  }
}

function getLegendaryGlow(card: CardForArt, palette: { accent: string }): string {
  if (card.rarity !== "legendary") return "";
  return `, with a ${palette.accent} energy glow effect emanating from the subject`;
}

/** Strip leading articles and trailing periods so "A foo bar." doesn't double up in the prompt. */
export function normalizeSubject(description: string): string {
  let s = description.trim();
  if (s.endsWith(".")) s = s.slice(0, -1);
  if (/^(a|an|the)\s+/i.test(s)) s = s.replace(/^(a|an|the)\s+/i, "");
  return s;
}

export function buildCardPrompt(card: CardForArt, subjectDescription: string): string {
  const palette = FACTION_PALETTES[card.faction] ?? FACTION_PALETTES.degen!;
  const subject = normalizeSubject(subjectDescription);
  const pose = getPose(card);
  const composition = getComposition(card);
  const glow = getLegendaryGlow(card, palette);

  return `
A ${card.rarity}-tier digital painting of ${subject}.

Pose: ${pose}.

Style: semi-realistic painted illustration, cel-shaded lighting with exactly 3 flat tonal zones (highlight, midtone, shadow) on every surface, no smooth gradients, no soft airbrushed blending. Clean bold dark outline around all silhouettes, slightly thinner linework on internal details.

Lighting: single dramatic rim light from upper-left at 45 degrees, warm key light, cool ambient fill, strong cast shadow.

Palette: ${palette.primary}, ${palette.secondary}, and ${palette.accent} as the dominant colors. Mood: ${palette.mood}${glow}.

Composition: subject centered in frame, ${composition}, simplified atmospheric background with soft blur, no busy detail behind subject.

Trading card game illustration, painted comic book style. NOT photorealistic, NOT 3D render, NOT photograph, NOT anime.
`.trim();
}
