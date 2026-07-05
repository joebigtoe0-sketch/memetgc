/** Maps authenticated userId → latest socket id for direct emits. */
const userSockets = new Map<string, string>();

export function registerUserSocket(userId: string, socketId: string): void {
  userSockets.set(userId, socketId);
}

export function unregisterUserSocket(userId: string, socketId: string): void {
  if (userSockets.get(userId) === socketId) userSockets.delete(userId);
}

export function getSocketIdForUser(userId: string): string | undefined {
  return userSockets.get(userId);
}
