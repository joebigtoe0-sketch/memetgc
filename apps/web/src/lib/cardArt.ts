/** Card ids whose art file on disk uses a different basename. */
const ART_FILE_ALIASES: Record<string, string> = {
  coin: "gas_token",
};

/** Resolve card art URL — falls back to the static JPG path by card id. */
export function cardArtUrl(cardId: string, artUrl?: string | null): string {
  const trimmed = artUrl?.trim();
  if (trimmed) {
    // Legacy DB/manifest entries may still reference .png after the JPG migration.
    if (trimmed.endsWith(".png")) return trimmed.replace(/\.png$/, ".jpg");
    return trimmed;
  }
  const fileBase = ART_FILE_ALIASES[cardId] ?? cardId;
  return `/card-art/${fileBase}.jpg`;
}
