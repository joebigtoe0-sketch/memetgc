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

  // ── Genesis Drop Pack (exclusive) ─────────────────────────────────────────
  degen_ansem_black_bull:
    "a muscular black bull trader in a dark hoodie and sunglasses, charging forward through a neon crypto trading floor, golden horns glowing, legendary KOL presence — intentionally human",
  solana_pump_fun_launchpad:
    "a glowing green rocket launchpad platform made of circuit boards and coin slots, tiny minion silhouettes blasting off from its surface, no characters — the launchpad itself is the subject",
  degen_the_trenches:
    "a chaotic battlefield trench carved into a glowing chart canyon, minion silhouettes clashing amid dust and fake ticker symbols, apocalyptic degen energy",
  degen_weekly_airdrop:
    "golden parachute crates raining from a creator-fee vault in the sky onto cheering minion silhouettes below, pink and green confetti tokens",
  stable_whale_pod:
    "a pod of three serene teal crystal whales swimming in formation above tiny token fish, calm dominant presence",
  degen_blknoiz06:
    "a sharp-eyed human KOL in headphones at a glowing trading desk, charts reflected in sunglasses, legendary market-mover energy — intentionally human",
  meme_copycat_token:
    "a glitchy mirror-frog creature copying the silhouette of a larger minion behind it, same pose different colors, uncanny meme energy",
  solana_pumpswap:
    "a pair of glowing swap arrows rotating around a minion stat orb on a solana-green trading terminal, mechanical and precise",
  stable_liquidity_pod:
    "a teal healing pod chamber with pipes feeding HP glow into a hero silhouette above, community-owned vault aesthetic",
  meme_influencer_call:
    "a megaphone bird creature blasting a hype shockwave at a minion, tweet icons spiraling outward",
  bitcoin_holder_distribution:
    "orange coin slices being distributed from a giant bitcoin wheel to a crowd of small holder silhouettes",
  solana_dex_sniper:
    "a sleek green sniper-bot creature with scope eyes perched on a DEX order book, lightning-fast pose",
  degen_concentration_risk:
    "a few enormous wallets towering over a field of tiny retail silhouettes, red risk lightning between them",
  degen_paper_hands_panic:
    "a panicked paper goblin sprinting back toward its owner's hand portal, cards flying loose",
  stable_on_chain_auditor:
    "a stern magnifying-glass automaton scanning a suspicious contract scroll, teal warning flags popping up",
  meme_meme_coin_swarm:
    "a swarm of tiny identical frog coins pouring out of a cracked meme crate, overwhelming the frame",
  bitcoin_bull_run_energy:
    "a minion silhouette charging forward wrapped in orange bull-energy flames and a HODL shield aura",
  solana_solana_validator:
    "a compact validator node robot stamping gas discounts onto the top card of a deck stack, green throughput lines",
  degen_thin_liquidity:
    "a narrow liquidity pool bridge cracking under damage, slippage arrows bouncing hero and minion",
  bitcoin_diamond_conviction:
    "a stubborn small token golem with diamond fists and feet cemented to the ground, refusing to budge",

  // ── Genesis Drop burn-pile expansion (10) ─────────────────────────────────
  degen_graveyard_crawler:
    "a shadowy degen creature crawling out of a pit of burning cards and ash, clawed hands gripping the edge, eyes glowing red, half emerged from the darkness below",
  bitcoin_ansems_wallet:
    "an enormous ancient stone vault door slightly ajar, warm gold light spilling out from within, ancient bitcoin runes carved into the stone, half buried in ocean floor sand",
  degen_second_chance:
    "a glowing resurrection portal opening above a burn pile, a minion silhouette leaping through with a moon-shot shield aura, hopeful degen energy",
  meme_dead_cat_bounce:
    "a cartoon cat minion springing back upright from a grave-shaped chart dip, eyes half closed pretending to nap, pink bounce arrows underneath",
  degen_burn_pile_raider:
    "a scavenger rat trader rummaging through a smoldering burn pile of cards, pulling out a high-cost minion card with a greedy grin",
  ethereum_recycled_alpha:
    "a ghostly indigo spell scroll being copied from a burn pile furnace, duplicate alpha call unfurling with extra gas runes",
  stable_ghost_liquidity:
    "a translucent teal liquidity spirit phasing in and out of existence, DeFi glow around it, a faint duplicate fading into a burn pile below",
  degen_mempool_drifter:
    "a laid-back hooded drifter lounging on an unconfirmed transaction bubble, peeking at a single card floating in memepool fog",
  bitcoin_ash_collector:
    "a small ash-covered token golem sweeping up embers from fallen minion silhouettes, growing slightly larger with each pile of ash",
  ethereum_lost_transaction:
    "a flickering pending transaction envelope spiraling from a burn pile back into a shuffled deck stack, block confirmation numbers counting up",

  // ── Default set expansion — Bitcoin (5) ───────────────────────────────────
  bitcoin_satoshis_disciple:
    "a young orange-hooded apprentice miner holding a glowing bitcoin pickaxe, eager and clueless but confident",
  bitcoin_hash_rate:
    "a chunky mining rig golem with spinning fan ears and a hash-rate dial for a belly, numbers climbing on its chest display",
  bitcoin_block_reward:
    "two freshly minted golden 1/1 token coins tumbling from a cracked block reward chute into an open hand silhouette",
  bitcoin_immutable_ledger:
    "a massive stone ledger golem with HODL shield stance, etched runes locking friendly minion stats in place behind it",
  bitcoin_the_genesis_block:
    "the original glowing genesis block altar with token minion spirits rising from a burn pile into waiting hands above",

  // ── Default set expansion — Ethereum (5) ──────────────────────────────────
  ethereum_smart_contract:
    "a self-contained indigo circuit cube automaton executing its own commands, smug glowing eyes, no master required",
  ethereum_layer_2:
    "a sleek roller-skating protocol sprite racing on a layer-2 bridge above a slower ethereum chain below, Ape In energy trails",
  ethereum_gas_refund:
    "a rare golden gas meter rolling backward, coins spilling back to a hand silhouette, cherubic refund aura",
  ethereum_mev_bot:
    "a predatory indigo front-running bot creature with multiple scope eyes, sniping spell casts and zapping an enemy hero",
  ethereum_the_merge:
    "all minions on a battlefield flattening into identical 2/2 silhouettes under a massive merge beam, keywords dissolving like smoke",

  // ── Default set expansion — Solana (5) ────────────────────────────────────
  solana_validator_node:
    "a compact green validator robot with a blinking online light, wobbling on one leg like uptime is optional",
  solana_speed_run:
    "a blur-speed degen creature sprinting past slower minions, green motion lines, reckless Ape In pose",
  solana_tps_surge:
    "a tidal wave of green transaction arrows boosting friendly minion silhouettes with +1 attack sparks",
  solana_jito_restaker:
    "a restaking robot priest stamping +1 attack blessings onto a random friendly minion each dawn",
  solana_network_outage:
    "enemy minions frozen in ice-cube error screens while a solana technician shrugs beside a maintenance sign",

  // ── Default set expansion — Meme (5) ──────────────────────────────────────
  meme_pepe_maxi:
    "a smug rare pepe frog wearing a fake limited-edition sash, winking like the rarity is definitely real",
  meme_shiba_squad:
    "a squad of three shiba inu soldiers in matching helmets marching in sync, 1 SHIB pride banners",
  meme_rug_radar:
    "a radar-dish frog scanning an opponent's hidden hand, copying one suspicious card into its own grip",
  meme_chaos_protocol:
    "minions from both sides tossed into a chaotic tornado and spat out randomly onto scrambled board slots",
  meme_wojak_eternal_degen:
    "a sweating wojak creature taking hits but grinning through pain, drawing cards from each survived blow, eternal cope energy",

  // ── Default set expansion — Stable (5) ────────────────────────────────────
  stable_audit_report:
    "a clipboard automaton stamping APPROVED on a suspicious contract, one nervous eye twitching",
  stable_treasury_reserve:
    "a plump teal vault piggy bank creature sitting on stacked reserves, pinky promise ribbon tied around it",
  stable_circuit_breaker:
    "a giant red market halt button slamming down, protective shield dome over a hero silhouette for one turn",
  stable_algo_stable:
    "an algorithmic balance scale golem adding armor plates when its hero side tips higher, smug until it wobbles",
  stable_black_swan:
    "a dark swan shadow crashing through the board, shattering high-attack minions, drawing a card from each wreck",

  // ── Default set expansion — Degen (5) ─────────────────────────────────────
  degen_floor_trader:
    "a desperate floor-buying goblin catching falling knives and coins in a deepening pit chart",
  degen_leverage_king:
    "a reckless leverage gladiator with 100x tattooed on armor, huge attack tiny health, no stop loss banner",
  degen_fomo_buy:
    "a minion injected with a temporary +3 attack syringe, health draining at turn end, panic excitement face",
  degen_liquidated:
    "a liquidation hammer smashing a low-health minion while shock damage ricochets into the friendly hero",
  degen_degen_god:
    "an epic KOL deity figure taking self-damage lightning and drawing three cards from the pain, legendary degen aura",
};
