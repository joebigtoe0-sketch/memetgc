# 01 — Game Overview

## Vision

Degen TCG is a browser-based, crypto-themed trading card game with a parody/meme lens on the crypto world. Think Hearthstone in feel — approachable for newcomers, deep enough for competitive players — but with all cards, mechanics, and lore drawn from real tokens, crypto KOLs, protocols, and memes.

The game is free to try, requires holding `$DEGEN` to play competitively, and features play-to-earn mechanics through ranked seasons.

---

## Design Pillars

1. **Instantly legible** — A new player should understand any card by reading it once. No hidden information on card stats.
2. **Deep but not complex** — Strategic depth comes from faction synergies, keyword interactions, and curve decisions — not from rules bloat.
3. **Crypto-native humor** — Every card name, ability, and flavor text should read as a knowing in-joke for crypto participants. Paper Hands runs away; Diamond Hands can't be Rug Pulled.
4. **Modular & DB-driven** — Card art, names, stats, and text are all data. No hardcoded cards in UI. One database row = one rendered card.
5. **Web3 economy** — Token gating, booster packs, P2E rewards, and NFT card variants are first-class features, not afterthoughts.

---

## Target Audience

- Primary: Crypto-native users aged 18–35, familiar with tokens, NFTs, and DeFi terminology
- Secondary: TCG players (Hearthstone, MTG, Pokemon) who want a fresh theme
- Casual entry point: Free starter decks, no token required for practice mode

---

## Tone

Parody-first. Self-aware. Never mean-spirited. The game laughs *with* crypto culture, not at it. Cards based on real projects or figures should feel like an affectionate roast, not an attack.

Example card text:
- *"Taunt. Cannot be destroyed by Rug Pull effects."* (Diamond Hands)
- *"At the end of your turn, 50% chance to flee the board."* (Paper Hands)
- *"Your opponent's spells cost (1) more."* (Gas Goblin)

---

## Comparison to Inspirations

| Feature | Hearthstone | Magic: The Gathering | Degen TCG |
|---|---|---|---|
| Deck size | 30 | 60 | 30 |
| Resource system | Mana (auto-ramp) | Lands (draw-dependent) | Gas (auto-ramp) |
| Board limit | 7 minions | No hard limit | 7 minions |
| Hand limit | 10 | 7 | 10 |
| Card advantage | Draw 1/turn | Draw 1/turn | Draw 1/turn |
| Complexity | Low-Medium | High | Low-Medium |
| Economy | Cosmetic F2P | Secondary market | P2E + token gate |
| Theme | Fantasy | Fantasy | Crypto/meme |

Degen TCG sits closest to Hearthstone in complexity and pacing. MTG is referenced for some keyword inspiration only.
