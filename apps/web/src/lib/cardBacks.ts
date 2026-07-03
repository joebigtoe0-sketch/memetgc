import { CARD_BACKS, getCardBackDef } from "@memetgc/types";

/** Default card back shown when a card is face-down. */
export const CARD_BACK_DEFAULT = getCardBackDef(null).image;

/** Subtle rounding — card art already has its own corners. */
export const CARD_BACK_RADIUS = 4;

/** Resolve an equipped card back id to its art path (falls back to default). */
export function cardBackImage(id?: string | null): string {
  return getCardBackDef(id).image;
}

export { CARD_BACKS, getCardBackDef };
