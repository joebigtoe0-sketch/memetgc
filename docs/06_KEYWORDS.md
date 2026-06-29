# 06 — Keywords

All keywords use a **crypto display name** in the UI and an **internal ID** in code. Both are listed here.

Keywords are stored on cards as an array: `keywords: [{ id, display, params? }]`.

---

## Core Keywords (Launch — v1)

### HODL
- **Internal ID:** `taunt`
- **Display:** `HODL`
- **Description:** Enemies must attack this minion first before attacking other minions or the Hero.
- **Rules:**
  - If multiple minions have HODL, attacker can choose any of them.
  - Spells and non-attack effects are NOT restricted by HODL — only attack actions.
  - If a HODL minion is Silenced, it loses HODL.
- **Visual indicator:** Pulsing gold border on the board minion card.

---

### Ape In
- **Internal ID:** `charge`
- **Display:** `Ape In`
- **Description:** This minion can attack the turn it is played (no Summoning Sickness).
- **Rules:**
  - The minion can attack immediately on the turn it enters the board.
  - It still cannot attack the same target more than once per turn.
  - Ape In does not grant extra attacks.

---

### Pump
- **Internal ID:** `battlecry`
- **Display:** `Pump:`
- **Description:** "When you play this card..." — effect triggers when the card is played from hand.
- **Rules:**
  - Does NOT trigger if the card is summoned by another effect (e.g. a spell that summons a minion — the Pump does not fire).
  - Only triggers when played from hand by the owner.
  - If the Pump requires a target (e.g. "Pump: Deal 2 damage to a minion"), the player must select a valid target before the card is played. If no valid target exists, the card cannot be played.

---

### Rekt
- **Internal ID:** `deathrattle`
- **Display:** `Rekt:`
- **Description:** "When this minion/weapon dies..." — effect triggers on destruction.
- **Rules:**
  - Triggers when health reaches 0, or when destroyed by an effect.
  - Does NOT trigger when Silenced (Silence removes Rekt).
  - Does NOT trigger when a weapon is replaced by another weapon (only when it breaks at 0 Durability or is explicitly destroyed).
  - Multiple Rekt effects on the same minion fire in the order they were gained.
  - Triggers after the minion is removed from the board (the board slot is free).

---

### Moon Shot
- **Internal ID:** `divine_shield`
- **Display:** `Moon Shot`
- **Description:** Absorbs the first instance of damage this minion would take, completely negating it.
- **Rules:**
  - Any amount of damage is fully absorbed (even 1 damage removes the shield).
  - After absorbing one instance, the shield is gone.
  - Does not protect against effects that say "destroy" (not damage-based).
  - Does not protect against Silence.
  - Can be re-applied by card effects.
- **Visual indicator:** Shimmering white outline around the minion.

---

### Fork
- **Internal ID:** `discover`
- **Display:** `Fork:`
- **Description:** Choose one of three randomly offered options (cards, upgrades, or effects) to keep.
- **Rules:**
  - The three options are randomly drawn from the relevant pool.
  - The player keeps one; the other two are discarded/returned to the pool.
  - The chosen card is added to hand (or applied immediately if an upgrade/effect).
  - Pool is defined per card: e.g. "Fork: Choose a Solana minion" draws from all Solana minions.

---

### Airdrop
- **Internal ID:** `discover_free`
- **Display:** `Airdrop:`
- **Description:** Receive a free card from a specific pool, added directly to your hand without choosing.
- **Rules:**
  - One random card from the defined pool is added to your hand automatically.
  - No player choice involved (unlike Fork).
  - The card is a copy — not removed from any deck or pool permanently.

---

### Smart Contract
- **Internal ID:** `secret`
- **Display:** `Smart Contract`
- **Description:** A hidden spell that activates when a specific condition is met during the opponent's turn.
- **Rules:**
  - Played face-down from hand (costs Gas, goes to a Secret zone — not the board).
  - Maximum **5 Secrets** active per player at once.
  - The trigger condition is hidden from the opponent (they see a Secret is active, not what it does).
  - When triggered, the Secret resolves and moves to the burn pile.
  - Only one Secret can trigger per opponent action (even if multiple would qualify).
  - The opponent cannot deliberately trigger a Secret they've already seen resolve this game (UI hint: greyed-out previously-seen secrets).
  - Secrets can be destroyed by effects that say "destroy a Secret."

