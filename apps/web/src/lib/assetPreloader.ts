import { BRAND } from "@/lib/brand";
import { CARD_BACK_DEFAULT } from "@/lib/cardBacks";
import { FACTIONS, factionImageUrl } from "@/lib/factions";
import { ICONS } from "@/lib/icons";
import { PACK_ART } from "@/lib/packArt";
import { loadBoardManifest } from "@/lib/boards";
import { preloadCardArt, preloadFactionArt } from "@/lib/preloadArt";
import { SOUND_PATHS, preloadSoundsAsync } from "@/lib/sounds";

const SESSION_KEY = "memepool_assets_ready";

export interface PreloadProgress {
  loaded: number;
  total: number;
  phase: string;
  percent: number;
}

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (imageCache.has(url)) return Promise.resolve();

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const done = () => {
      imageCache.set(url, img);
      resolve();
    };
    img.onload = done;
    img.onerror = done;
    img.src = url;
    if (img.complete) done();
  });
}

async function loadImagesBatched(
  urls: string[],
  concurrency: number,
  onItem: () => void,
): Promise<void> {
  const unique = [...new Set(urls)];
  let index = 0;

  async function worker() {
    while (index < unique.length) {
      const i = index++;
      await loadImage(unique[i]!);
      onItem();
    }
  }

  const workers = Math.min(concurrency, unique.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

async function collectImageUrls(): Promise<string[]> {
  const urls: string[] = [
    BRAND.logoUrl,
    CARD_BACK_DEFAULT,
    ...Object.values(ICONS),
    ...new Set(Object.values(PACK_ART)),
    ...FACTIONS.map(factionImageUrl),
  ];

  const boards = await loadBoardManifest();
  urls.push(...boards);

  try {
    const res = await fetch("/card-art/manifest.json", { cache: "no-store" });
    if (res.ok) {
      const manifest = (await res.json()) as Record<string, string>;
      const ids = Object.keys(manifest);
      urls.push(...ids.map((id) => `/card-art/${id}.png`));
      preloadCardArt(ids);
    }
  } catch {
    /* manifest optional */
  }

  preloadFactionArt();
  return urls;
}

export function areAssetsReady(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

export function markAssetsReady(): void {
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, "true");
}

export function clearAssetsReady(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
  imageCache.clear();
}

let preloadPromise: Promise<void> | null = null;

export function preloadAllAssets(onProgress?: (p: PreloadProgress) => void): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (areAssetsReady()) {
    onProgress?.({ loaded: 1, total: 1, phase: "Ready", percent: 100 });
    return Promise.resolve();
  }
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const imageUrls = await collectImageUrls();
    const audioCount = Object.keys(SOUND_PATHS).length;
    const total = imageUrls.length + audioCount;
    let loaded = 0;

    const tick = (phase: string) => {
      loaded += 1;
      onProgress?.({
        loaded,
        total,
        phase,
        percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100,
      });
    };

    onProgress?.({ loaded: 0, total, phase: "Loading card art & images…", percent: 0 });

    await loadImagesBatched(imageUrls, 10, () => tick("Loading card art & images…"));

    onProgress?.({ loaded, total, phase: "Loading sound effects…", percent: Math.round((loaded / total) * 100) });

    await preloadSoundsAsync(() => tick("Loading sound effects…"));

    markAssetsReady();
    onProgress?.({ loaded: total, total, phase: "Ready", percent: 100 });
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}
