/** Collection / board frame tier from upgraded copies owned. */
export type FrameTier = "dark" | "silver" | "gold";

import type { CardFrameTier } from "@memetgc/types";
import { bestCardFrameTier } from "@memetgc/types";

export function frameTierFromOwned(owned?: number): FrameTier {
  // Legacy fallback — quantity-based tiers are deprecated.
  if (owned != null && owned > 100) return "gold";
  if (owned != null && owned > 50) return "silver";
  return "dark";
}

export function frameTierFromCardTier(tier?: CardFrameTier): FrameTier {
  if (tier === "gold") return "gold";
  if (tier === "silver") return "silver";
  return "dark";
}

export function frameTierFromCollection(silver: number, gold: number): FrameTier {
  return frameTierFromCardTier(bestCardFrameTier(silver, gold));
}

/** Compact board-minion border styling per tier. */
export function boardFrameStyle(tier: FrameTier): {
  borderColor: string;
  outerShadow: string;
  statRing: string;
} {
  switch (tier) {
    case "silver":
      return {
        borderColor: "#b8c2d0",
        outerShadow: "0 6px 12px rgba(0,0,0,.55), 0 0 11px rgba(200,210,225,.45)",
        statRing: "#9aa8bc",
      };
    case "gold":
      return {
        borderColor: "#caa24a",
        outerShadow: "0 6px 12px rgba(0,0,0,.55), 0 1px 0 rgba(255,240,190,.3), 0 0 12px rgba(231,199,104,.4)",
        statRing: "#caa24a",
      };
    default:
      return {
        borderColor: "#3d4654",
        outerShadow: "0 6px 12px rgba(0,0,0,.55), 0 1px 0 rgba(255,255,255,.06)",
        statRing: "#5c6678",
      };
  }
}
