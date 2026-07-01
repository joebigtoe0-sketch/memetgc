# 02 — Core Loop

## Game Setup

- Both players choose a **Hero** before the game (not counted in the 30-card deck).
- Player 1 draws **3 cards** to start.
- Player 2 draws **4 cards** + receives a free **Coin** token card (0-cost spell: gain 1 Gas this turn only). This compensates for going second.
- Both players perform a **Mulligan** (see `07_DECK_RULES.md`).
- Both players start with **0 Gas crystals** (gain 1 per turn).

---

## Win Condition

Reduce the enemy Hero's HP to **0 or below**. Heroes start at **30 HP**.

---

## Turn Structure

Each turn proceeds through 4 phases in order:

### Phase 1 — Pump Phase *(start of turn)*
- Gain **1 permanent Gas crystal** (maximum 10).
- All spent Gas crystals are **refilled**.
- "At the start of your turn" effects trigger.
- Summoning Sickness wears off for minions that survived from a previous turn.

> **Internal name:** `turn_start`
> **Display name:** "Pump phase"

### Phase 2 — Draw Phase
- Draw **1 card** from your deck (Memepool).
- If your deck is **empty**, suffer Fatigue damage instead.
  - Fatigue damage increases each turn: 1, 2, 3, 4… (cumulative counter per player)
  - This damage goes directly to the Hero and cannot be prevented.

> **Internal name:** `draw_phase`
> **Display name:** "Pulling from the memepool"
> **Fatigue counter:** `player.fatigue_counter` — increment by 1 each time, deal that value as damage

### Phase 3 — Main Phase
- Player may take any of the following actions in any order, any number of times (subject to resources):
  - **Play a card** from hand (pay its Gas cost)
  - **Attack** with an eligible minion (minions that survived a prior turn, or have Charge)
  - **Use Hero Power** (once per turn, costs 2 Gas by default unless modified)
  - **Use a Location** (tap it: spend 1 Durability to activate its effect, once per turn)
- No mandatory ordering. Player decides when to stop and end turn.

### Phase 4 — End Phase
- "At the end of your turn" effects trigger in play order (left to right on board).
- If hand size exceeds **10 cards**, discard down to 10 (player chooses which to discard — this should be rare by design).
- Turn passes to opponent.

---

## Gas (Mana) System

| Property | Value |
|---|---|
| Starting Gas | 0 |
| Gas gained per turn | +1 permanent crystal |
| Maximum Gas crystals | 10 |
| Unspent Gas | Does NOT carry over |
| Temporary Gas | Some effects give temporary Gas (e.g. Coin) — spent first, doesn't add permanent crystals |

### Gas Overload *(optional mechanic for future expansion)*
Some cards may have `overload: N` — after playing them, N Gas crystals are locked next turn (shown as locked/unavailable). This is a power-level tradeoff.

### Gas Spike *(Ethereum faction mechanic)*
Some Ethereum cards increase the opponent's spell costs by (1) for a turn. Tracked as `opponent.gas_spike_modifier` — applied when opponent tries to play a spell, reset at end of Ethereum player's next turn.

---

## Combat

### Attacking with Minions
- A minion may attack **once per turn** (tracked via `minion.has_attacked = true`, reset at start of owner's turn).
- Minions cannot attack the turn they are played unless they have the **Charge** keyword (`ape_in`).
- When a minion attacks another minion, **both deal their attack value to each other simultaneously**.
- When a minion attacks a Hero directly, only the Hero takes damage (the minion does not).
- If any enemy minion has **Taunt** (`hodl`), the attacker MUST target a Taunt minion. (All Taunt minions are valid targets; player chooses which.)

### Damage Resolution
1. Check for Divine Shield (`moon_shot`) — if present, absorb the damage instance and remove the shield.
2. Apply remaining damage to HP.
3. If HP ≤ 0, the minion **dies** (trigger Deathrattle if present, then move to burn pile).
4. If the Hero HP ≤ 0, that player **loses** immediately.

### Hero Attacking (Weapons)
- When a Hero has a Weapon equipped, they gain the weapon's ATK value.
- The Hero may attack once per turn (same Summoning Sickness rules do NOT apply to Heroes — they can attack the turn the weapon is equipped).
- Each Hero attack reduces the weapon's Durability by 1.
- At Durability 0, the weapon breaks and is moved to the burn pile.
- The Hero takes no damage when attacking a minion (unlike minion-vs-minion). Exception: some minions have a "Venomous" or "Spike" mechanic that deals damage back — reserved for future keywords.

### Armor
- Armor absorbs damage before HP.
- Armor does not regenerate between turns.
- Armor can exceed 30 (no cap).
- Example: Hero has 25 HP, 5 Armor. Takes 8 damage → Armor drops to 0 (absorbs 5), HP drops to 22.

---

## Targeting Rules

| Card type | Valid targets |
|---|---|
| Minion attack | Enemy minions (Taunt first if any), enemy Hero |
| Spell — targeted | As specified on card (friendly minion, any minion, any character, etc.) |
| Spell — untargeted (AoE) | Fires automatically, no target selection |
| Weapon | No target at play time; target chosen when Hero attacks |
| Location | No target at play time; activated during Main Phase |

---

## Board Limits

| Zone | Limit |
|---|---|
| Minions per side | 7 |
| Locations per side | 1 |
| Weapons equipped | 1 (new weapon destroys old one) |
| Hand size | 10 (excess discarded at end of turn) |
| Deck size | 30 |

---

## Death and the Burn Pile (Graveyard)

- Dead minions, used spells, and broken weapons go to the **burn pile** (graveyard).
- Cards in the burn pile are public information (both players can inspect it).
- Certain Deathrattle (`rekt`) effects may interact with the burn pile.
- No card can be "returned from the burn pile" unless an explicit card effect states so.

---

## Simultaneous Death
If multiple minions would die in the same damage step (e.g. AoE spell), all deaths are processed simultaneously. Deathrattles trigger in play order (left to right) after all deaths are confirmed.
