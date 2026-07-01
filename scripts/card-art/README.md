# Card Art Generation

Batch-generates trading card art using OpenAI's image API, following the style formula in `browser-trading-card-game-design/asd/12_VISUAL_IDENTITY_ART_STYLE.md`.

## Setup

1. Copy `.env.example` → `.env` and set `OPENAI_API_KEY`
2. From repo root: `pnpm install`

## Quality pipeline

- **Hand-written briefs** in `packages/db/prisma/art-labels.ts` (35 cards) — used first
- **gpt-image-2** with automatic fallback to gpt-image-1 → dall-e-3
- **Type-aware prompts** — weapons/locations/spells get object-focused poses (no cartoon eyes on gear)
- **Card-crop composition** — subjects framed for the 158px-tall art window

## Subject rules

**Bitcoin** — humans allowed (traders, maxis, vault guards) **or** fantasy creatures (golems, dwarves, vault guardians).

**All other factions** — no humans except Hero cards and Legendary KOL minions; Common/Rare/Epic must be creatures, monsters, or anthropomorphized objects.

Faction archetypes and the 12 canonical sample briefs live in `cards.json`. Full catalog in `packages/db/prisma/art-labels.ts`.

## Commands

```bash
# Generate all missing art (skips existing PNGs)
pnpm art:generate

# Genesis Drop pack — 20 exclusive cards only
pnpm art:genesis-drop:dry    # preview prompts, no API cost
pnpm art:genesis-drop        # generate up to 20 missing genesis_drop cards

# After seed + generate, sync art URLs to DB
pnpm --filter @memetgc/card-art sync:db

# Regenerate only cards that previously had human characters (keeps approved art)
pnpm art:regenerate-humans

# Dry run — writes prompts to logs/, no API cost
pnpm art:dry

# Regenerate specific cards with upgraded prompts
pnpm --filter @memetgc/card-art generate -- --card-id=bitcoin_paper_hands --force
pnpm --filter @memetgc/card-art generate -- --card-id=bitcoin_cold_wallet --force
pnpm --filter @memetgc/card-art generate -- --card-id=bitcoin_diamond_hands --force

# Test batch (5 cards, force overwrite)
pnpm --filter @memetgc/card-art generate -- --limit=5 --force

# Push generated URLs to database (when DB is reachable)
pnpm --filter @memetgc/card-art sync:db
```

## Output

- PNGs: `apps/web/public/card-art/{card_id}.png`
- Prompt logs: `scripts/card-art/logs/{card_id}.txt`
- Manifest: `apps/web/public/card-art/manifest.json`

Cards auto-load art from `/card-art/{id}.png` even before DB sync.

## Cost

~$0.02–$0.19 per image depending on model. Test with `--limit=5 --force` before running the full set.
