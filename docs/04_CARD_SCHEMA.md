# 04 — Card Schema (Database Model)

One database row per card. The frontend card component reads this object and renders the appropriate card frame, stats, and art.

---

## Full Card Object (TypeScript type)

```typescript
interface Card {
  // Identity
  id: string;                    // Unique card ID, e.g. "bitcoin_diamond_hands"
  name: string;                  // Display name, e.g. "Diamond Hands"
  set: string;                   // Card set/expansion, e.g. "genesis"

  // Classification
  type: CardType;                // "minion" | "spell" | "weapon" | "hero" | "location"
  faction: Faction;              // "bitcoin" | "ethereum" | "solana" | "meme" | "stable" | "degen"
  rarity: Rarity;                // "common" | "rare" | "epic" | "legendary"
  tribe?: string;                // Optional tribe tag, e.g. "Token" | "Degen" | "Gear" | "Protocol"

  // Stats (only relevant fields populated per type)
  cost: number;                  // Gas cost to play (0–10)
  attack?: number;               // Minion, Weapon only
  health?: number;               // Minion, Hero only
  durability?: number;           // Weapon, Location only
  armor?: number;                // Hero only

  // Text
  text?: string;                 // Card ability text (display version, with keyword formatting)
  flavor_text?: string;          // Italic lore text shown on zoomed card view
  art_label?: string;            // Text shown in art placeholder (= name if not set)

  // Keywords (machine-readable)
  keywords?: Keyword[];          // Array of keyword objects (see 06_KEYWORDS.md)

  // Effects (structured for game engine)
  effects?: CardEffect[];        // Structured effect list (see Effects section below)

  // Hero Power (Hero type only)
  hero_power?: HeroPower;

  // Visuals (populated from CDN/storage)
  art_url?: string;              // Full art image URL (null = use placeholder)
  card_back?: string;            // Custom card back ID (cosmetic)
  is_animated?: boolean;         // Legendary foil/animation variant
  nft_token_id?: string;         // If this is an NFT variant

  // Meta
  collectible: boolean;          // False = token/generated cards (e.g. 1/1 Token)
  craftable: boolean;            // Can be crafted/dusted in collection
  dust_value: number;            // $DEGEN fragments received when dusted
  craft_cost: number;            // $DEGEN fragments to craft
  created_at: string;            // ISO timestamp
}

type CardType = "minion" | "spell" | "weapon" | "hero" | "location";
type Faction = "bitcoin" | "ethereum" | "solana" | "meme" | "stable" | "degen";
type Rarity = "common" | "rare" | "epic" | "legendary";
type Keyword = {
  id: string;           // Internal keyword ID, e.g. "taunt", "charge"
  display: string;      // Display name, e.g. "HODL", "Ape In"
  params?: object;      // Optional params, e.g. { "n": 2 } for "Echo n times"
};
```

---

## Hero Power Type

```typescript
interface HeroPower {
  id: string;
  name: string;
  cost: number;                   // Default 2
  description: string;
  effect_type: string;            // e.g. "add_to_hand" | "deal_damage" | "summon_minion"
  effect_params: object;          // Type-specific params
  art_url?: string;
}
```

---

## Card Effects (Structured)

Effects are the machine-readable version of card text. The game engine reads `effects[]` to execute card behavior.

```typescript
interface CardEffect {
  trigger: EffectTrigger;         // When this fires
  target: EffectTarget;           // What it targets
  action: EffectAction;           // What it does
  condition?: EffectCondition;    // Optional condition to check first
  params?: object;                // Action-specific parameters
}

type EffectTrigger =
  | "on_play"           // Battlecry / Pump — fires when card is played
  | "on_death"          // Deathrattle / Rekt — fires when this minion dies
  | "on_attack"         // Fires when this minion/hero attacks
  | "on_take_damage"    // Fires when this minion/hero takes damage
  | "start_of_turn"     // Fires at start of owner's turn
  | "end_of_turn"       // Fires at end of owner's turn
  | "on_secret_trigger" // Smart Contract — fires when secret condition is met
  | "passive"           // Always-on aura effect
  | "on_tap"            // Location activation
  | "on_equip";         // When weapon is equipped

type EffectTarget =
  | "self"
  | "hero_friendly"
  | "hero_enemy"
  | "any_hero"
  | "minion_friendly"
  | "minion_enemy"
  | "any_minion"
  | "all_minions_friendly"
  | "all_minions_enemy"
  | "all_minions"
  | "chosen_minion"       // Player selects target
  | "random_minion_enemy"
  | "random_minion_friendly"
  | "chosen_any"
  | "all_characters";     // All minions + both heroes

type EffectAction =
  | "deal_damage"
  | "heal"
  | "buff_attack"
  | "buff_health"
  | "buff_attack_health"
  | "destroy"
  | "silence"             // Remove all keywords and text from target
  | "draw_cards"
  | "add_to_hand"
  | "summon_minion"
  | "give_keyword"
  | "give_divine_shield"
  | "transform"
  | "modify_cost"
  | "give_armor"
  | "return_to_hand"
  | "shuffle_into_deck"
  | "copy_to_hand";
```

