export type GameMode = "practice" | "casual" | "ranked";

export interface QueueEntry {
  socketId: string;
  userId: string;
  username: string;
  deckId: string;
  heroId: string;
  mode: GameMode;
  joinedAt: number;
}

const queues: Record<GameMode, QueueEntry[]> = {
  practice: [],
  casual: [],
  ranked: [],
};

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

export function tryMatchmake(mode: GameMode): [QueueEntry, QueueEntry] | null {
  const queue = queues[mode];
  if (queue.length < 2) return null;
  const [p1, p2] = queue.splice(0, 2);
  return [p1!, p2!];
}

export function getQueueSize(mode: GameMode): number {
  return queues[mode].length;
}

export function removeBySocketId(socketId: string): void {
  for (const mode of Object.keys(queues) as GameMode[]) {
    queues[mode] = queues[mode].filter((e) => e.socketId !== socketId);
  }
}
