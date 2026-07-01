/** Product branding — Legends of the Mempool */
export const BRAND = {
  fullName: "Legends of the Mempool",
  shortName: "Mempool",
  ticker: "$MEMPOOL",
  tagline: "Where legends wait.",
  logoUrl: "/logo.png",
  authTokenKey: "mempool_token",
  legacyAuthTokenKey: "degen_token",
} as const;

export function formatRankTier(tier: string): string {
  if (tier === "degen") return "Mempool";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
