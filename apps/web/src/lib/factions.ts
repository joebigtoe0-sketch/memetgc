export type FactionId = "bitcoin" | "ethereum" | "solana" | "meme" | "stable" | "degen";

export const FACTIONS: FactionId[] = ["bitcoin", "ethereum", "solana", "meme", "stable", "degen"];

export const FAC: Record<FactionId, string> = {
  bitcoin: "#f7931a",
  ethereum: "#7b8cf4",
  solana: "#19e08a",
  meme: "#ff5fae",
  stable: "#2bbd86",
  degen: "#9aa3b2",
};

export const FACTION_NAME: Record<FactionId, string> = {
  bitcoin: "BITCOIN",
  ethereum: "ETHEREUM",
  solana: "SOLANA",
  meme: "MEME",
  stable: "STABLE",
  degen: "DEGEN",
};

export const FACTION_LABEL: Record<FactionId, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
  meme: "Meme",
  stable: "Stable",
  degen: "Degen",
};

export function factionImageUrl(faction: string): string {
  const id = FACTIONS.includes(faction as FactionId) ? faction : "degen";
  return `/factions/${id}.png`;
}

// Only the playable HERO CARDS (which replace your hero mid-game) get their own
// portrait art. Matched by exact card id — NOT the default starting heroes
// (e.g. "hero_satoshi" keeps the plain Bitcoin faction logo).
const HERO_CARD_PORTRAITS: Record<string, string> = {
  card_hero_satoshi: "satoshi",
  degen_ansem_black_bull: "ansem",
};

/** Portrait for a hero: a played hero-card portrait if one exists, else the faction icon. */
export function heroPortraitUrl(heroId: string | undefined, faction: string): string {
  const special = heroId ? HERO_CARD_PORTRAITS[heroId] : undefined;
  if (special) return `/factions/${special}.png`;
  return factionImageUrl(faction);
}

export function factionColor(faction: string): string {
  return FAC[faction as FactionId] ?? FAC.degen;
}

export function factionDisplayName(faction: string): string {
  return FACTION_NAME[faction as FactionId] ?? faction.toUpperCase();
}
