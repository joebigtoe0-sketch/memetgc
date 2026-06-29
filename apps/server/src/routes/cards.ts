import { Router } from "express";
import { prisma } from "@memetgc/db";
import type { Card, Keyword, CardEffect, HeroPower } from "@memetgc/types";

const router: ReturnType<typeof Router> = Router();

function mapPrismaCard(row: {
  id: string;
  name: string;
  set: string;
  type: string;
  faction: string;
  rarity: string;
  tribe: string | null;
  cost: number;
  attack: number | null;
  health: number | null;
  durability: number | null;
  armor: number | null;
  text: string | null;
  flavorText: string | null;
  artLabel: string | null;
  keywordsJson: unknown;
  effectsJson: unknown;
  heroPowerJson: unknown;
  artUrl: string | null;
  cardBack: string | null;
  isAnimated: boolean;
  nftTokenId: string | null;
  collectible: boolean;
  craftable: boolean;
  dustValue: number;
  craftCost: number;
  createdAt: Date;
}): Card {
  return {
    id: row.id,
    name: row.name,
    set: row.set,
    type: row.type as Card["type"],
    faction: row.faction as Card["faction"],
    rarity: row.rarity as Card["rarity"],
    tribe: row.tribe ?? undefined,
    cost: row.cost,
    attack: row.attack ?? undefined,
    health: row.health ?? undefined,
    durability: row.durability ?? undefined,
    armor: row.armor ?? undefined,
    text: row.text ?? undefined,
    flavor_text: row.flavorText ?? undefined,
    art_label: row.artLabel ?? undefined,
    keywords: (row.keywordsJson as unknown as Keyword[]) ?? [],
    effects: (row.effectsJson as unknown as CardEffect[]) ?? [],
    hero_power: (row.heroPowerJson as unknown as HeroPower) ?? undefined,
    art_url: row.artUrl ?? undefined,
    card_back: row.cardBack ?? undefined,
    is_animated: row.isAnimated,
    nft_token_id: row.nftTokenId ?? undefined,
    collectible: row.collectible,
    craftable: row.craftable,
    dust_value: row.dustValue,
    craft_cost: row.craftCost,
    created_at: row.createdAt.toISOString(),
  };
}

// GET /api/cards — list all collectible cards with filters
router.get("/", async (req, res) => {
  const { faction, type, rarity, set, search, collectible } = req.query;

  const where: Record<string, unknown> = {};
  if (faction) where.faction = String(faction);
  if (type) where.type = String(type);
  if (rarity) where.rarity = String(rarity);
  if (set) where.set = String(set);
  if (collectible !== "false") where.collectible = true;
  if (search) where.name = { contains: String(search), mode: "insensitive" };

  const cards = await prisma.card.findMany({ where, orderBy: [{ cost: "asc" }, { name: "asc" }] });
  res.json(cards.map(mapPrismaCard));
});

// GET /api/cards/:id
router.get("/:id", async (req, res) => {
  const card = await prisma.card.findUnique({ where: { id: req.params.id } });
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json(mapPrismaCard(card));
});

export default router;
