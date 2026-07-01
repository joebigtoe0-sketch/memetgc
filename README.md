# Legends of the Memepool

**Memepool** — *From the depths, legends rise*

A real-time multiplayer crypto-themed trading card game. Hearthstone-inspired mechanics with Web3 economy, 6 factions, and a Three.js 3D board.

## Architecture

```
memetgc/
├── apps/
│   ├── web/          # Next.js 16 frontend (React, Three.js, wagmi)
│   └── server/       # Node.js game server (Express, Socket.io)
├── packages/
│   ├── types/        # Shared TypeScript interfaces (Card, GameState, etc.)
│   ├── db/           # Prisma schema + PostgreSQL client
│   └── game-engine/  # Pure TypeScript game state machine (server + client)
└── docs/             # 12 design documents
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 15+

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
# Database (packages/db/.env)
DATABASE_URL="postgresql://user:password@localhost:5432/memetgc"

# Server (apps/server/.env)
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/memetgc"
JWT_SECRET="your-secret-key"
CLIENT_ORIGIN=http://localhost:3000

# Frontend (apps/web/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### 3. Setup database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to DB
pnpm db:push

# Seed with starter cards, heroes, and a demo user
pnpm db:seed
```

### 4. Run development servers

```bash
# Run everything in parallel (web + server)
pnpm dev

# Or individually:
pnpm --filter @memetgc/web dev        # Next.js on :3000
pnpm --filter @memetgc/server dev     # Game server on :3001
```

## Features Implemented

### Game Engine (`packages/game-engine`)
- Full turn structure: Pump → Draw → Main → End phases
- Gas (mana) system with 0–10 crystals, temporary Gas (Coin)
- Combat: minion vs minion, minion vs hero, hero weapon attacks
- All 12 keywords: HODL (Taunt), Ape In (Charge), Moon Shot (Divine Shield), DeFi (Lifesteal), Flash Loan (Echo), Smart Contract (Secret), Vesting (Delayed), Pump (Battlecry), Rekt (Deathrattle), Volatility, Gas Spike, Whale Effect
- Faction bonuses for all 6 factions
- Discover / Fork mechanic
- Deathrattle processing in play order
- Fatigue damage
- AI opponent (greedy random-legal-move)

### Game Server (`apps/server`)
- Socket.io real-time multiplayer with server-authoritative game state
- Matchmaking queues: Practice (vs AI), Casual, Ranked
- REST API: cards, heroes, decks, collection, economy, auth
- JWT authentication
- $MEMEPOOL SPL token balance gate for Ranked (via Helius RPC)
- Daily quests + fragment rewards
- Pack opening with pity timers

### Frontend (`apps/web`)
- Card component system: faction colors, rarity gems, keyword badges, stat badges, art placeholder
- Card gallery with filters (faction, type, rarity, cost, search)
- Drag-and-drop deck builder with copy limit enforcement
- Hero select screen with all 6 heroes
- Game board UI: minion rows, hero zones, hand fan, mana crystals
- Three.js 3D board: isometric camera, glowing hex pads, animated candlestick background, faction-colored point lights
- Auth modal (register/login)
- Wallet connect via MetaMask

### Database (`packages/db`)
- Prisma schema: cards, heroes, users, decks, collection, matches, daily quests
- 30+ seeded cards across 4 factions (Bitcoin, Meme, Stable, Degen + examples)
- 3 starter decks: HODL Gang, Meme Machine, Stablecoin Control
- All 6 starting heroes

## Faction Design

| Faction | Bonus | Style |
|---------|-------|-------|
| Bitcoin | Start with 5 Armor | Tank/HODL |
| Ethereum | First spell costs 1 less | Combo/Secrets |
| Solana | First minion each turn has Charge | Aggro |
| Meme | Coin flip: extra draw OR free Hero Power | RNG |
| Stable | +1 opening hand card | Control |
| Degen | On damage taken, gain $FRAG token | Self-damage |

## Card Copy Limits

| Rarity | Max copies |
|--------|------------|
| Common | 4 |
| Rare | 3 |
| Epic | 2 |
| Legendary | 1 |

## Web3 Economy

- Ranked requires 1,000 $MEMEPOOL tokens in connected wallet
- Fragments (off-chain) earned from wins, quests, rank rewards
- 1,000 fragments = 1 $MEMEPOOL
- Pack types: Standard (100 frags), Faction (120), Legendary (800), Season (150)
- Pity timers: Epic guaranteed at 20 packs, Legendary at 40
