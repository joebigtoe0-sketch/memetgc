import React from "react";

/**
 * Full game documentation content for Legends of the Mempool.
 * Each section has a stable `id` used for sidebar navigation / deep links.
 * Sections are grouped for the left sidebar.
 */

export interface DocSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export interface DocGroup {
  label: string;
  sections: DocSection[];
}

// ── Small presentational helpers ─────────────────────────────────────────────

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ font: `500 14px/1.7 var(--font-archivo,'Archivo',sans-serif)`, color: "#b8c1d1", margin: "0 0 14px" }}>
      {children}
    </p>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ font: `500 15px/1.7 var(--font-archivo,'Archivo',sans-serif)`, color: "#cdd6e4", margin: "0 0 18px" }}>
      {children}
    </p>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ font: `800 15px var(--font-archivo,'Archivo',sans-serif)`, color: "#f3e8cc", letterSpacing: ".3px", margin: "24px 0 10px" }}>
      {children}
    </h3>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{ margin: "0 0 16px", padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ font: `500 14px/1.6 var(--font-archivo,'Archivo',sans-serif)`, color: "#b8c1d1" }}>
      {children}
    </li>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "#f3e8cc", fontWeight: 700 }}>{children}</strong>;
}

export function Frag({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#e7c768", fontWeight: 700 }}>{children}</span>;
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "0 0 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{ textAlign: "left", padding: "10px 14px", font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: "#8a93a6", textTransform: "uppercase", background: "rgba(255,255,255,.03)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} style={{ padding: "10px 14px", font: `500 13px/1.5 var(--font-archivo,'Archivo',sans-serif)`, color: "#c2cbdb", borderBottom: ri === rows.length - 1 ? "none" : "1px solid rgba(255,255,255,.05)" }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn" | "good"; children: React.ReactNode }) {
  const c =
    tone === "warn"
      ? { bg: "rgba(255,90,90,.1)", border: "rgba(255,90,90,.35)", text: "#ffb0b0" }
      : tone === "good"
      ? { bg: "rgba(25,224,138,.1)", border: "rgba(25,224,138,.35)", text: "#7fe8bd" }
      : { bg: "rgba(123,140,244,.1)", border: "rgba(123,140,244,.35)", text: "#bcc6ff" };
  return (
    <div style={{ margin: "0 0 18px", padding: "13px 16px", borderRadius: 12, background: c.bg, border: `1px solid ${c.border}` }}>
      <div style={{ font: `600 13px/1.6 var(--font-archivo,'Archivo',sans-serif)`, color: c.text }}>{children}</div>
    </div>
  );
}

// ── Documentation content ────────────────────────────────────────────────────

export const DOC_GROUPS: DocGroup[] = [
  {
    label: "Getting Started",
    sections: [
      {
        id: "introduction",
        title: "Introduction",
        body: (
          <>
            <Lead>
              <Strong>Legends of the Mempool</Strong> is a browser-based, crypto-native trading card game. Build a
              30-card deck, pick a Hero, and battle other players (or the AI) in fast, Hearthstone-style turns. Every
              card, keyword, and joke is drawn from real tokens, protocols, memes, and Crypto Twitter culture.
            </Lead>
            <P>
              You collect cards from booster packs, craft the ones you want, trade on a player marketplace, and climb a
              ranked ladder across six factions. This guide explains everything — how matches work, how the economy runs,
              and how to go from a fresh account to a competitive deck.
            </P>
            <Callout tone="info">
              New here? Jump to <Strong>Your First Session</Strong> for a step-by-step start, or{" "}
              <Strong>How a Match Works</Strong> to learn the rules.
            </Callout>
          </>
        ),
      },
      {
        id: "account-wallet",
        title: "Account & Wallet",
        body: (
          <>
            <P>
              Your <Strong>Solana wallet is your account</Strong>. There is no email or password — you sign in by
              approving a login message with your wallet. Your username, collection, decks, fragments, rank, and progress
              are all tied to that wallet address.
            </P>
            <H3>Playing the game</H3>
            <P>
              Legends of the Mempool is token-gated. To enter matchmaking and the full app, your connected wallet must
              hold the minimum amount of <Frag>$MEMPOOL</Frag>. You can always read these docs without a wallet — the
              gate only applies to playing.
            </P>
            <H3>What saves automatically</H3>
            <UL>
              <LI>Username and profile</LI>
              <LI>Your card collection and crafted cards</LI>
              <LI>Saved decks</LI>
              <LI>Fragment balance and unopened packs</LI>
              <LI>Rank, ladder points, and season record</LI>
              <LI>Daily quest progress</LI>
            </UL>
            <Callout tone="warn">
              Stay safe: the game only ever asks your wallet to <Strong>sign a login message</Strong> or approve a
              marketplace transaction you started. Never paste your seed phrase into any popup.
            </Callout>
          </>
        ),
      },
      {
        id: "first-session",
        title: "Your First Session",
        body: (
          <>
            <P>
              Every new account starts with <Strong>3 pre-built starter decks</Strong> and <Strong>5 booster packs</Strong>.
              The starter decks use only Common and Rare cards and are designed to teach the core mechanics.
            </P>
            <H3>Recommended first steps</H3>
            <UL>
              <LI>
                <Strong>Play a Practice game</Strong> vs the AI with a starter deck to learn the flow — no rewards, no
                risk.
              </LI>
              <LI>
                <Strong>Open your 5 packs</Strong> from the Packs screen to start building a collection.
              </LI>
              <LI>
                <Strong>Try Casual</Strong> against real players once you're comfortable — you earn fragments here.
              </LI>
              <LI>
                <Strong>Build your own deck</Strong> in the Deck Builder once you have enough cards, then take it to
                Ranked.
              </LI>
            </UL>
            <Table
              head={["Starter Deck", "Faction", "Hero", "Playstyle"]}
              rows={[
                ["HODL Gang", "Bitcoin", "Satoshi", "Defensive, outlast with big bodies"],
                ["Meme Machine", "Meme", "Elon", "High-variance, chaotic aggro"],
                ["Stablecoin Control", "Stable", "Circle CEO", "Draw, remove, grind out value"],
              ]}
            />
          </>
        ),
      },
    ],
  },
  {
    label: "Core Game",
    sections: [
      {
        id: "how-a-match-works",
        title: "How a Match Works",
        body: (
          <>
            <P>
              Two players each start at <Strong>30 HP</Strong>. You win by reducing the enemy Hero's HP to{" "}
              <Strong>0 or below</Strong>. Before the match, both players pick a Hero (which sets your Hero Power for the
              game) and mulligan their opening hand.
            </P>
            <H3>Opening hand & the Coin</H3>
            <UL>
              <LI>Player 1 (goes first) draws 3 cards.</LI>
              <LI>Player 2 (goes second) draws 4 cards and gets a free <Strong>Coin</Strong> (0-cost: gain 1 Gas this turn only) to offset the disadvantage.</LI>
              <LI>During the <Strong>mulligan</Strong>, swap back any cards you don't like for fresh draws before turn 1.</LI>
            </UL>
            <P>
              If your deck runs out of cards, you take <Strong>Fatigue</Strong> damage each draw — 1, then 2, then 3, and
              so on — straight to your Hero.
            </P>
          </>
        ),
      },
      {
        id: "turns-gas",
        title: "Turns & Gas",
        body: (
          <>
            <P>
              <Strong>Gas</Strong> is your mana. You start with 0 and gain <Strong>+1 permanent Gas crystal</Strong> at
              the start of every turn, up to a maximum of <Strong>10</Strong>. Unspent Gas does not carry over.
            </P>
            <H3>The four phases of a turn</H3>
            <UL>
              <LI><Strong>Pump Phase</Strong> — gain and refill Gas; "start of turn" effects trigger; summoning sickness wears off.</LI>
              <LI><Strong>Draw Phase</Strong> — draw 1 card (or take Fatigue if empty).</LI>
              <LI><Strong>Main Phase</Strong> — play cards, attack, use your Hero Power, and tap Locations in any order.</LI>
              <LI><Strong>End Phase</Strong> — "end of turn" effects trigger; discard down to 10 cards if over the hand limit.</LI>
            </UL>
            <H3>Hero Power</H3>
            <P>
              Every Hero has a <Strong>Hero Power</Strong> you can use <Strong>once per turn</Strong> for{" "}
              <Strong>2 Gas</Strong> by default. It's a reliable source of value when you have spare Gas.
            </P>
          </>
        ),
      },
      {
        id: "combat",
        title: "Combat",
        body: (
          <>
            <P>
              Minions attack <Strong>once per turn</Strong>. A minion can't attack the turn it's played unless it has{" "}
              <Strong>Ape In</Strong> (Charge). When a minion attacks another minion, <Strong>both deal their Attack to
              each other</Strong> simultaneously. Attacking a Hero only damages the Hero.
            </P>
            <H3>Damage resolution order</H3>
            <UL>
              <LI>If the target has <Strong>Moon Shot</Strong> (Divine Shield), the first hit is fully absorbed and the shield breaks.</LI>
              <LI>Otherwise damage is applied; a minion at 0 HP dies and goes to the burn pile (triggering Rekt).</LI>
              <LI>If a Hero hits 0 HP, that player loses immediately.</LI>
            </UL>
            <H3>Taunt, Armor & Weapons</H3>
            <UL>
              <LI><Strong>HODL</Strong> (Taunt) minions must be attacked before anything else behind them.</LI>
              <LI><Strong>Armor</Strong> absorbs damage before HP and does not regenerate between turns.</LI>
              <LI><Strong>Weapons</Strong> give your Hero Attack and lose 1 Durability per Hero attack; they break at 0.</LI>
            </UL>
            <H3>The board</H3>
            <Table
              head={["Zone", "Limit"]}
              rows={[
                ["Minions per side", "7"],
                ["Locations per side", "1"],
                ["Weapons equipped", "1 (a new weapon replaces the old)"],
                ["Hand size", "10 (excess discarded at end of turn)"],
              ]}
            />
          </>
        ),
      },
      {
        id: "card-types",
        title: "Card Types",
        body: (
          <>
            <P>There are five card types. The type determines the rules that apply.</P>
            <Table
              head={["Type", "What it does"]}
              rows={[
                [<Strong key="m">Minion</Strong>, "Placed on the board, attacks and defends. Has Attack and Health. Max 7 per side."],
                [<Strong key="s">Spell</Strong>, "One-time effect that resolves immediately, then goes to the burn pile."],
                [<Strong key="w">Weapon</Strong>, "Equips to your Hero for Attack. Loses Durability per attack; breaks at 0. One at a time."],
                [<Strong key="l">Location</Strong>, "Persistent board card with a reusable effect. Tap once per turn to spend 1 Durability."],
                [<Strong key="h">Hero</Strong>, "Replaces your Hero mid-game with a new Hero Power and bonus armor. Max 1 per deck."],
              ]}
            />
            <P>
              Minions can also have a <Strong>tribe</Strong> (Token, Degen, Protocol, KOL, Gear, etc.) used by synergy
              effects like "give all Token minions +1/+1".
            </P>
          </>
        ),
      },
      {
        id: "keywords",
        title: "Keywords",
        body: (
          <>
            <P>
              Keywords are the crypto-flavored abilities printed on cards. Here are the core ones you'll see most often:
            </P>
            <Table
              head={["Keyword", "What it means"]}
              rows={[
                [<Strong key="a">HODL</Strong>, "Taunt — enemies must attack this minion first."],
                [<Strong key="b">Ape In</Strong>, "Charge — can attack the turn it's played."],
                [<Strong key="c">Pump:</Strong>, "Battlecry — an effect that fires when you play the card from hand."],
                [<Strong key="d">Rekt:</Strong>, "Deathrattle — an effect that fires when the card dies."],
                [<Strong key="e">Moon Shot</Strong>, "Divine Shield — absorbs the first instance of damage."],
                [<Strong key="f">DeFi</Strong>, "Lifesteal — damage this card deals also heals your Hero."],
                [<Strong key="g">Fork:</Strong>, "Discover — choose one of three offered cards."],
                [<Strong key="h">Airdrop:</Strong>, "Get a free card from a pool added straight to your hand."],
                [<Strong key="i">Smart Contract</Strong>, "Secret — a hidden spell that triggers on your opponent's turn."],
                [<Strong key="j">Flash Loan</Strong>, "Echo — after playing, a copy is added to hand costing (1) more."],
                [<Strong key="k">Rug Pull</Strong>, "Instantly destroys a target, bypassing Health and most protections."],
              ]}
            />
            <Callout tone="info">
              <Strong>Silence</Strong> removes a minion's keywords and text. Effects that say "destroy" (Rug Pull) are not
              damage, so <Strong>Moon Shot</Strong> won't stop them.
            </Callout>
          </>
        ),
      },
    ],
  },
  {
    label: "Factions & Decks",
    sections: [
      {
        id: "factions",
        title: "The Six Factions",
        body: (
          <>
            <P>
              Every card belongs to one of six factions. Building a deck from a single faction (Degen cards are neutral
              and always allowed) activates that faction's <Strong>Faction Bonus</Strong>.
            </P>
            <Table
              head={["Faction", "Identity", "Faction Bonus (pure deck)"]}
              rows={[
                [<Strong key="1" >Bitcoin</Strong>, "Slow, tanky, defensive. HODL & value.", "Start with 5 Armor."],
                [<Strong key="2">Ethereum</Strong>, "Gas manipulation & Secrets. Reactive control.", "Your first spell each turn costs (1) less."],
                [<Strong key="3">Solana</Strong>, "Fast, cheap swarm aggro.", "The first minion you play each turn has Ape In."],
                [<Strong key="4">Meme</Strong>, "Chaos & RNG. Maximum variance.", "Start of turn coin flip: draw a card, or free Hero Power."],
                [<Strong key="5">Stable</Strong>, "Control, card draw, board clears.", "Start with 1 extra card in your opening hand."],
                [<Strong key="6">Degen</Strong>, "Wildcard & self-damage payoffs.", "Faction-neutral — mixes into any deck without breaking the bonus."],
              ]}
            />
            <Callout tone="info">
              <Strong>Degen cards are neutral.</Strong> A "pure Bitcoin" deck can include Degen cards and still keep the
              Bitcoin bonus. Only mixing two <em>non-Degen</em> factions removes the bonus.
            </Callout>
          </>
        ),
      },
      {
        id: "deck-building",
        title: "Deck Building",
        body: (
          <>
            <P>
              A deck is exactly <Strong>30 cards</Strong> plus a Hero (chosen separately, not counted in the 30). Copy
              limits depend on rarity:
            </P>
            <Table
              head={["Rarity", "Max copies per deck"]}
              rows={[
                ["Common", "4"],
                ["Rare", "3"],
                ["Epic", "2"],
                ["Legendary", "1"],
                ["Hero card", "1"],
              ]}
            />
            <H3>Rules the builder enforces</H3>
            <UL>
              <LI>Exactly 30 cards, no more, no less.</LI>
              <LI>Copy limits respected per rarity; at most 1 Hero card.</LI>
              <LI>You must own every card you put in the deck.</LI>
            </UL>
            <P>You can view your decks and build new ones from the <Strong>Collection</Strong> / Deck Builder screen.</P>
          </>
        ),
      },
      {
        id: "heroes",
        title: "Heroes & Hero Powers",
        body: (
          <>
            <P>
              You pick a Hero before each match; it sets your <Strong>Hero Power</Strong> for the whole game. Everyone
              starts with the six default Heroes (one per faction). More Heroes unlock as Hero cards from packs.
            </P>
            <Table
              head={["Hero", "Faction", "Hero Power (2 Gas)"]}
              rows={[
                ["Satoshi", "Bitcoin", "Mint — add a 1/1 Token to your hand"],
                ["Vitalik", "Ethereum", "Gas War — your next spell this turn costs (1) less"],
                ["Toly", "Solana", "Turbo — give a friendly minion +2 Attack this turn"],
                ["Elon", "Meme", "Tweet — add a random Meme spell to your hand"],
                ["Circle CEO", "Stable", "Yield — restore HP to your Hero"],
                ["Anon", "Degen", "Ape — deal damage to your own Hero, then draw a card"],
              ]}
            />
            <P>
              Playing a <Strong>Hero card</Strong> mid-game replaces your Hero Power with a stronger one and grants bonus
              armor (your current HP carries over).
            </P>
          </>
        ),
      },
    ],
  },
  {
    label: "Game Modes",
    sections: [
      {
        id: "game-modes",
        title: "Practice, Casual & Ranked",
        body: (
          <>
            <Table
              head={["Mode", "Opponent", "Rewards", "Notes"]}
              rows={[
                [<Strong key="p">Practice</Strong>, "AI", "None", "Learn decks risk-free. Does not progress quests."],
                [<Strong key="c">Casual</Strong>, "Real players", "Fragments", "No ladder impact. Great for testing decks."],
                [<Strong key="r">Ranked</Strong>, "Real players", "Fragments + ladder points", "Requires a custom (non-starter) deck."],
              ]}
            />
            <Callout tone="warn">
              <Strong>Daily quests and fragment rewards only count in Casual and Ranked.</Strong> Practice games against
              the AI never grant fragments or quest progress.
            </Callout>
          </>
        ),
      },
      {
        id: "ranked-ladder",
        title: "Ranked Ladder",
        body: (
          <>
            <P>
              Ranked wins earn ladder points and climb you through the tiers. You need a <Strong>custom deck</Strong>{" "}
              (starter decks can't queue Ranked).
            </P>
            <Table
              head={["Tier", "Order"]}
              rows={[
                ["Bronze", "1"],
                ["Silver", "2"],
                ["Gold", "3"],
                ["Platinum", "4"],
                ["Diamond", "5"],
                ["Mempool (top tier)", "6"],
              ]}
            />
            <P>Winning gains ladder points; losing loses some (points never drop below 0). Your season record tracks wins and losses.</P>
          </>
        ),
      },
    ],
  },
  {
    label: "Economy",
    sections: [
      {
        id: "fragments",
        title: "Fragments (Frags)",
        body: (
          <>
            <P>
              <Frag>Fragments</Frag> are the in-game soft currency. You spend them on packs and crafting cards, and you
              earn them from quests, matches, and dusting cards you don't need.
            </P>
            <H3>Ways to earn fragments</H3>
            <UL>
              <LI><Strong>Daily quests</Strong> — 15 to 60 frags each (Casual/Ranked only).</LI>
              <LI><Strong>Match rewards</Strong> — small payouts for playing Casual and Ranked.</LI>
              <LI><Strong>Dusting cards</Strong> — break down extra cards into frags.</LI>
            </UL>
          </>
        ),
      },
      {
        id: "packs",
        title: "Packs & Drop Rates",
        body: (
          <>
            <P>Each booster contains <Strong>5 cards</Strong>. Two packs are sold for fragments:</P>
            <Table
              head={["Pack", "Cost", "Contains"]}
              rows={[
                [<Strong key="s">Standard Pack</Strong>, <><Frag>100</Frag> frags</>, "Default set cards — any faction, any rarity. Cannot drop Genesis Drop exclusives."],
                [<Strong key="g">Genesis Drop Pack</Strong>, <><Frag>150</Frag> frags</>, "Genesis Drop exclusives only — cards not available in Standard packs."],
              ]}
            />
            <H3>Legendary odds</H3>
            <UL>
              <LI><Strong>Standard Pack</Strong> — roughly <Strong>1 Legendary per 50 packs</Strong> on average.</LI>
              <LI><Strong>Genesis Drop Pack</Strong> — roughly <Strong>1 Legendary per 100 packs</Strong> (rarer, more prestigious).</LI>
            </UL>
            <P>
              Every card in a pack is rolled independently across Common, Rare, Epic, and Legendary. Odds are long-run
              averages — you'll have lucky and dry streaks.
            </P>
            <Callout tone="info">
              You can buy multiple packs at once and open them anytime from the <Strong>Packs</Strong> screen.
            </Callout>
          </>
        ),
      },
      {
        id: "dusting-crafting",
        title: "Dusting & Crafting",
        body: (
          <>
            <P>
              Got duplicates or cards you'll never play? <Strong>Dust</Strong> them for fragments. Want a specific card?{" "}
              <Strong>Craft</Strong> it directly by spending fragments — no luck required.
            </P>
            <P>
              Dust value and craft cost scale with rarity: higher-rarity cards give more dust and cost more to craft. You
              never lose cards that are in a saved deck by accident — the collection screen shows what's safe to dust.
            </P>
          </>
        ),
      },
      {
        id: "marketplace",
        title: "Buying & Selling Cards",
        body: (
          <>
            <P>
              The <Strong>Marketplace</Strong> is a player-driven market where you can buy and sell individual cards and
              packs for <Frag>$MEMPOOL</Frag>, paid on-chain. Prices are set by other players — there's no house price.
            </P>
            <H3>Selling</H3>
            <UL>
              <LI>List a card or pack you own and set your asking price in $MEMPOOL.</LI>
              <LI>When someone buys it, the item transfers to them and you receive the tokens.</LI>
              <LI>You can cancel active listings you haven't sold yet.</LI>
            </UL>
            <H3>Buying</H3>
            <UL>
              <LI>Browse the lowest listings per card or pack.</LI>
              <LI>Reserve a listing, then confirm the on-chain payment to complete the purchase.</LI>
              <LI>A short cooldown protects against double-buys and race conditions.</LI>
            </UL>
            <Callout tone="info">
              Fragments (soft currency) buy packs from the shop; <Frag>$MEMPOOL</Frag> (on-chain token) is used for the
              player marketplace.
            </Callout>
          </>
        ),
      },
    ],
  },
  {
    label: "Progression",
    sections: [
      {
        id: "daily-quests",
        title: "Daily Quests",
        body: (
          <>
            <P>
              Daily quests reset every day (UTC) and reward <Strong>fragments only</Strong>. They progress in{" "}
              <Strong>Casual and Ranked</Strong> games — Practice vs AI does not count.
            </P>
            <Table
              head={["Quest", "Reward"]}
              rows={[
                ["Log in today", <><Frag>15</Frag> frags</>],
                ["Win 3 games (Casual or Ranked)", <><Frag>30</Frag> frags</>],
                ["Destroy 15 minions (Casual or Ranked)", <><Frag>60</Frag> frags</>],
              ]}
            />
            <P>Claim completed quests from the dashboard to collect the fragments.</P>
          </>
        ),
      },
      {
        id: "match-rewards",
        title: "Match Rewards & Fair Play",
        body: (
          <>
            <P>Playing real opponents pays out fragments per match:</P>
            <Table
              head={["Mode", "Winner", "Loser"]}
              rows={[
                [<Strong key="r">Ranked</Strong>, <><Frag>5</Frag> frags</>, <><Frag>2</Frag> frags</>],
                [<Strong key="c">Casual</Strong>, <><Frag>2</Frag> frags</>, <Frag>0</Frag>],
                [<Strong key="p">Practice (vs AI)</Strong>, <Frag>0</Frag>, <Frag>0</Frag>],
              ]}
            />
            <H3>Anti-abuse</H3>
            <UL>
              <LI><Strong>Surrendering early</Strong> (before turn 4) grants no fragments or quest progress to either player.</LI>
              <LI>A player who surrenders never receives fragments for that match — even in Ranked.</LI>
              <LI>Only Casual and Ranked games update rank, season stats, and quests.</LI>
            </UL>
            <Callout tone="good">
              Play matches out normally and you'll never be affected — these rules only target instant-surrender farming.
            </Callout>
          </>
        ),
      },
    ],
  },
  {
    label: "Reference",
    sections: [
      {
        id: "faq",
        title: "FAQ & Safety",
        body: (
          <>
            <H3>Do I need tokens to try the game?</H3>
            <P>You can read these docs freely. To play matches, your wallet must hold the minimum $MEMPOOL.</P>
            <H3>Can I get cards without spending real money?</H3>
            <P>Yes — earn fragments from quests and matches, then buy packs or craft cards directly.</P>
            <H3>What's the difference between fragments and $MEMPOOL?</H3>
            <P>
              Fragments are the in-game soft currency (packs, crafting). $MEMPOOL is the on-chain token used for access
              and the player marketplace.
            </P>
            <H3>Will the game ever ask for my seed phrase?</H3>
            <P>
              Never. It only requests wallet signatures for login and marketplace transactions you initiate. Never enter
              a seed phrase into any popup.
            </P>
          </>
        ),
      },
    ],
  },
];

/** Flat list of all sections in sidebar order (for scroll-spy). */
export const ALL_SECTIONS: DocSection[] = DOC_GROUPS.flatMap((g) => g.sections);
