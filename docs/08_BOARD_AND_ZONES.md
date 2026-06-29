# 08 — Board & Zones

## Overview

The game board is a **3D environment built in Three.js**. Cards stand upright in 3D on floating hex pads. The aesthetic is a dark cyberpunk trading floor — animated candlestick charts, glowing faction colors, and holographic card art on zoom.

---

## Board Layout (Top-Down)

```
┌──────────────────────────────────────────────────────┐
│  [OPPONENT HERO]           [OPPONENT LOCATION SLOT]  │
│                                                      │
│  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]                 │
│         ← Opponent Minion Row (7 slots) →            │
│                                                      │
│  ─────────────────── DIVIDER ──────────────────────  │
│                                                      │
│  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]  [ ]                 │
│         ← Player Minion Row (7 slots) →              │
│                                                      │
│  [PLAYER HERO]             [PLAYER LOCATION SLOT]   │
│                                                      │
│  ═══════════════ PLAYER HAND (arc) ═══════════════  │
└──────────────────────────────────────────────────────┘
```

---

## Zone Definitions

### Minion Row
- 7 slots per side, evenly spaced.
- Cards occupy slots left to right as played.
- Minions can be repositioned before attacking (drag to reorder).
- In 3D: cards stand upright on **glowing hex pads**, tilted ~10° toward the controlling player.
- Hex pad glow color = card's faction color.
- HODL (Taunt) minions have a pulsing **gold ring** around their hex pad.

```typescript
interface MinionSlot {
  index: number;        // 0–6, left to right from player's perspective
  card: Card | null;
  hasAttacked: boolean;
  summoningSickness: boolean;
}
```

### Hero Zone
- Center-back of each side.
- Displays: Hero portrait, current HP, current Armor, weapon (if equipped).
- In 3D: the Hero has a larger floating card/portrait with HP/Armor overlay.
- Clicking the enemy Hero zone = attack it (if valid target).

### Location Slot
- Far left of each side (or far right — consistent placement TBD by UX).
- Only 1 Location per side.
- Shows Durability counter.
- Clicking it activates it (spends 1 Durability) if it's your turn and your Location.

### Hand Zone
- Player's own cards are shown fanned in an arc at the bottom of the screen.
- Cards fan out left to right, overlapping when > 5 cards.
- Opponent's hand shows the **back of cards** with a count badge.
- Hovering/tapping a card in hand: zooms to full 3D card view.
- Dragging a card from hand to board plays it (or shows target selector for targeted cards).

### Burn Pile (Graveyard)
- Small icon in the corner of each side (a flame icon).
- Clicking it opens a panel showing all cards in that player's burn pile.
- Visible to both players at all times.
- Ordered most-recent-first.

### Secret Zone
- Shown between the Hero zone and minion row.
- Displays N face-down cards (N = active Secrets count).
- Hovering shows "Smart Contract" label and the card back only.
- When a Secret triggers, it flips face-up briefly before moving to burn pile.

### Deck (Mempool)
- Shown as a card stack with a count badge.
- Clicking it does nothing (decks are not inspectable in-game).
- When deck is empty: stack disappears, replaced by a red blinking counter showing Fatigue value.

---

## 3D Scene Specification

### Camera
- Fixed isometric-adjacent angle: approximately 45° pitch, 0° yaw (looking straight down the center axis).
- Camera does not rotate during gameplay.
- Slight zoom animation when a card is targeted or played.

### Lighting
- Ambient: dark blue-gray (`#0b0e15` approximation).
- Point lights: one per active faction color on the board (hex pad glow).
- Animated: slow pulsing on legendary card hex pads.

### Background / Environment
- Animated trading floor: scrolling candlestick chart in the background (canvas element or shader).
- Candle colors react to game state:
  - Player winning (> 50% HP advantage): more green candles
  - Player losing (< 30% HP): more red candles, faster scroll speed
  - Game ending (lethal turn): full red, rapid scroll

### Card 3D Representation
- Cards stand upright (Y-axis up, slight tilt toward owner).
- Card face shows full card render (using existing `.dc.html` card component, screenshotted or rendered to texture).
- Hovering a board card: card tilts forward, shows stats overlay.
- Zooming a card (click or hold): full 3D card floats to screen center with parallax art effect.

---

## Animations

### Play animation (card from hand → board)
- Card slides out of hand fan, scales up, arcs through 3D space to its board slot.
- Duration: ~400ms
- On landing: short particle burst in faction color.

### Attack animation
- Attacker card slides forward along Z-axis toward target, decelerates into it.
- On hit: screen shake (subtle, ~150ms), particle burst on target.
- Attacker slides back to slot.
- Duration total: ~600ms

### Spell animation
- Full-screen shader flash in faction color for ~200ms.
- Unique shaders per spell category:
  - Destroy effect: ground tears open, card sinks
  - Buff effect: gold sparkle upward on target
  - Draw effect: card stack pulses
  - AoE: wave emanates from center outward

### Death animation
- Card shatters into pixel/polygon shards.
- Shards fall off the hex pad with gravity.
- Legendary death: larger explosion, unique sound, brief camera zoom-out.

### Healing animation
- Green particles rise from Hero portrait.

### Armor gain
- Silver shimmer washes across Hero portrait.

---

## Board Themes (Cosmetic, Unlockable)

| Theme ID | Name | Description | Unlock method |
|---|---|---|---|
| `mempool` | Mempool | Default dark trading floor | All players |
| `bull_run` | Bull Run | Green candles, rising market | Reach Gold rank |
| `bear_cave` | Bear Cave | Blood-red crash market | Spend 5,000 $DEGEN fragments |
| `blockchain` | Blockchain | Glowing chain-link hex floor | Top 100 season reward |
| `genesis_block` | Genesis Block | Black and white retro terminal | Pre-season 1 reward (limited) |

Board theme is a player cosmetic stored on their profile: `player.board_theme_id`.

---

## Responsive Layout Notes

- Board is designed for **desktop-first** (16:9 minimum).
- Mobile: hand cards stack vertically at bottom. Board shrinks. Attack is tap-to-select-then-tap-target.
- Tablet: same as desktop but with larger touch targets.
