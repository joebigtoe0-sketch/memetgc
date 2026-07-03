/**
 * Card back cosmetics registry — the single source of truth shared by the web
 * client and server. `equippedCardBack` on the user stores the `id` below
 * (null / "default" both mean the default back).
 */

export type CardBackGate =
  | { type: "default" }
  /** Unlocked by holding at least `min` of an SPL token in the linked wallet. */
  | { type: "token"; mint: string; min: number; symbol: string }
  /** Unlocked by owning a `card_back` UserCosmetic with this id (e.g. season rewards). */
  | { type: "cosmetic" };

export interface CardBackDef {
  id: string;
  name: string;
  /** Public path to the card back art (served from apps/web/public). */
  image: string;
  description: string;
  gate: CardBackGate;
}

export const DEFAULT_CARD_BACK_ID = "default";

export const CARD_BACKS: CardBackDef[] = [
  {
    id: "default",
    name: "Default",
    image: "/card-backs/cardback_default.png",
    description: "Default card back — available to everyone.",
    gate: { type: "default" },
  },
  {
    id: "cardback_genesisdrop",
    name: "Genesis Drop",
    image: "/card-backs/cardback_genesisdrop.png",
    description: "Hold at least 100 $ANSEM in your wallet to unlock.",
    gate: {
      type: "token",
      mint: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
      min: 100,
      symbol: "$ANSEM",
    },
  },
];

export function getCardBackDef(id?: string | null): CardBackDef {
  if (!id) return CARD_BACKS[0]!;
  return CARD_BACKS.find((c) => c.id === id) ?? CARD_BACKS[0]!;
}
