# Degen TCG — Developer Documentation Index

> Crypto-parody trading card game. Hearthstone-inspired mechanics with Web3 economy.

## Document Map

| # | File | Contents |
|---|------|----------|
| 01 | `01_GAME_OVERVIEW.md` | Vision, pillars, tone, target audience |
| 02 | `02_CORE_LOOP.md` | Turn structure, mana (Gas), combat rules, win conditions |
| 03 | `03_CARD_TYPES.md` | All 5 card types, stats, rules per type |
| 04 | `04_CARD_SCHEMA.md` | Full data model / DB schema for cards |
| 05 | `05_FACTIONS.md` | All 6 factions, playstyles, faction bonus rules |
| 06 | `06_KEYWORDS.md` | All keywords with internal names, display names, and logic |
| 07 | `07_DECK_RULES.md` | Deck construction, copy limits, mulligan, starter decks |
| 08 | `08_BOARD_AND_ZONES.md` | Board layout, zones, 3D board spec (Three.js) |
| 09 | `09_ECONOMY_AND_WEB3.md` | Token gate, booster packs, P2E rewards, ranked seasons |
| 10 | `10_HERO_AND_HERO_POWER.md` | Hero cards, Hero Powers, armor system |
| 11 | `11_CARD_COMPONENT_SPEC.md` | Existing card component system (modular, DB-driven) |

## Tech Stack Assumptions

- **Frontend:** Web (Three.js for 3D board, existing `.dc.html` card component system)
- **Backend:** Node.js or similar, REST or GraphQL API
- **Database:** Relational (Postgres suggested) — one row per card
- **Wallet:** Web3 wallet connect (e.g. MetaMask / WalletConnect) for token gate + P2E
- **Token:** ERC-20 `$DEGEN` token (1,000 required for ranked/P2E access)

## Naming Conventions (Crypto-flavored → Standard)

| Display name | Internal/code name |
|---|---|
| Gas | mana |
| Pump phase | draw_phase (start of turn) |
| HODL | taunt |
| Ape In | charge |
| Pump | battlecry |
| Rekt | deathrattle |
| Moon Shot | divine_shield |
| Fork | discover |
| Airdrop | discover_free |
| Smart Contract | secret |
| Vesting | delayed_effect |
| Defi | lifesteal |
| Flash Loan | echo |
| Rug Pull | destroy |
| Bleed | fatigue |
| Burn pile | graveyard |
| Memepool | deck |
