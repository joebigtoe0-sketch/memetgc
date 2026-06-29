# 10 — Hero & Hero Power

## Overview

Every game, each player selects a **Hero** from their roster before the match. The Hero determines starting HP, and crucially, the **Hero Power** — a once-per-turn ability costing 2 Gas.

Heroes are NOT part of the 30-card deck. They are selected in the pre-game lobby.

---

## Hero Object (Data Model)

```typescript
interface Hero {
  id: string;                    // e.g. "hero_satoshi"
  name: string;                  // Display name
  faction: Faction;
  hp: number;                    // Always 30 for starting heroes
  armor: number;                 // Starting armor (usually 0)
  hero_power: HeroPower;
  art_url?: string;
  unlock_method: "default" | "booster_pack" | "season_reward" | "purchase";
  collectible: boolean;
  description: string;           // Flavor bio
}

interface HeroPower {
  id: string;
  name: string;
  cost: number;                  // Default 2
  description: string;           // Display text
  effect_type: string;
  effect_params: object;
  art_url?: string;
}
```

---

## Starting Hero Roster (All Players Unlock)

### Satoshi — Bitcoin

```json
{
  "id": "hero_satoshi",
  "name": "Satoshi",
  "faction": "bitcoin",
  "hp": 30,
  "armor": 0,
  "hero_power": {
    "id": "hp_mint",
    "name": "Mint",
    "cost": 2,
    "description": "Add a 1/1 Token to your hand.",
    "effect_type": "add_to_hand",
    "effect_params": { "card_id": "token_1_1" }
  },
  "unlock_method": "default",
  "description": "The original degen. Nobody knows who he is, which is exactly the point."
}
```

---

### Vitalik — Ethereum

```json
{
  "id": "hero_vitalik",
  "name": "Vitalik",
  "faction": "ethereum",
  "hp": 30,
  "armor": 0,
  "hero_power": {
    "id": "hp_gas_war",
    "name": "Gas War",
    "cost": 2,
    "description": "The next spell you play this turn costs (1) less.",
    "effect_type": "modify_cost",
    "effect_params": { "target": "next_spell_this_turn", "amount": -1 }
  },
  "unlock_method": "default",
  "description": "Invented the smart contract. Now your opponent is stuck paying extra gas."
}
```

---

### Toly — Solana

```json
{
  "id": "hero_toly",
  "name": "Toly",
  "faction": "solana",
  "hp": 30,
  "armor": 0,
  "hero_power": {
    "id": "hp_turbo",
    "name": "Turbo",
    "cost": 2,
    "description": "Give a friendly minion +2 Attack this turn.",
    "effect_type": "buff_attack",
    "effect_params": { "target": "chosen_minion_friendly", "amount": 2, "duration": "this_turn" }
  },
  "unlock_method": "default",
  "description": "400,000 transactions per second. Except when it's 0."
}
```

---

### Elon — Meme

```json
{
  "id": "hero_elon",
  "name": "Elon",
  "faction": "meme",
  "hp": 30,
  "armor": 0,
  "hero_power": {
    "id": "hp_tweet",
    "name": "Tweet",
    "cost": 2,
    "description": "Add a random Meme spell to your hand.",
    "effect_type": "add_to_hand_random",
    "effect_params": { "filter": "type:spell,faction:meme" }
  },
  "unlock_method": "default",
  "description": "One tweet moves markets. His deck is basically his Twitter feed."
}
```

---

### Circle CEO — Stable

```json
{
  "id": "hero_circle_ceo",
  "name": "Circle CEO",
  "faction": "stable",
  "hp": 30,
  "armor": 0,
  "hero_power": {
    "id": "hp_yield",
    "name": "Yield",
    "cost": 2,
    "description": "Restore 2 HP to your Hero.",
    "effect_type": "heal",
    "effect_params": { "target": "hero_friendly", "amount": 2 }
  },
  "unlock_method": "default",
  "description": "Steady, stable, and incredibly boring to play against."
}
```

---

### Anon — Degen

```json
{
  "id": "hero_anon",
  "name": "Anon",
  "faction": "degen",
  "hp": 30,
  "armor": 0,
  "hero_power": {
    "id": "hp_ape",
    "name": "Ape",
    "cost": 2,
    "description": "Deal 2 damage to your own Hero. Draw a card.",
    "effect_type": "multi",
    "effect_params": {
      "actions": [
        { "type": "deal_damage", "target": "hero_friendly", "amount": 2 },
        { "type": "draw_cards", "target": "hero_friendly", "amount": 1 }
      ]
    }
  },
  "unlock_method": "default",
  "description": "Zero Twitter followers. Probably knows something you don't."
}
```

---

## Hero Card (Mid-Game Hero Replacement)

The Hero **card** is a 5th card type (see `03_CARD_TYPES.md`). When played, it replaces your current Hero Power with a new one.

### Example: Satoshi (Hero Card)

This is the *card* version of Satoshi — distinct from the starting Hero above. Playing this card mid-game gives you a new, more powerful Hero Power.

```json
{
  "id": "card_hero_satoshi",
  "name": "Satoshi",
  "type": "hero",
  "faction": "bitcoin",
  "rarity": "legendary",
  "cost": 8,
  "health": 30,
  "armor": 5,
  "text": "Hero Power — Mint: Add a 1/1 Token to your hand.",
  "hero_power": {
    "id": "hp_satoshi_upgraded",
    "name": "Mint (Upgraded)",
    "cost": 2,
    "description": "Add two 1/1 Tokens to your hand.",
    "effect_type": "add_to_hand",
    "effect_params": { "card_id": "token_1_1", "count": 2 }
  },
  "collectible": true,
  "craftable": true,
  "dust_value": 400,
  "craft_cost": 1600
}
```

Note: The Hero card version of a faction leader always has a **stronger** Hero Power than the starting Hero version.

---

## Armor System

- Armor absorbs damage before HP.
- Formula: `damage_to_hp = Math.max(0, damage - armor); new_armor = Math.max(0, armor - damage)`
- Armor does not regenerate between turns unless a card effect grants it.
- Armor has no maximum cap.
- Armor is displayed as a blue shield value overlaid on the Hero portrait.

### Armor gain events
- Hero card play (e.g. Satoshi Hero Card: +5 Armor on play)
- Some Bitcoin spells and minions
- Hero Powers of certain unlockable Heroes

---

## Hero Power Rules Summary

- Usable **once per turn** during Main Phase.
- Costs **2 Gas** (unless modified by card effects).
- After use, the Hero Power button grays out until the next turn.
- **Cannot be used if you have 0 Gas** (even if the cost is reduced to 0 by effects — minimum cost is 0, so 0 Gas is required).
- Effects that "refresh your Hero Power" allow a second use that turn.
- The Hero Power is NOT a card — it cannot be countered, discarded, or added to hand (unless a card explicitly says so).
