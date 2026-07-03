/** Cosmetic frame tier earned by upgrading duplicate copies. */
export type CardFrameTier = "default" | "silver" | "gold";

export const FRAME_UPGRADE_COST = {
  silverFromDefault: 50,
  goldFromDefault: 100,
  goldFromSilver: 2,
} as const;

export function bestCardFrameTier(silver: number, gold: number): CardFrameTier {
  if (gold > 0) return "gold";
  if (silver > 0) return "silver";
  return "default";
}

/** Default-tier copies that must stay to satisfy deck lists once upgraded copies are counted. */
export function reservedDefaultCopies(deckCopies: number, silver: number, gold: number): number {
  return Math.max(0, deckCopies - silver - gold);
}

/** Silver copies that must stay to satisfy deck lists once gold/default copies are counted. */
export function reservedSilverCopies(deckCopies: number, gold: number, defaultQty: number): number {
  return Math.max(0, deckCopies - gold - defaultQty);
}

export function availableDefaultForUpgrade(
  defaultQty: number,
  deckCopies: number,
  silver: number,
  gold: number
): number {
  return defaultQty - reservedDefaultCopies(deckCopies, silver, gold);
}

export function availableSilverForUpgrade(
  silverQty: number,
  deckCopies: number,
  gold: number,
  defaultQty: number
): number {
  return silverQty - reservedSilverCopies(deckCopies, gold, defaultQty);
}

export function canUpgradeToSilver(
  defaultQty: number,
  deckCopies: number,
  silver: number,
  gold: number
): boolean {
  return availableDefaultForUpgrade(defaultQty, deckCopies, silver, gold) >= FRAME_UPGRADE_COST.silverFromDefault;
}

export function canUpgradeToGoldFromDefault(
  defaultQty: number,
  deckCopies: number,
  silver: number,
  gold: number
): boolean {
  return availableDefaultForUpgrade(defaultQty, deckCopies, silver, gold) >= FRAME_UPGRADE_COST.goldFromDefault;
}

export function canUpgradeToGoldFromSilver(
  silverQty: number,
  deckCopies: number,
  gold: number,
  defaultQty: number
): boolean {
  return availableSilverForUpgrade(silverQty, deckCopies, gold, defaultQty) >= FRAME_UPGRADE_COST.goldFromSilver;
}
