# 09 — Economy & Web3

## Overview

Degen TCG uses a hybrid economy: free to play casually, token-gated for competitive/P2E, with cosmetic and card NFTs as premium layers.

---

## $DEGEN Token

- **Type:** ERC-20 (or equivalent on chosen chain)
- **Symbol:** `$DEGEN`
- **Role in game:** Token gate for ranked/P2E, purchase currency for packs, craft/dust currency (as fragments)
- **Fragments:** In-game sub-unit. 1,000 fragments = 1 `$DEGEN`. Players earn fragments, not whole tokens directly.

---

## Access Tiers

| Mode | Requirements | Features |
|---|---|---|
| **Practice** | Free (no wallet) | Play vs AI, try starter decks, no rewards |
| **Casual** | Free (wallet optional) | Play vs humans, no $DEGEN rewards, can earn booster pack tickets |
| **Ranked** | Hold 1,000 $DEGEN in wallet | Full ranked ladder, fragment rewards, season rewards |
| **P2E Tournaments** | Hold 1,000 $DEGEN + entry fee | Prize pool tournaments, NFT card rewards |

### Token Gate Check
```typescript
async function checkAccess(walletAddress: string): Promise<AccessTier> {
  const balance = await getTokenBalance(walletAddress, DEGEN_CONTRACT_ADDRESS);
  if (balance >= 1000) return 'ranked';
  return 'casual';
}
```
- Balance is checked at **match start** (not continuously).
- If balance drops below 1,000 mid-season, the player is demoted to Casual at next login.
- Staked tokens count toward the balance.

---

## New Player Onboarding

On first account creation:
1. Player receives **3 Starter Decks** (HODL Gang, Meme Machine, Stablecoin Control) — see `07_DECK_RULES.md`
2. Player receives **5 Booster Packs** to open immediately
3. Player completes a 5-game interactive tutorial (using fixed decks)
4. After tutorial, full collection UI unlocks

These are granted once per account. Non-transferable. Soulbound.

---

## Booster Packs

### Pack Contents
- 5 cards per pack
- Guaranteed distribution per pack:
  - At least **1 Rare or higher**
  - ~20% chance of an **Epic** (1 in 5 packs)
  - ~5% chance of a **Legendary** (1 in 20 packs)
  - Remaining slots: Commons

### Pack Types

| Pack | Contents | Cost |
|---|---|---|
| Standard Pack | Any faction, any rarity | 100 $DEGEN fragments |
| Faction Pack | Cards from one faction only (player chooses) | 120 $DEGEN fragments |
| Legendary Pack | Guaranteed Legendary + 4 others | 800 $DEGEN fragments |
| Season Pack | Current season cards only | 150 $DEGEN fragments |

### Pity Timer
To prevent extreme bad luck:
- If a player opens 20 Standard Packs without an Epic: next pack is guaranteed Epic.
- If a player opens 40 Standard Packs without a Legendary: next pack is guaranteed Legendary.
- Pity counters are per-player, per-pack-type. Reset on receiving the guaranteed card.

```typescript
interface PlayerPackStats {
  standard_packs_since_epic: number;
  standard_packs_since_legendary: number;
  // ... per pack type
}
```

### Opening Animation
- Pack opens with a 3D foil-tear animation.
- Cards are revealed one at a time, face down → flip face up.
- Rare: blue glow on flip.
- Epic: purple glow + particle burst.
- Legendary: gold explosion, slow-mo flip, unique jingle.

---

## Dust / Craft System (Card Collection)

Players can **dust** (destroy) unwanted cards for fragments, and **craft** cards they want.

| Rarity | Dust value (fragments) | Craft cost (fragments) |
|---|---|---|
| Common | 5 | 40 |
| Rare | 20 | 100 |
| Epic | 100 | 400 |
| Legendary | 400 | 1,600 |

- Dusting is permanent (card is removed from collection).
- Crafted cards are fully owned and tradeable (if NFT system enabled).
- Duplicate cards beyond the allowed copy limit can be dusted or traded.

---

## P2E Rewards

### Daily Quests
Generated fresh each day at 00:00 UTC. Players receive 3 quests.

| Quest | Reward |
|---|---|
| Daily login | 10 fragments |
| Win 3 games (any mode) | 1 Standard Booster Pack |
| Play 10 cards of a specific faction | 50 fragments + 1 faction-specific Rare |
| Win without your Hero taking damage | 100 fragments |
| Destroy 15 minions in a day | 50 fragments |

### Ranked Win Rewards

| Rank tier | Reward per win |
|---|---|
| Bronze | 5 fragments |
| Silver | 10 fragments |
| Gold | 20 fragments |
| Platinum | 35 fragments |
| Diamond | 55 fragments |
| Degen (top 500) | 80 fragments + season points |

### First Win of Day Bonus
First ranked win each day: **2× fragment reward**.

---

## Ranked Seasons

- Season length: **4 weeks**
- New card set released each season (approximately 40–60 new cards)
- Rank resets to **Bronze** at season end (with a soft floor based on previous rank)

### Rank Tiers

| Tier | Stars to advance | Players |
|---|---|---|
| Bronze | 3 stars, 3 ranks | All players |
| Silver | 3 stars, 3 ranks | — |
| Gold | 3 stars, 3 ranks | — |
| Platinum | 3 stars, 3 ranks | — |
| Diamond | 3 stars, 3 ranks | — |
| Degen | Top 500 by ladder points | ~Top 500 |

Star rules: Win = +1 star. Loss = -1 star (no star loss in Bronze). Win streak of 3+: bonus star per win.

### Season End Rewards

| Final rank | Rewards |
|---|---|
| Bronze | 1 Standard Pack |
| Silver | 3 Standard Packs |
| Gold | 5 Standard Packs + unique card back |
| Platinum | 7 Packs + unique card back + 500 fragments |
| Diamond | 10 Packs + animated card back + 1,000 fragments |
| Degen (1–500) | 20 Packs + Degen rank NFT badge + 3,000 fragments + exclusive season Legendary |

---

## NFT Card Variants

Standard cards are not NFTs. NFT variants are cosmetic alternates of existing cards with:
- Animated art (holographic/moving)
- Unique card back
- On-chain ownership (tradeable/sellable)
- Same gameplay stats as the base card

NFT variants are earned through:
- Top 100 season finishes
- Special tournaments
- Limited-edition drops (announced separately)

NFT cards can be used in-game as a direct substitute for the base card.

---

## Wallet Integration

- Players connect wallet via **WalletConnect** or **MetaMask** on the web client.
- Wallet is optional for Practice/Casual mode.
- Required for Ranked, P2E, and NFT features.
- `player.wallet_address` stored on profile.
- Token balance checked via RPC call at relevant gating points.
- Fragment balance is tracked **off-chain** in the game database (not on-chain) for speed. Only $DEGEN token gate is on-chain.
