# 03 — Card Types

There are **5 card types** in Degen TCG. The `type` field on every card record determines which rules apply.

---

## 1. Minion
`type: "minion"`

The most common card type. Placed on the board and stays until destroyed.

### Stats
| Stat | Field | Notes |
|---|---|---|
| Cost | `cost` | Gas to play (0–10) |
| Attack | `attack` | Damage dealt when attacking |
| Health | `health` | HP; dies when reaches 0 |

### Rules
- Enters the board with **Summoning Sickness** — cannot attack until the start of the owner's next turn (unless has Charge/`ape_in`).
- Can attack enemy minions or the enemy Hero once per turn.
- Maximum **7 minions per side** on the board.
- Minions can have any number of keywords.
- If a minion's health is reduced to 0 or below, it dies immediately (mid-turn, not end-of-turn).

### Optional sub-stats
- `tribe` — flavor grouping (Token, Degen, Hero, Gear, Protocol, Spell). Used for synergy effects. Example: "Give all Token minions +1/+1."

---

## 2. Spell
`type: "spell"`

One-time effect card. Played from hand, resolves immediately, then moves to the burn pile. Cannot be attacked or targeted while in hand.

### Stats
| Stat | Field | Notes |
|---|---|---|
| Cost | `cost` | Gas to play (0–10) |

### Rules
- No `attack` or `health` values.
- Effect resolves immediately on play.
- Some spells require a **target** to be selected before playing (targeted spells). The game should validate that a valid target exists before allowing the spell to be played.
- Some spells are **untargeted** (AoE or self-effect) and fire automatically.
- Spells cannot be countered in base ruleset (no counterspell mechanic in v1).
- The `tribe` field for spells is always `"Spell"` unless a keyword modifies it.

### Spell sub-types *(v1)*
- **Instant** — Can be played any time (on your turn or, if a Smart Contract/Secret allows, on opponent's turn). `spell_speed: "instant"`
- **Sorcery** — Can only be played on your own turn. `spell_speed: "sorcery"` (default)

---

## 3. Weapon
`type: "weapon"`

Equips to your Hero, giving them Attack. Loses Durability each time the Hero attacks.

### Stats
| Stat | Field | Notes |
|---|---|---|
| Cost | `cost` | Gas to equip (0–10) |
| Attack | `attack` | Added to Hero's ATK |
| Durability | `durability` | Uses remaining; breaks at 0 |

### Rules
- Only **1 weapon can be equipped** at a time. Equipping a new weapon destroys the current one (no Deathrattle triggers on replaced weapons unless explicitly stated).
- The Hero gains the weapon's `attack` value for as long as it's equipped.
- Each Hero attack costs 1 Durability.
- At 0 Durability, weapon breaks and is moved to the burn pile.
- The Hero can attack with a weapon the same turn it is equipped (no Summoning Sickness for Hero attacks).
- Some weapons have keywords (e.g. Lifesteal/`defi` — Hero attacks heal the Hero).

---

## 4. Location
`type: "location"`

A persistent board card with a reusable activated effect. Consumes Durability each use.

### Stats
| Stat | Field | Notes |
|---|---|---|
| Cost | `cost` | Gas to play (0–10) |
| Durability | `durability` | Uses remaining; destroyed at 0 |

### Rules
- Maximum **1 Location per side** at a time. Cannot play a Location if you already have one (must wait for current one to be destroyed).
- Cannot be attacked by minions or weapons directly.
- Activated once per turn during Main Phase (costs 1 Durability per activation).
- At 0 Durability, Location is destroyed and moved to the burn pile.
- Locations do NOT have attack or health values.
- Locations cannot have the Charge, Taunt, or Divine Shield keywords.
- Locations can be destroyed by spells that say "destroy a Location" or "destroy any card."

---

## 5. Hero
`type: "hero"`

Replaces your current Hero mid-game with a new, more powerful one. Grants new Hero Power and bonus stats.

### Stats
| Stat | Field | Notes |
|---|---|---|
| Cost | `cost` | Gas to play (typically 6–9) |
| Health | `health` | New total HP (usually 30; carry over damage from old Hero) |
| Armor | `armor` | Bonus armor granted on play |

### Rules
- Maximum **1 Hero card per deck**.
- Playing a Hero card replaces your current Hero Power with a new one (defined by the Hero card's `hero_power` field).
- HP **carries over** — if your current Hero has 18 HP and you play a Hero card, your new Hero has 18 HP + any armor granted.
- The new Hero Power can be used the same turn the Hero card is played (it is not affected by Summoning Sickness).
- The old Hero card is removed from play (not moved to burn pile — it ceases to exist).
- Weapons equipped to the old Hero carry over to the new Hero.

### Hero Power
Each Hero (starting Hero or Hero card) has a Hero Power:
```json
{
  "hero_power": {
    "name": "Mint",
    "cost": 2,
    "description": "Add a 1/1 Token to your hand.",
    "effect_type": "add_to_hand",
    "effect_params": { "card_id": "token_1_1" }
  }
}
```
- Can be used **once per turn**.
- Costs **2 Gas** by default (can be modified by card effects).
- Resets at the start of each turn.

---

## Card Type Summary Table

| Type | Has ATK | Has HP | Has Durability | On Board | Limit |
|---|---|---|---|---|---|
| Minion | ✅ | ✅ | ❌ | Yes (until dead) | 7 per side |
| Spell | ❌ | ❌ | ❌ | No (instant) | — |
| Weapon | ✅ | ❌ | ✅ | On Hero | 1 equipped |
| Location | ❌ | ❌ | ✅ | Yes (until 0 dur) | 1 per side |
| Hero | ❌ | ✅ | ❌ | Replaces Hero | 1 per deck |
