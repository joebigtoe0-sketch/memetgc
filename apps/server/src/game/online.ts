/** Unique authenticated users with at least one open socket. */
const onlineUsers = new Map<string, number>();

export function trackUserOnline(userId: string): void {
  onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
}

export function trackUserOffline(userId: string): void {
  const next = (onlineUsers.get(userId) ?? 1) - 1;
  if (next <= 0) onlineUsers.delete(userId);
  else onlineUsers.set(userId, next);
}

export function getRealOnlineCount(): number {
  return onlineUsers.size;
}

const DISPLAY_MIN = 8;
const DISPLAY_CAP = 52;
const NORMALIZE_AT_REAL = 52;

/**
 * Inflate the real count for the login screen: floor 8, ×2 per player until the
 * display hits 52, then hold at 52 until 52 real players are online, then 1:1.
 */
export function displayOnlineCount(real: number): number {
  if (real >= NORMALIZE_AT_REAL) return real;
  return Math.min(DISPLAY_CAP, Math.max(DISPLAY_MIN, real * 2));
}

export function getPublicOnlineCount(): { real: number; display: number } {
  const real = getRealOnlineCount();
  return { real, display: displayOnlineCount(real) };
}
