/** Resolve card art URL — always falls back to the static PNG path by card id. */
export function cardArtUrl(cardId: string, artUrl?: string | null): string {
  const trimmed = artUrl?.trim();
  if (trimmed) return trimmed;
  return `/card-art/${cardId}.png`;
}
