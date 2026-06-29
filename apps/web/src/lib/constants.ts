export const FACTION_COLORS: Record<string, { base: string; glow: string; bg: string }> = {
  bitcoin:  { base: "#f7931a", glow: "rgba(247,147,26,0.6)", bg: "rgba(247,147,26,0.1)" },
  ethereum: { base: "#7b8cf4", glow: "rgba(123,140,244,0.6)", bg: "rgba(123,140,244,0.1)" },
  solana:   { base: "#19e08a", glow: "rgba(25,224,138,0.6)", bg: "rgba(25,224,138,0.1)" },
  meme:     { base: "#ff5fae", glow: "rgba(255,95,174,0.6)", bg: "rgba(255,95,174,0.1)" },
  stable:   { base: "#2bbd86", glow: "rgba(43,189,134,0.6)", bg: "rgba(43,189,134,0.1)" },
  degen:    { base: "#9aa3b2", glow: "rgba(154,163,178,0.6)", bg: "rgba(154,163,178,0.1)" },
};

export const RARITY_STYLE: Record<string, { gem1: string; gem2: string; glow: string; label: string }> = {
  common:    { gem1: "#dfe6f0", gem2: "#8d95a3", glow: "transparent", label: "Common" },
  rare:      { gem1: "#7cc4ff", gem2: "#2b6fd0", glow: "transparent", label: "Rare" },
  epic:      { gem1: "#d29bff", gem2: "#8a32d8", glow: "rgba(170,90,230,.45)", label: "Epic" },
  legendary: { gem1: "#ffe07a", gem2: "#e0890f", glow: "rgba(255,190,70,.6)", label: "Legendary" },
};

export const STAT_COLORS = {
  attack:     ["#ffd877", "#d97a16"] as const,
  health:     ["#ff8f7e", "#c2271c"] as const,
  durability: ["#dfe5ec", "#7e8a99"] as const,
  armor:      ["#7df0c0", "#1f9c6e"] as const,
};

export const KEYWORD_BADGE_COLORS: Record<string, string> = {
  taunt:          "#e7c768",
  charge:         "#19e08a",
  divine_shield:  "#f0f4ff",
  lifesteal:      "#2bbd86",
  echo:           "#ff5a5a",
  secret:         "#9b6dff",
  delayed_effect: "#ffb347",
  battlecry:      "#f7931a",
  deathrattle:    "#c0392b",
  volatility:     "#ff5fae",
};

export const KEYWORD_DISPLAY_ORDER = [
  "taunt", "charge", "divine_shield", "lifesteal", "echo",
  "secret", "delayed_effect", "battlecry", "deathrattle",
];

export const RANK_TIERS = ["bronze", "silver", "gold", "platinum", "diamond", "degen"] as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
