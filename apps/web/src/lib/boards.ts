const FALLBACK_BOARDS = ["/boards/default_board.jpg", "/boards/genesisdrop_board.jpg"];

let matchBoardUrl: string | null = null;

function verifyImage(url: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export async function loadBoardManifest(): Promise<string[]> {
  if (typeof window === "undefined") return FALLBACK_BOARDS;

  try {
    const res = await fetch(`/boards/manifest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return FALLBACK_BOARDS;
    const data = (await res.json()) as { boards?: string[] };
    const boards = data.boards?.filter(Boolean) ?? [];
    return boards.length > 0 ? boards : FALLBACK_BOARDS;
  } catch {
    return FALLBACK_BOARDS;
  }
}

export function pickRandomBoard(boards: string[]): string {
  return boards[Math.floor(Math.random() * boards.length)] ?? FALLBACK_BOARDS[0]!;
}

async function pickWorkingBoard(candidates: string[]): Promise<string> {
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  for (const url of shuffled) {
    if (await verifyImage(url)) return url;
  }
  for (const url of FALLBACK_BOARDS) {
    if (await verifyImage(url)) return url;
  }
  return FALLBACK_BOARDS[0]!;
}

/** Synchronous default while the manifest loads (avoids a black flash). */
export function getDefaultBoardBackground(): string {
  return FALLBACK_BOARDS[0]!;
}

/** Pick one board per match; stays stable through mulligan and gameplay. */
export async function getMatchBoardBackground(): Promise<string> {
  if (matchBoardUrl) return matchBoardUrl;

  const boards = await loadBoardManifest();
  matchBoardUrl = await pickWorkingBoard(boards);
  preloadBoardImage(matchBoardUrl);
  return matchBoardUrl;
}

export function resetMatchBoardBackground(): void {
  matchBoardUrl = null;
}

export function preloadBoardImage(url: string): void {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}
