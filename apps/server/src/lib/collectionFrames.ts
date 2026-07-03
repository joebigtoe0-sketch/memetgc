import { prisma } from "@memetgc/db";
import type { Prisma } from "@memetgc/db";
import type { CardFrameTier } from "@memetgc/types";
import {
  bestCardFrameTier,
  canUpgradeToGoldFromDefault,
  canUpgradeToGoldFromSilver,
  canUpgradeToSilver,
  FRAME_UPGRADE_COST,
} from "@memetgc/types";

type Tx = Prisma.TransactionClient;

export interface CardOwnership {
  defaultQuantity: number;
  silverQuantity: number;
  goldQuantity: number;
  totalQuantity: number;
  displayFrameTier: CardFrameTier;
}

export function emptyOwnership(): CardOwnership {
  return {
    defaultQuantity: 0,
    silverQuantity: 0,
    goldQuantity: 0,
    totalQuantity: 0,
    displayFrameTier: "default",
  };
}

export function aggregateOwnership(
  rows: { cardId: string; quantity: number; frameTier: string }[]
): Map<string, CardOwnership> {
  const map = new Map<string, CardOwnership>();
  for (const row of rows) {
    const current = map.get(row.cardId) ?? emptyOwnership();
    const tier = row.frameTier as CardFrameTier;
    if (tier === "silver") current.silverQuantity += row.quantity;
    else if (tier === "gold") current.goldQuantity += row.quantity;
    else current.defaultQuantity += row.quantity;
    current.totalQuantity += row.quantity;
    current.displayFrameTier = bestCardFrameTier(current.silverQuantity, current.goldQuantity);
    map.set(row.cardId, current);
  }
  return map;
}

export async function deckCopiesForCard(userId: string, cardId: string): Promise<number> {
  const agg = await prisma.deckCard.aggregate({
    where: { cardId, deck: { userId } },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

export async function adjustCollectionQuantity(
  tx: Tx,
  userId: string,
  cardId: string,
  frameTier: CardFrameTier,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  const key = { userId_cardId_frameTier: { userId, cardId, frameTier } };
  if (delta > 0) {
    await tx.collectionEntry.upsert({
      where: key,
      update: { quantity: { increment: delta } },
      create: { userId, cardId, frameTier, quantity: delta },
    });
    return;
  }
  const entry = await tx.collectionEntry.findUnique({ where: key });
  if (!entry || entry.quantity < -delta) throw new Error("INSUFFICIENT");
  const next = entry.quantity + delta;
  if (next <= 0) {
    await tx.collectionEntry.delete({ where: key });
  } else {
    await tx.collectionEntry.update({ where: key, data: { quantity: next } });
  }
}

export type UpgradePath = "silver" | "gold_default" | "gold_silver";

export function resolveUpgradePath(
  path: UpgradePath,
  ownership: CardOwnership,
  deckCopies: number
): { ok: true; cost: number; fromTier: CardFrameTier; toTier: CardFrameTier } | { ok: false; error: string } {
  if (path === "silver") {
    if (!canUpgradeToSilver(ownership.defaultQuantity, deckCopies, ownership.silverQuantity, ownership.goldQuantity)) {
      return { ok: false, error: `Need ${FRAME_UPGRADE_COST.silverFromDefault} spare copies (not in decks)` };
    }
    return { ok: true, cost: FRAME_UPGRADE_COST.silverFromDefault, fromTier: "default", toTier: "silver" };
  }
  if (path === "gold_default") {
    if (!canUpgradeToGoldFromDefault(ownership.defaultQuantity, deckCopies, ownership.silverQuantity, ownership.goldQuantity)) {
      return { ok: false, error: `Need ${FRAME_UPGRADE_COST.goldFromDefault} spare copies (not in decks)` };
    }
    return { ok: true, cost: FRAME_UPGRADE_COST.goldFromDefault, fromTier: "default", toTier: "gold" };
  }
  if (!canUpgradeToGoldFromSilver(ownership.silverQuantity, deckCopies, ownership.goldQuantity, ownership.defaultQuantity)) {
    return { ok: false, error: `Need ${FRAME_UPGRADE_COST.goldFromSilver} silver copies to fuse into gold` };
  }
  return { ok: true, cost: FRAME_UPGRADE_COST.goldFromSilver, fromTier: "silver", toTier: "gold" };
}
