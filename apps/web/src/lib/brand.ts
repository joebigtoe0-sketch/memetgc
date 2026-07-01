/** Product branding — Legends of the Memepool */
export const BRAND = {
  fullName: "Legends of the Memepool",
  shortName: "Memepool",
  ticker: "$MEMEPOOL",
  tagline: "From the depths, legends rise",
  logoUrl: "/logo.png",
  authTokenKey: "memepool_token",
  /** Older localStorage keys — still read on login for existing sessions */
  legacyAuthTokenKeys: ["mempool_token", "degen_token"] as const,
} as const;

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(BRAND.authTokenKey);
  if (token) return token;
  for (const key of BRAND.legacyAuthTokenKeys) {
    const legacy = localStorage.getItem(key);
    if (legacy) return legacy;
  }
  return null;
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BRAND.authTokenKey);
  for (const key of BRAND.legacyAuthTokenKeys) {
    localStorage.removeItem(key);
  }
}

export function formatRankTier(tier: string): string {
  if (tier === "degen") return "Memepool";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Auto-generated username prefixes — hide the input when the server assigned one */
export function isAutoUsername(username: string): boolean {
  return (
    username.startsWith("degen_") ||
    username.startsWith("mempool_") ||
    username.startsWith("memepool_")
  );
}
