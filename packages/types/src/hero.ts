import type { Faction, HeroPower } from "./card.js";

export interface Hero {
  id: string;
  name: string;
  faction: Faction;
  hp: number;
  armor: number;
  hero_power: HeroPower;
  art_url?: string;
  unlock_method: "default" | "booster_pack" | "season_reward" | "purchase";
  collectible: boolean;
  description: string;
}