---

### Vesting
- **Internal ID:** `delayed_effect`
- **Display:** `Vesting:`
- **Description:** An effect that fires at the start of your NEXT turn, not immediately.
- **Rules:**
  - The card is played normally, but the indicated effect is deferred.
  - A tracker shows "Vesting: [effect]" to both players.
  - Fires at the start of the next turn (Phase 1, after Pump).
  - If the card producing the Vesting effect is destroyed before the trigger, the Vesting effect still fires (it's already queued).

---

### DeFi
- **Internal ID:** `lifesteal`
- **Display:** `DeFi`
- **Description:** Damage dealt by this card also restores your Hero's HP by the same amount.
- **Rules:**
  - Applies to attack damage dealt by the minion.
  - Also applies to spell damage if a spell has DeFi.
  - Healing cannot exceed 30 HP (the max HP cap).
  - Does not heal for damage dealt by Deathrattles or other secondary effects.

---

### Flash Loan
- **Internal ID:** `echo`
- **Display:** `Flash Loan`
- **Description:** After playing this card, a copy is added to your hand costing (1) more Gas.
- **Rules:**
  - The copy is added to hand immediately after the original resolves.
  - The copy costs 1 more Gas (minimum 1).
  - The copy also has Flash Loan — you can chain it indefinitely (or until you run out of Gas or hand space).
  - Copies added by Flash Loan are temporary — they disappear at end of turn if not played.

---

### Rug Pull *(effect tag, not keyword)*
- **Internal ID:** `destroy`
- **Display:** `Rug Pull`
- **Description:** Used in card text to mean "instantly destroy this target." Bypasses health, armor, and most protections.
- **Rules:**
  - Not a keyword displayed on the card badge — it's vocabulary used in card text.
  - A minion with immunity to `destroy` tag (like Diamond Hands) cannot be Rug Pulled.
  - Does trigger Deathrattles (Rekt).
  - Does NOT bypass Silence — a Silenced minion can still be destroyed.

---

## Faction-Specific Mechanics (Not Universal Keywords)

### Volatility *(Meme faction)*
- **Internal ID:** `volatility`
- **Description:** When this card is played, its stats are randomly adjusted by up to ±N.
- **Stored as:** `"volatility": { "attack_variance": 2, "health_variance": 2 }`
- **Resolution:** On play, for each stat: `finalStat = baseStat + Math.floor(Math.random() * (variance * 2 + 1)) - variance`
- **Visual:** Stats shown with a `~` prefix before play (e.g. `~3/~3`). After play, actual stats shown.

### Gas Spike *(Ethereum faction)*
- **Internal ID:** `gas_spike`
- **Description:** Opponent's spells cost (N) more until end of their next turn.
- **Stored as effect param:** `{ "action": "modify_cost", "target": "opponent_spells", "amount": 1, "duration": "opponent_next_turn" }`

### Whale Effect *(passive aura)*
- **Internal ID:** `whale_aura`
- **Description:** This minion gets +1/+1 for each other minion on the board (any side).
- **Stored as passive effect:** Recalculated each time a minion enters or leaves the board.

---

## Keyword Display Order on Cards

When a card has multiple keywords, display them in this priority order:
1. HODL (Taunt) — always first if present
2. Ape In (Charge)
3. Moon Shot (Divine Shield)
4. DeFi (Lifesteal)
5. Flash Loan (Echo)
6. Smart Contract (Secret)
7. Vesting (Delayed)
8. Pump: [text] (Battlecry)
9. Rekt: [text] (Deathrattle)

---

## Keyword Badge Colors

| Keyword | Badge color |
|---|---|
| HODL | Gold `#e7c768` |
| Ape In | Green `#19e08a` |
| Moon Shot | White `#f0f4ff` |
| DeFi | Teal `#2bbd86` |
| Flash Loan | Red `#ff5a5a` |
| Smart Contract | Purple `#9b6dff` |
| Vesting | Amber `#ffb347` |
| Pump | Orange `#f7931a` |
| Rekt | Dark red `#c0392b` |
