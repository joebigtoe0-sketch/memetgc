/**
 * Hand-written visual briefs for card art (Option A).
 * One sentence per card — WHAT is depicted, not art style.
 *
 * Subject rules: Bitcoin faction may use humans OR creatures.
 * Other factions: no humans except Hero + Legendary KOL (creatures/objects only).
 *
 * @see scripts/card-art/cards.json (12 sample cards)
 * @see scripts/card-art/src/creature-rules.ts
 */
export const ART_LABELS: Record<string, string> = {
  // ── 12 sample cards (see cards.json) ──────────────────────────────────────
  bitcoin_diamond_hands:
    "a massive ancient stone golem with fists and forearms made of solid glowing diamond, planted immovably into the ground, cracks of orange light running through its granite body, expression of absolute stubborn defiance",
  bitcoin_paper_hands:
    "a small scrawny goblin made entirely of crumpled paper, eyes wide with panic, mid-sprint, paper sheets peeling off its body as it flees, ink stains and red loss numbers printed across its skin",
  meme_moon_boy:
    "a wide-eyed cartoon frog in a tiny rocket suit, mid-leap upward toward the moon, tongue out in excitement, pink and yellow energy trails behind it, papers and coins flying in its wake",
  degen_rug_pull:
    "a wiry rat creature in a top hat and tiny showman coat, yanking a glowing rug from beneath a stack of unsuspecting minion silhouettes, grinning maniacally, gold coins scattering everywhere",
  meme_to_the_moon:
    "a wild cartoon rabbit creature strapped to a giant pink rocket, fur blowing back at extreme speed, massive grin, one paw punching skyward, the rocket leaving a trail of meme symbols and moon icons",
  meme_pump_it:
    "a small crystalline elemental spirit shaped like a geometric shard, both tiny arms flexed upward, glowing cyan energy beams shooting from its fists into a nearby creature, boosting it visibly",
  bitcoin_cold_wallet:
    "a sturdy iron lockbox creature with stubby legs and a combination dial for a face, arms crossed firmly, a faint teal force field shimmering around its body, immovably calm",
  bitcoin_hardware_ledger:
    "a stocky dwarf-like vault guardian wielding an enormous ancient ledger book as a weapon, runes and blockchain hashes glowing gold across its stone armor, expression fierce and protective",
  ethereum_the_exchange:
    "a grand cathedral-like structure built from glowing indigo circuit boards and crystal spires, cards and tokens flowing in and out of its arched doorways like a living marketplace, no characters — the building itself is the subject",
  card_hero_satoshi:
    "a mysterious cloaked human figure, face completely hidden in shadow beneath a hood, sitting cross-legged on a floating genesis block, warm gold light emanating from the block below, iconic and legendary presence — this one is intentionally human and anonymous",

  // Future sample cards (not in seed yet)
  ethereum_gas_goblin:
    "a bloated smug goblin with glowing indigo-blue circuit patterns etched across its skin, sitting cross-legged mid-air, surrounded by floating toll gates and gas meter dials it controls with stubby fingers",
  stable_the_whale:
    "an enormous ancient whale creature made of solid teal crystal and marble, floating serenely above a miniature battlefield, its sheer presence causing all smaller creatures below to cower, calm and unbothered",

  // ── Bitcoin (remaining) ───────────────────────────────────────────────────
  // Kept as-is — user-approved generations
  bitcoin_baby_hodl:
    "a stubborn toddler in an oversized orange hoodie hugging a glowing bitcoin coin like a teddy bear, feet planted refusing to move",
  bitcoin_block_defender:
    "a broad vault guard in orange armor holding a massive golden bitcoin shield, feet planted wide blocking an incoming shockwave",

  bitcoin_mining_rig:
    "an anthropomorphic mining rig robot with whirring GPU fans for ears, gold coins tumbling from exhaust vents",
  bitcoin_stack_sats:
    "a stout granite dwarf golem stacking glowing golden sat coins into a towering pillar, orange runes pulsing across its stone arms as a shimmering shield forms",
  bitcoin_hodl_the_line:
    "a line of armored dwarf vault guardians linked shield-to-shield on a cracked ledge, orange banners and glowing BTC runes etched on their stone armor",
  bitcoin_hardware_security:
    "a minion-shaped crystal golem encased in a transparent hardware-wallet shell like armor, calm glowing eyes, soft rocket runes behind its shoulders",
  bitcoin_maxi:
    "a massive orange stone golem preacher with a blazing bitcoin rune carved into its granite forehead, roaring at crumbling altcoin idol statues",
  bitcoin_the_halving:
    "cosmic rune-scissors slicing a glowing bitcoin block in half, golden supply particles splitting and fading into darkness",

  // ── Meme ──────────────────────────────────────────────────────────────────
  meme_doge_gang:
    "a trio of shiba inu dogs in sunglasses doing a hype handshake, tails wagging, much-wow energy",
  meme_pepe_deploy:
    "a green frog soldier parachuting from a pink hype cloud, gripping a deployment crate marked with a rare pepe stamp",
  meme_hype_wave:
    "a giant pink social-media wave cresting over tiny minions surfing it, retweet icons swirling in the foam",
  meme_diamond_frog:
    "a smug pepe frog with diamond-encrusted skin flipping a golden coin mid-ribbit, one eyebrow raised",
  meme_viral_tweet:
    "a smartphone screen exploding into retweet birds and fire emojis, shockwave rippling through the scene",
  meme_elon_shill:
    "a hype-beast chimera creature with a rocket tail and megaphone snout atop a pile of meme coins, chaotic pink-yellow energy radiating",
  meme_100x_bet:
    "a wild-eyed glitching rat beast yanking a slot-machine lever labeled 100x, volatility lightning crackling around spinning meme reels",

  // ── Stable ──────────────────────────────────────────────────────────────────
  stable_risk_manager:
    "a sentient filing cabinet creature balancing spreadsheets on a tightrope over a dark abyss, teal drawer handles trembling",
  stable_yield_farmer:
    "a clockwork automaton farmer tending rows of glowing APY-percentage plants in a sterile teal greenhouse",
  stable_liquidation:
    "a judge's gavel golem smashing a tiny overleveraged minion into teal digital shards and coin fragments",
  stable_flash_crash:
    "a red downward chart arrow golem slamming into a battlefield like a meteor, minions scattering",
  stable_collateral:
    "a locked safe-deposit box creature chained to a glowing healing heart symbol, teal security seals intact",
  stable_peg_defence:
    "an iron vault door golem with a USD peg lock mechanism and a teal shield emblem, immovable stance",
  stable_stablecoin:
    "a perfectly symmetrical coin creature with a calm neutral face, hovering level without rising or falling",
  stable_dai_hard:
    "a stoic marble golem statue breaking silence chains from its mouth, knowledge scrolls unfurling outward",
  stable_reserve_protocol:
    "a corporate bank vault automaton pouring healing green liquid through infinite liquidity pipes into a glowing reservoir",
  stable_the_fed:
    "an imposing clockwork banker automaton at an infinite money printer, bills flooding the room in a teal-green torrent",
};
