export type CardType = "minion" | "spell" | "weapon" | "hero" | "location";
export type Faction = "bitcoin" | "ethereum" | "solana" | "meme" | "stable" | "degen";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Keyword {
  id: string;
  display: string;
  params?: Record<string, unknown>;
}

export type EffectTrigger =
  | "on_play"
  | "on_death"
  | "on_attack"
  | "on_take_damage"
  | "start_of_turn"
  | "end_of_turn"
  | "on_secret_trigger"
  | "passive"
  | "on_tap"
  | "on_equip";

export type EffectTarget =
  | "self"
  | "hero_friendly"
  | "hero_enemy"
  | "any_hero"
  | "minion_friendly"
  | "minion_enemy"
  | "any_minion"
  | "all_minions_friendly"
  | "all_minions_enemy"
  | "all_minions"
  | "chosen_minion"
  | "random_minion_enemy"
  | "random_minion_friendly"
  | "chosen_any"
  | "all_characters"
  | "random_card_in_hand_friendly";

export type EffectAction =
  | "deal_damage"
  | "heal"
  | "buff_attack"
  | "buff_health"
  | "buff_attack_health"
  | "destroy"
  | "silence"
  | "draw_cards"
  | "add_to_hand"
  | "summon_minion"
  | "give_keyword"
  | "give_divine_shield"
  | "transform"
  | "modify_cost"
  | "give_armor"
  | "return_to_hand"
  | "shuffle_into_deck"
  | "copy_to_hand"
  | "immune_to";

export interface CardEffect {
  trigger: EffectTrigger;
  target: EffectTarget;
  action: EffectAction;
  condition?: EffectCondition;
  params?: Record<string, unknown>;
}

export interface EffectCondition {
  type: string;
  params?: Record<string, unknown>;
}

export interface HeroPower {
  id: string;
  name: string;
  cost: number;
  description: string;
  effect_type: string;
  effect_params: Record<string, unknown>;
  art_url?: string;
}

export interface Card {
  id: string;
  name: string;
  set: string;
  type: CardType;
  faction: Faction;
  rarity: Rarity;
  tribe?: string;
  cost: number;
  attack?: number;
  health?: number;
  durability?: number;
  armor?: number;
  text?: string;
  flavor_text?: string;
  art_label?: string;
  keywords?: Keyword[];
  effects?: CardEffect[];
  hero_power?: HeroPower;
  art_url?: string;
  card_back?: string;
  is_animated?: boolean;
  nft_token_id?: string;
  collectible: boolean;
  craftable: boolean;
  dust_value: number;
  craft_cost: number;
  created_at?: string;
}
