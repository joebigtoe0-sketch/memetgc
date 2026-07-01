/** Default card back shown when a card is face-down. */
export const CARD_BACK_DEFAULT = "/card-backs/cardback_default.png";

/** Subtle rounding — card art already has its own corners. */
export const CARD_BACK_RADIUS = 4;

export function cardBackUrl(_cardId?: string): string {
  return CARD_BACK_DEFAULT;
}
