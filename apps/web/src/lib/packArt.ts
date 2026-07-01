/** Booster pack artwork by pack type. */
export const PACK_ART: Record<string, string> = {
  standard: "/booster-packs/booster_default.png",
  season: "/booster-packs/booster_genesisdrop.png",
  legendary: "/booster-packs/booster_default.png",
};

export function packArtUrl(packType: string): string {
  return PACK_ART[packType] ?? PACK_ART.standard;
}
