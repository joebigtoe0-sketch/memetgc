export type GameMode = "practice" | "casual" | "ranked";

export interface QueueEntry {
  socketId: string;
  userId: string;
  username: string;
  deckId: string;
  heroId: string;
  mode: GameMode;
  mmr: number;
  joinedAt: number;
}

const queues: Record<GameMode, QueueEntry[]> = {
  practice: [],
  casual: [],
  ranked: [],
};

/** Ranked MMR window: starts tight, widens with wait time so no one waits forever. */
const RANKED_BASE_WINDOW = 200;
const RANKED_WINDOW_PER_SEC = 100;
const RANKED_MAX_WAIT_MS = 60_000; // after this, accept any opponent

function rankedWindow(waitedMs: number): number {
  if (waitedMs >= RANKED_MAX_WAIT_MS) return Number.POSITIVE_INFINITY;
  return RANKED_BASE_WINDOW + RANKED_WINDOW_PER_SEC * Math.floor(waitedMs / 1000);
}

export function joinQueue(entry: QueueEntry): void {
  const queue = queues[entry.mode];
  if (!queue.some((e) => e.userId === entry.userId)) {
    queue.push(entry);
  }
}

export function leaveQueue(userId: string): void {
  for (const mode of Object.keys(queues) as GameMode[]) {
    queues[mode] = queues[mode].filter((e) => e.userId !== userId);
  }
}

/**
 * Try to form one match for the given mode.
 * - practice/casual: FIFO (first two waiting).
 * - ranked: the longest-waiting player is matched with the closest-MMR opponent
 *   within a window that widens over time.
 */
export function tryMatchmake(mode: GameMode, now = Date.now()): [QueueEntry, QueueEntry] | null {
  const queue = queues[mode];
  if (queue.length < 2) return null;

  if (mode !== "ranked") {
    const [p1, p2] = queue.splice(0, 2);
    return [p1!, p2!];
  }

  // Ranked: prioritise whoever has waited longest.
  const sortedByWait = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);
  const seeker = sortedByWait[0]!;
  const window = rankedWindow(now - seeker.joinedAt);

  let best: QueueEntry | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const other of queue) {
    if (other.userId === seeker.userId) continue;
    const gap = Math.abs(other.mmr - seeker.mmr);
    if (gap <= window && gap < bestGap) {
      best = other;
      bestGap = gap;
    }
  }

  if (!best) return null;

  const matchIds = new Set([seeker.userId, best.userId]);
  queues.ranked = queue.filter((e) => !matchIds.has(e.userId));
  return [seeker, best];
}

export function getQueueSize(mode: GameMode): number {
  return queues[mode].length;
}

export function removeBySocketId(socketId: string): void {
  for (const mode of Object.keys(queues) as GameMode[]) {
    queues[mode] = queues[mode].filter((e) => e.socketId !== socketId);
  }
}
