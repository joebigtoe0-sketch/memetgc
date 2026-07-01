/** Default card back shown when a card is face-down. */
export const CARD_BACK_DEFAULT = "/card-backs/cardback_default.png";

export function cardBackUrl(_cardId?: string): string {
  return CARD_BACK_DEFAULT;
}
