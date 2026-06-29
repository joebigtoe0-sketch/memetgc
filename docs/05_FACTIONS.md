# 05 — Factions

Every card belongs to exactly one faction. Faction determines visual theming, playstyle identity, and eligibility for the Faction Bonus.

---

## The Six Factions

### ₿ Bitcoin (`bitcoin`)
- **Color:** `#f7931a` (Bitcoin orange)
- **Identity:** HODL & value. Slow, tanky, defensive.
- **Playstyle:** Win by outlasting the opponent. High-health minions, armor generation, Deathrattles, and resilience to removal.
- **Signature mechanics:** HODL (Taunt), Rekt (Deathrattle), Armor stacking
- **Card themes:** Wallets, mining, self-custody, long-term holders, Satoshi lore
- **Weakness:** Slow to establish board. Vulnerable to burst damage before defenses are set up.

**Faction Bonus (pure Bitcoin deck):** Start the game with **5 Armor** on your Hero.

---

### Ξ Ethereum (`ethereum`)
- **Color:** `#7b8cf4` (Ethereum purple-blue)
- **Identity:** Gas manipulation & smart contracts. Combo-oriented, reactive.
- **Playstyle:** Control the tempo through Gas cost manipulation and reactive Secret cards. Strong mid-game swing turns.
- **Signature mechanics:** Gas Spike (increase opponent spell costs), Smart Contract (Secrets), combo chains
- **Card themes:** Gas fees, smart contracts, DeFi protocols, EVM, The Merge, Layer 2
- **Weakness:** Reactive and passive — can feel slow if Secrets aren't set up in time.

**Faction Bonus (pure Ethereum deck):** Your first spell each turn costs **(1) less Gas**.

---

### ◎ Solana (`solana`)
- **Color:** `#19e08a` (Solana green)
- **Identity:** Speed & throughput. Aggressive swarm tactics.
- **Playstyle:** Flood the board with cheap minions fast. Kill the opponent before they can set up defenses. High ceiling, low floor.
- **Signature mechanics:** Ape In (Charge), low-cost spam, extra attack mechanics
- **Card themes:** TPS (transactions per second), validators, speed, memecoin launches, outages (downside cards)
- **Weakness:** Fragile minions. Bad topdecks in the late game when board is cleared.

**Faction Bonus (pure Solana deck):** The first minion you play each turn has **Charge** (Ape In).

---

### 🐸 Meme (`meme`)
- **Color:** `#ff5fae` (Meme pink)
- **Identity:** Chaos & RNG. Maximum variance gameplay.
- **Playstyle:** High-risk, high-reward. Cards with random or probabilistic outcomes. Fun and unpredictable. Based on real memecoins and crypto KOLs.
- **Signature mechanics:** Volatility (random stat variance), 50/50 coin flip effects, Fork (Discover from chaos pool)
- **Card themes:** Dogecoin, Pepe, Shiba Inu, viral KOLs, pump-and-dump cycles, community hype
- **Weakness:** Extremely inconsistent. A Meme deck can win in 3 turns or lose in 3 turns.

**Faction Bonus (pure Meme deck):** At the start of your turn, flip a coin. Heads: draw an extra card. Tails: your Hero Power costs (0) this turn.

**Volatility mechanic:**
Cards with the `volatility` keyword have a variable stat range:
```json
{
  "volatility": { "attack_variance": 3, "health_variance": 3 }
}
```
When the card is played, `Math.floor(Math.random() * (variance * 2 + 1)) - variance` is added to each stat. A 3/3 with `variance: 3` can be anything from 0/0 to 6/6.

---

### $ Stable (`stable`)
- **Color:** `#2bbd86` (Stablecoin teal)
- **Identity:** Control & resource generation. Consistent and reliable.
- **Playstyle:** Draw cards, remove threats, heal, stabilize. Wins by grinding out the opponent with card advantage and board clears.
- **Signature mechanics:** Draw engines, board clears (AoE), healing, value generation
- **Card themes:** USDC, USDT, DAI, algorithmic stablecoins, yield farming, risk-off strategies
- **Weakness:** Needs time to set up. Vulnerable to hyper-aggro starts. Boring to play against (sometimes intentionally).

**Faction Bonus (pure Stable deck):** Start with **1 extra card** in your opening hand (draw 4 instead of 3, or 5 instead of 4).

---

### ∞ Degen (`degen`)
- **Color:** `#9aa3b2` (Neutral gray)
- **Identity:** Wildcard & self-damage synergies. High risk for big rewards.
- **Playstyle:** Degen cards work in ANY faction mix without breaking the Faction Bonus. They also have self-damage mechanics that unlock powerful payoffs.
- **Signature mechanics:** Self-damage rewards, multi-faction synergies, big swingy plays
- **Card themes:** Leveraged trading, CT (Crypto Twitter) degeneracy, 100x bets, losing everything and rebounding
- **Weakness:** Self-damage is real and can backfire badly.

**Special rule:** Degen cards are **faction-neutral** — including them in a pure-faction deck does NOT break the Faction Bonus. A "pure Bitcoin" deck can contain up to 10 Degen cards and still receive the Bitcoin Faction Bonus.

**Faction Bonus (pure Degen deck — no other factions):** Whenever you take damage (from any source), gain 1 `$FRAG` token (a 0-cost 0/0 that gains +1/+1 for each damage your Hero has taken this game).

---

## Faction Bonus Rules

```
Faction Bonus is active when:
  - All cards in deck are from a single faction, OR
  - All non-Degen cards are from a single faction (Degen cards are neutral)

Faction Bonus activates:
  - At game start (passive bonuses apply immediately)
  - Or on the relevant trigger (e.g. Meme coin flip at start of each turn)

Faction Bonus does NOT stack:
  - A player cannot have more than one Faction Bonus active

Checking for Faction Bonus:
  deck.cards
    .filter(c => c.faction !== 'degen')
    .every(c => c.faction === primaryFaction)
```

---

## Faction Color Reference (for UI/3D board)

| Faction | Hex | Used for |
|---|---|---|
| bitcoin | `#f7931a` | Card border glow, hex pad glow, faction gem |
| ethereum | `#7b8cf4` | Card border glow, hex pad glow, faction gem |
| solana | `#19e08a` | Card border glow, hex pad glow, faction gem |
| meme | `#ff5fae` | Card border glow, hex pad glow, faction gem |
| stable | `#2bbd86` | Card border glow, hex pad glow, faction gem |
| degen | `#9aa3b2` | Card border glow, hex pad glow, faction gem |