---

## Example Card Records

### Minion (Legendary)
```json
{
  "id": "bitcoin_diamond_hands",
  "name": "Diamond Hands",
  "set": "genesis",
  "type": "minion",
  "faction": "bitcoin",
  "rarity": "legendary",
  "tribe": "Token",
  "cost": 6,
  "attack": 4,
  "health": 9,
  "text": "HODL. Cannot be destroyed by Rug Pull effects.",
  "flavor_text": "\"I am not leaving.\" — posted from a phone with 2% battery",
  "art_label": "Diamond Hands",
  "keywords": [
    { "id": "taunt", "display": "HODL" }
  ],
  "effects": [
    {
      "trigger": "passive",
      "target": "self",
      "action": "give_keyword",
      "params": { "keyword": "taunt" }
    },
    {
      "trigger": "passive",
      "target": "self",
      "action": "immune_to",
      "params": { "effect_tag": "destroy" }
    }
  ],
  "collectible": true,
  "craftable": true,
  "dust_value": 400,
  "craft_cost": 1600
}
```

### Spell (Epic)
```json
{
  "id": "degen_rug_pull",
  "name": "Rug Pull",
  "set": "genesis",
  "type": "spell",
  "faction": "degen",
  "rarity": "epic",
  "tribe": "Spell",
  "cost": 2,
  "text": "Destroy a friendly minion. Draw 2 cards.",
  "flavor_text": "\"It was always an exit strategy.\"",
  "keywords": [],
  "effects": [
    {
      "trigger": "on_play",
      "target": "minion_friendly",
      "action": "destroy",
      "params": { "target_selection": "chosen_minion" }
    },
    {
      "trigger": "on_play",
      "target": "hero_friendly",
      "action": "draw_cards",
      "params": { "count": 2 }
    }
  ],
  "collectible": true,
  "craftable": true,
  "dust_value": 100,
  "craft_cost": 400
}
```

### Weapon (Legendary)
```json
{
  "id": "bitcoin_hardware_ledger",
  "name": "Hardware Ledger",
  "set": "genesis",
  "type": "weapon",
  "faction": "bitcoin",
  "rarity": "legendary",
  "tribe": "Gear",
  "cost": 4,
  "attack": 4,
  "durability": 2,
  "text": "Rekt: Return a destroyed Secret to your hand.",
  "keywords": [
    { "id": "deathrattle", "display": "Rekt" }
  ],
  "effects": [
    {
      "trigger": "on_death",
      "target": "hero_friendly",
      "action": "return_to_hand",
      "params": { "filter": "type:spell,keyword:secret", "from": "burn_pile", "count": 1 }
    }
  ],
  "collectible": true,
  "craftable": true,
  "dust_value": 400,
  "craft_cost": 1600
}
```

### Location (Epic)
```json
{
  "id": "ethereum_the_exchange",
  "name": "The Exchange",
  "set": "genesis",
  "type": "location",
  "faction": "ethereum",
  "rarity": "epic",
  "tribe": "Protocol",
  "cost": 3,
  "durability": 3,
  "text": "Tap: Draw a card, then a random card in your hand costs (1) more.",
  "keywords": [],
  "effects": [
    {
      "trigger": "on_tap",
      "target": "hero_friendly",
      "action": "draw_cards",
      "params": { "count": 1 }
    },
    {
      "trigger": "on_tap",
      "target": "random_card_in_hand_friendly",
      "action": "modify_cost",
      "params": { "amount": 1 }
    }
  ],
  "collectible": true,
  "craftable": true,
  "dust_value": 100,
  "craft_cost": 400
}
```

---

## Dust / Craft Costs by Rarity

| Rarity | Dust value | Craft cost |
|---|---|---|
| Common | 5 | 40 |
| Rare | 20 | 100 |
| Epic | 100 | 400 |
| Legendary | 400 | 1600 |

*(Costs are in `$DEGEN` fragments — 1,000 fragments = 1 `$DEGEN`)*

---

## Generated / Token Cards (Non-Collectible)

Some card effects create token cards that are not in any player's deck. These are stored in the card database with `collectible: false` and `craftable: false`.

```json
{
  "id": "token_1_1",
  "name": "Token",
  "set": "tokens",
  "type": "minion",
  "faction": "bitcoin",
  "rarity": "common",
  "tribe": "Token",
  "cost": 0,
  "attack": 1,
  "health": 1,
  "text": "",
  "collectible": false,
  "craftable": false,
  "dust_value": 0,
  "craft_cost": 0
}
```
