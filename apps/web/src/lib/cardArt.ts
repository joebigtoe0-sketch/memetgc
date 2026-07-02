/** Resolve card art URL — falls back to the static JPG path by card id. */
export function cardArtUrl(cardId: string, artUrl?: string | null): string {
  const trimmed = artUrl?.trim();
  if (trimmed) {
    // Legacy DB/manifest entries may still reference .png after the JPG migration.
    if (trimmed.endsWith(".png")) return trimmed.replace(/\.png$/, ".jpg");
    return trimmed;
  }
  return `/card-art/${cardId}.jpg`;
}
