const FALLBACK_BOARDS = ["/boards/genesisdrop_board.png"];

let matchBoardUrl: string | null = null;

export async function loadBoardManifest(): Promise<string[]> {
  if (typeof window === "undefined") return FALLBACK_BOARDS;

  try {
    const res = await fetch("/boards/manifest.json", { cache: "force-cache" });
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

/** Pick one board per match; stays stable through mulligan and gameplay. */
export async function getMatchBoardBackground(): Promise<string> {
  if (matchBoardUrl) return matchBoardUrl;

  const boards = await loadBoardManifest();
  matchBoardUrl = pickRandomBoard(boards);
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
