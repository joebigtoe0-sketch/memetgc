/**
 * Card art preloader.
 *
 * Card art is served as static PNGs from `/card-art/{id}.png`. Without preloading,
 * every <img> mounts and fetches lazily, which makes art appear to "load again and
 * again" as cards enter the hand/board. We keep the decoded images alive in a module
 * cache so the browser serves them instantly on subsequent renders.
 */

import { FACTIONS, factionImageUrl } from "@/lib/factions";
import { cardArtUrl } from "@/lib/cardArt";

const cache = new Map<string, HTMLImageElement>();
let manifestLoaded = false;

function artUrl(id: string): string {
  return cardArtUrl(id);
}

/** Preload art for a specific set of card ids (idempotent). */
export function preloadCardArt(ids: Array<string | undefined | null>): void {
  if (typeof window === "undefined") return;
  for (const id of ids) {
    if (!id || cache.has(id)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = cardArtUrl(id);
    cache.set(id, img);
  }
}

/** Preload all faction logo PNGs (once). */
export function preloadFactionArt(): void {
  if (typeof window === "undefined") return;
  for (const id of FACTIONS) {
    const key = `faction:${id}`;
    if (cache.has(key)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = factionImageUrl(id);
    cache.set(key, img);
  }
}

/**
 * Preload the entire generated art set once, using the manifest written by the
 * art generator. Safe to call multiple times — only fetches the manifest once.
 */
export async function preloadAllCardArt(): Promise<void> {
  if (typeof window === "undefined") return;
  preloadFactionArt();
  if (manifestLoaded) return;
  manifestLoaded = true;
  try {
    const res = await fetch("/card-art/manifest.json", { cache: "no-store" });
    if (!res.ok) return;
    const manifest = (await res.json()) as Record<string, string>;
    preloadCardArt(Object.keys(manifest));
  } catch {
    // Manifest is optional; per-card preloading still covers visible cards.
    manifestLoaded = false;
  }
}
