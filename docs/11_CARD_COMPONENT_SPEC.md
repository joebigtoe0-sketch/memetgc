# 11 — Card Component System

## Overview

The card rendering system is **fully modular and DB-driven**. One database record = one rendered card. No card stats or names are hardcoded in the UI. The system uses a custom `.dc.html` component format.

This document describes how the existing component system works and how to extend it.

---

## File Structure

```
/
├── support.js             # DC component runtime (custom framework)
├── Card.dc.html           # Single card component
└── Card_Gallery.dc.html   # Gallery page (renders multiple cards via Card component)
```

---

## Card Component (`Card.dc.html`)

The card component accepts a single `card` prop (matching the Card schema in `04_CARD_SCHEMA.md`) and renders the full card frame.

### Props

```typescript
// Passed as: <dc-import name="Card" card="{{ c }}" />
interface CardProps {
  card: Card;  // Full card object from DB
}
```

### Internal Logic (renderVals)

The component maps DB fields to visual variables:

```javascript
const FACTIONS = {
  bitcoin:  { base: '#f7931a' },
  ethereum: { base: '#7b8cf4' },
  solana:   { base: '#19e08a' },
  meme:     { base: '#ff5fae' },
  stable:   { base: '#2bbd86' },
  degen:    { base: '#9aa3b2' },
};

const RARITY = {
  common:    { gem1: '#dfe6f0', gem2: '#8d95a3', glow: 'rgba(0,0,0,0)' },
  rare:      { gem1: '#7cc4ff', gem2: '#2b6fd0', glow: 'rgba(0,0,0,0)' },
  epic:      { gem1: '#d29bff', gem2: '#8a32d8', glow: 'rgba(170,90,230,.45)' },
  legendary: { gem1: '#ffe07a', gem2: '#e0890f', glow: 'rgba(255,190,70,.6)' },
};

const STAT_COLORS = {
  attack:     ['#ffd877', '#d97a16'],  // Minion/Weapon ATK — gold/orange
  health:     ['#ff8f7e', '#c2271c'],  // Minion HP — red
  durability: ['#dfe5ec', '#7e8a99'],  // Weapon/Location durability — steel
  armor:      ['#7df0c0', '#1f9c6e'],  // Hero armor — teal
};
```

### Stat Badge Mapping by Card Type

| Type | Left badge | Right badge |
|---|---|---|
| `minion` | ATK (gold) | HP (red) |
| `weapon` | ATK (gold) | Durability (steel) |
| `hero` | Armor (teal, if > 0) | HP (red) |
| `location` | — | Durability (teal) |
| `spell` | — | — |

### CSS Variables Set on Root Element

```javascript
{
  '--fac': F.base,           // Faction color for borders and glow
  '--gem1': R.gem1,          // Rarity gem gradient start
  '--gem2': R.gem2,          // Rarity gem gradient end
  '--left1': left.col[0],    // Left badge gradient start
  '--left2': left.col[1],    // Left badge gradient end
  '--right1': right.col[0],  // Right badge gradient start
  '--right2': right.col[1],  // Right badge gradient end
}
```

### Card Dimensions
- Fixed size: `260px × 380px`
- Use `hint-size="260px,380px"` in the import tag for layout reservations.

---

## Gallery Component (`Card_Gallery.dc.html`)

Renders a grid of cards from a data array. Consumes the Card component for each entry.

### Template Structure

```html
<sc-for list="{{ cards }}" as="c" hint-placeholder-count="12">
  <dc-import name="Card" card="{{ c }}" hint-size="260px,380px"></dc-import>
</sc-for>
```

### Data Shape (renderVals)

```javascript
renderVals() {
  const cards = [/* array of Card objects from DB */];
  return { cards };
}
```

Replace the hardcoded array with an API call to your card database:

```javascript
async renderVals() {
  const response = await fetch('/api/cards?set=genesis');
  const cards = await response.json();
  return { cards };
}
```

---

## Extending the Card Component

### Adding Art Images

Replace the art placeholder with a real image:

```javascript
// In renderVals(), add:
artUrl: c.art_url || null,

// In template, replace the placeholder div with:
// <img src="{{ artUrl }}" style="width:100%;height:100%;object-fit:cover" />
// Show placeholder only when artUrl is null
```

### Adding Keyword Badges

Below the card name bar, before the text area, add a keyword badge row:

```javascript
// In renderVals():
keywordBadges: (c.keywords || []).map(k => ({
  label: k.display,
  color: KEYWORD_COLORS[k.id] || '#888'
}))
```

### Adding Flavor Text

Below the main card text, add italic flavor text in a smaller font:

```javascript
flavorText: c.flavor_text || null,
// Render as: <div style="font-style:italic;font-size:9px;color:#6a7282;margin-top:6px">{{ flavorText }}</div>
```

---

## API Integration Points

The card component system expects card data to be injected at runtime. Implement these endpoints:

### GET /api/cards
Returns all collectible cards (with optional filters).

Query params:
- `?faction=bitcoin` — filter by faction
- `?type=minion` — filter by type
- `?rarity=legendary` — filter by rarity
- `?set=genesis` — filter by set
- `?search=diamond` — name search

Response: `Card[]`

### GET /api/cards/:id
Returns a single card by ID.

Response: `Card`

### GET /api/collection/:playerId
Returns the player's owned cards with quantities.

Response: `{ card_id: string, quantity: number }[]`

### GET /api/decks/:playerId
Returns the player's saved decks.

### POST /api/decks
Save a new deck. Body: `{ name, hero_id, card_ids: string[] }`

---

## Card Component Usage in Game Client

In-game, cards are not rendered as HTML components directly — they are rendered to **textures** for the Three.js 3D board:

```javascript
// Pseudocode: render card HTML to canvas, use as Three.js texture
async function cardToTexture(card: Card): Promise<THREE.Texture> {
  const canvas = document.createElement('canvas');
  canvas.width = 260;
  canvas.height = 380;
  // Use html2canvas or similar to render the .dc.html card to canvas
  await html2canvas(cardElement, { canvas });
  return new THREE.CanvasTexture(canvas);
}
```

For the hand/zoom view (2D overlay), the HTML component can be rendered directly as a DOM element overlaid on the Three.js canvas.

---

## Card Placeholder System

While art is being produced, the existing placeholder system in the component handles it:

- The art window shows a hatched pattern in the faction color.
- Center text shows the card name (art label) and "ART PLACEHOLDER."
- Legendary cards show a shimmer/sheen animation on the placeholder.
- This makes the system fully functional pre-art.

When real art is added, update `card.art_url` in the database and the component will render it automatically.
