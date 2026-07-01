export const FADE_MS = 1500;
export const DEFAULT_MASTER_VOLUME = 0.4;

export type MusicTrack =
  | "menu"
  | "collection"
  | "pack_opening"
  | "pack_opening_genesis"
  | "game_normal"
  | "game_winning"
  | "game_losing"
  | "victory"
  | "defeat";

export const LOOPING_TRACKS = new Set<MusicTrack>([
  "menu",
  "collection",
  "game_normal",
  "game_winning",
  "game_losing",
]);

export const MUSIC_VOLUMES: Record<MusicTrack, number> = {
  menu: 0.45,
  collection: 0.35,
  pack_opening: 0.6,
  pack_opening_genesis: 0.7,
  game_normal: 0.3,
  game_winning: 0.35,
  game_losing: 0.35,
  victory: 0.6,
  defeat: 0.5,
};

export const ONE_SHOT_FADE_OUT_MS = 15_000;
