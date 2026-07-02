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

// Certain heroes have their own portrait art that overrides the faction icon
// (e.g. after playing the Satoshi or Ansem hero cards). Matched by heroId substring.
const HERO_PORTRAITS: { match: string; file: string }[] = [
  { match: "satoshi", file: "satoshi" },
  { match: "ansem", file: "ansem" },
];

/** Portrait for a hero: a special hero portrait if one exists, else the faction icon. */
export function heroPortraitUrl(heroId: string | undefined, faction: string): string {
  if (heroId) {
    const id = heroId.toLowerCase();
    const special = HERO_PORTRAITS.find((h) => id.includes(h.match));
    if (special) return `/factions/${special.file}.png`;
  }
  return factionImageUrl(faction);
}

export function factionColor(faction: string): string {
  return FAC[faction as FactionId] ?? FAC.degen;
}

export function factionDisplayName(faction: string): string {
  return FACTION_NAME[faction as FactionId] ?? faction.toUpperCase();
}
