# 07 — Deck Rules

## Deck Construction

| Rule | Value |
|---|---|
| Total cards in deck | 30 |
| Minimum cards | 30 (exactly — no more, no less) |
| Common copies per deck | Max 4 |
| Rare copies per deck | Max 3 |
| Epic copies per deck | Max 2 |
| Legendary copies per deck | Max 1 |
| Hero cards per deck | Max 1 |
| Hero is separate from the 30-card deck | Yes — pick Hero before game, not counted in 30 |

---

## Faction Rules

- A deck can contain cards from **any combination of factions**.
- Mixing factions is valid — you lose the **Faction Bonus** unless all non-Degen cards share one faction.
- **Degen cards are faction-neutral**: including Degen cards does not break a single-faction bonus.

```
isPureFaction(deck, faction):
  return deck.cards
    .filter(c => c.faction !== 'degen')
    .every(c => c.faction === faction)
```

---

## Hero Selection

- Before each game, the player picks a **Hero** from their unlocked Hero roster.
- Starting Heroes are available to everyone (one per faction — 6 total).
- Additional Heroes are unlocked via Hero Card drops from booster packs.
- The Hero determines your **Hero Power** for the entire game.
- Hero cards played mid-game *replace* the Hero Power with a new one.

### Starting Heroes (all players unlock these)

| Hero | Faction | HP | Hero Power | Cost |
|---|---|---|---|---|
| Satoshi | Bitcoin | 30 | Mint: Add a 1/1 Token to hand | 2 |
| Vitalik | Ethereum | 30 | Gas War: Give a spell +1 damage this turn | 2 |
| Toly | Solana | 30 | Turbo: Give a friendly minion +2 Attack this turn | 2 |
| Elon | Meme | 30 | Tweet: Add a random Meme spell to hand | 2 |
| Circle CEO | Stable | 30 | Yield: Restore 2 HP to your Hero | 2 |
| Anon | Degen | 30 | Ape: Deal 2 damage to your own Hero. Draw a card | 2 |

---

## Mulligan

At game start, before turn 1:

1. Each player sees their opening hand (3 cards for Player 1, 4 for Player 2).
2. Players may select any number of cards to **swap back** into the deck.
3. The selected cards are shuffled back in. An equal number of new cards are drawn.
4. This happens **simultaneously** — neither player sees the other's mulligan.
5. Each card can only be mulliganed once — the replacement cards are kept.

**Strategy tip (shown in UI):** Look for a good early-turn curve. Swapping high-cost cards for low-cost ones is usually correct.

---

## Opening Hand + Coin

| Player | Cards drawn | Extra |
|---|---|---|
| Player 1 (goes first) | 3 | Nothing |
| Player 2 (goes second) | 4 | +1 Coin card |

**Coin card:**
```json
{
  "id": "coin",
  "name": "The Coin",
  "type": "spell",
  "faction": "degen",
  "rarity": "common",
  "cost": 0,
  "text": "Gain 1 Gas this turn only.",
  "collectible": false
}
```
The Coin is a non-collectible card given at game start. It does not count toward the 30-card deck.

---

## Deck Validation Rules (Client + Server)

The deck builder should enforce and the server should validate:

```
1. Exactly 30 cards (not counting Hero)
2. No more than 1 Hero card in deck
3. Copy limits respected per rarity
4. All card IDs exist in the card database
5. All cards are collectible (collectible: true)
6. Player owns each card in the deck (check collection)
```

---

## Starter Decks (Free for All New Players)

Every new account receives 3 pre-built decks and 5 booster packs on signup. These use only Common and Rare cards.

### HODL Gang — Bitcoin Starter

**Hero:** Satoshi (Mint hero power)
**Strategy:** Survive early, defend with Taunt minions, win in late game with big bodies.
**Teaches:** HODL (Taunt), Rekt (Deathrattle), armor stacking.

| Qty | Card | Type | Cost |
|---|---|---|---|
| 4 | Paper Hands | Minion | 1 |
| 4 | Baby HODL | Minion | 2 |
| 3 | Block Defender | Minion | 3 |
| 3 | Mining Rig | Minion | 4 |
| 2 | Cold Wallet | Weapon | 3 |
| 3 | Stack Sats | Spell | 1 |
| 3 | Hodl the Line | Spell | 2 |
| 3 | Hardware Security | Spell | 3 |
| 2 | Bitcoin Maxi | Minion | 5 |
| 3 | The Halving | Spell | 4 |

---

### Meme Machine — Meme Starter

**Hero:** Elon (Tweet hero power — adds random Meme spell to hand)
**Strategy:** Embrace chaos. High variance. Win fast or lose fast.
**Teaches:** Volatility, RNG mechanics, Pump (Battlecry) effects.

| Qty | Card | Type | Cost |
|---|---|---|---|
| 4 | Moon Boy | Minion | 2 |
| 4 | Doge Gang | Minion | 1 |
| 3 | Pepe Deploy | Spell | 2 |
| 3 | Hype Wave | Spell | 1 |
| 3 | Diamond Frog | Minion | 3 |
| 3 | Viral Tweet | Spell | 3 |
| 3 | To The Moon | Spell | 3 |
| 2 | Elon Shill | Minion | 4 |
| 3 | Pump It | Spell | 1 |
| 2 | 100x Bet | Minion | 5 |

---

### Stablecoin Control — Stable Starter

**Hero:** Circle CEO (Yield hero power — restore 2 HP)
**Strategy:** Draw cards, remove threats, outlast the opponent.
**Teaches:** Board clears, card draw engines, value plays.

| Qty | Card | Type | Cost |
|---|---|---|---|
| 4 | Risk Manager | Minion | 2 |
| 3 | Yield Farmer | Minion | 3 |
| 3 | Liquidation | Spell | 2 |
| 3 | Flash Crash | Spell | 4 |
| 3 | Collateral | Spell | 1 |
| 3 | Peg Defence | Minion | 4 |
| 3 | Stablecoin | Minion | 2 |
| 3 | DAI Hard | Spell | 3 |
| 3 | Reserve Protocol | Minion | 5 |
| 2 | The Fed | Minion | 7 |
