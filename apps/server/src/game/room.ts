import { applyAction, sanitizeState, getAIAction, createGameState } from "@memetgc/game-engine";
import type { GameState, GameAction, Card, PlayerState, AnimationHint } from "@memetgc/types";
import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@memetgc/types";
import { recordMatchResults } from "./results.js";

export interface PlayerInfo {
  socketId: string | null;
  userId: string;
  username: string;
  heroId: string;
  heroName: string;
  heroFaction: PlayerState["heroFaction"];
  heroPower: PlayerState["heroPower"];
  deck: Card[];
  isAI: boolean;
}

export interface GameRoom {
  gameId: string;
  state: GameState;
  players: Record<string, PlayerInfo>;
  mode: string;
  cardRegistry: Map<string, Card>;
  turnTimerHandle: ReturnType<typeof setTimeout> | null;
  mulliganTimerHandles: Map<string, ReturnType<typeof setTimeout>>;
  lastActionAt: number;
}

const TURN_TIME_LIMIT_MS = 30_000;
const MULLIGAN_TIME_LIMIT_MS = 30_000;

const rooms = new Map<string, GameRoom>();

export function createRoom(
  gameId: string,
  p1: PlayerInfo,
  p2: PlayerInfo,
  mode: string,
  cardRegistry: Map<string, Card>
): GameRoom {
  const state = createGameState(
    gameId,
    { id: p1.userId, heroId: p1.heroId, heroName: p1.heroName, heroFaction: p1.heroFaction, heroPower: p1.heroPower, deck: p1.deck },
    { id: p2.userId, heroId: p2.heroId, heroName: p2.heroName, heroFaction: p2.heroFaction, heroPower: p2.heroPower, deck: p2.deck }
  );

  const room: GameRoom = {
    gameId, state,
    players: { [p1.userId]: p1, [p2.userId]: p2 },
    mode, cardRegistry,
    turnTimerHandle: null,
    mulliganTimerHandles: new Map(),
    lastActionAt: Date.now(),
  };

  rooms.set(gameId, room);
  return room;
}

/**
 * Call this after creating a practice room and joining the socket.
 * Immediately submits the AI mulligan and starts the human mulligan timer.
 */
export function initMulligan(
  room: GameRoom,
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  // Auto-mulligan AI players immediately (keep all cards)
  for (const [userId, info] of Object.entries(room.players)) {
    if (info.isAI && room.state.status === "mulligan") {
      const result = applyAction(room.state, { type: "mulligan", keepInstanceIds: [], playerId: userId }, room.cardRegistry);
      if (result.success) {
        room.state = result.newState;
      }
    }
  }

  // If game is already in_progress after AI mulligan, start turn timer
  if (room.state.status === "in_progress") {
    broadcastState(room, io, []);
    scheduleActiveTurnTimer(room, io);
    return;
  }

  // Broadcast mulligan state
  broadcastState(room, io, []);

  // Start human mulligan timers
  for (const [userId, info] of Object.entries(room.players)) {
    if (!info.isAI && room.state.status === "mulligan") {
      const handle = setTimeout(() => {
        // Auto-confirm mulligan (keep all) on timeout
        if (room.state.status !== "mulligan") return;
        const mulliganResult = applyAction(room.state, { type: "mulligan", keepInstanceIds: [] }, room.cardRegistry);
        if (mulliganResult.success) {
          room.state = mulliganResult.newState;
          broadcastState(room, io, []);
          scheduleActiveTurnTimer(room, io);
        }
      }, MULLIGAN_TIME_LIMIT_MS);
      room.mulliganTimerHandles.set(userId, handle);
    }
  }
}

export function getRoom(gameId: string): GameRoom | undefined {
  return rooms.get(gameId);
}

export function getRoomByUserId(userId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (userId in room.players) return room;
  }
  return undefined;
}

export function handlePlayerAction(
  room: GameRoom,
  userId: string,
  action: GameAction,
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  // Clear any pending timers when player acts
  clearTurnTimer(room);
  if (action.type === "mulligan") {
    const handle = room.mulliganTimerHandles.get(userId);
    if (handle) { clearTimeout(handle); room.mulliganTimerHandles.delete(userId); }
  }

  room.lastActionAt = Date.now();

  // For mulligan/surrender, always force the authenticated userId
  const resolvedAction: GameAction = (action.type === "mulligan" || action.type === "surrender")
    ? { ...action, playerId: userId }
    : action;

  const result = applyAction(room.state, resolvedAction, room.cardRegistry);

  if (!result.success) {
    const player = room.players[userId];
    if (player?.socketId) {
      io.to(player.socketId).emit("game:action_result", { success: false, error: result.error });
    }
    return;
  }

  room.state = result.newState;
  broadcastState(room, io, result.animations);

  if (room.state.status === "finished") {
    cleanupRoom(room, io);
    return;
  }

  // After mulligan, check if game started and trigger AI turn / turn timer
  if (room.state.status === "in_progress") {
    triggerAIOrTimer(room, io);
    return;
  }

  // Still in mulligan — if remaining mulligans needed are only AI, handle them
  if (room.state.status === "mulligan") {
    autoMulliganAI(room, io);
  }
}

function autoMulliganAI(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  let changed = false;
  for (const [userId, info] of Object.entries(room.players)) {
    if (info.isAI && room.state.status === "mulligan") {
      const result = applyAction(room.state, { type: "mulligan", keepInstanceIds: [], playerId: userId }, room.cardRegistry);
      if (result.success) {
        room.state = result.newState;
        changed = true;
      }
    }
  }
  if (changed) {
    broadcastState(room, io, []);
    if (room.state.status === "in_progress") {
      triggerAIOrTimer(room, io);
    }
  }
}

function triggerAIOrTimer(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  if (room.state.status !== "in_progress") return;

  const activePlayerInfo = room.players[room.state.activePlayerId];
  if (activePlayerInfo?.isAI) {
    setTimeout(() => processAITurn(room, io), 800);
  } else {
    scheduleActiveTurnTimer(room, io);
  }
}

function scheduleActiveTurnTimer(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  clearTurnTimer(room);
  if (room.state.status !== "in_progress") return;
  const activeInfo = room.players[room.state.activePlayerId];
  if (!activeInfo || activeInfo.isAI) return;

  room.turnTimerHandle = setTimeout(() => {
    if (room.state.status !== "in_progress") return;
    if (room.state.activePlayerId !== activeInfo.userId) return;
    // Auto-end turn
    const result = applyAction(room.state, { type: "end_turn" }, room.cardRegistry);
    if (result.success) {
      room.state = result.newState;
      broadcastState(room, io, []);
      if (room.state.status === "finished") { cleanupRoom(room, io); return; }
      triggerAIOrTimer(room, io);
    }
  }, TURN_TIME_LIMIT_MS);
}

function clearTurnTimer(room: GameRoom): void {
  if (room.turnTimerHandle) {
    clearTimeout(room.turnTimerHandle);
    room.turnTimerHandle = null;
  }
}

function processAITurn(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  if (room.state.status !== "in_progress") return;

  const aiPlayerId = Object.keys(room.players).find((id) => room.players[id]?.isAI);
  if (!aiPlayerId || room.state.activePlayerId !== aiPlayerId) return;

  let iterations = 0;
  while (room.state.activePlayerId === aiPlayerId && room.state.status === "in_progress" && iterations < 20) {
    const action = getAIAction(room.state, aiPlayerId);
    const result = applyAction(room.state, action, room.cardRegistry);
    if (!result.success) {
      // Never stall the AI turn: if its chosen action was rejected, just end the turn
      if (action.type !== "end_turn") {
        const endResult = applyAction(room.state, { type: "end_turn" }, room.cardRegistry);
        if (endResult.success) room.state = endResult.newState;
      }
      break;
    }
    room.state = result.newState;
    iterations++;
    if (action.type === "end_turn") break;
  }

  broadcastState(room, io, []);

  if (room.state.status === "finished") {
    cleanupRoom(room, io);
    return;
  }

  // After AI turn, schedule human turn timer
  scheduleActiveTurnTimer(room, io);
}

function cleanupRoom(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  clearTurnTimer(room);
  for (const h of room.mulliganTimerHandles.values()) clearTimeout(h);
  room.mulliganTimerHandles.clear();
  io.to(room.gameId).emit("game:game_over", {
    winner: room.state.winner ?? "",
    reason: room.state.endReason ?? "hero_death",
  });
  // Persist season stats + daily-quest progress (fire-and-forget)
  void recordMatchResults(room);
  rooms.delete(room.gameId);
}

function broadcastState(
  room: GameRoom,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  animations: AnimationHint[]
): void {
  for (const [playerId, playerInfo] of Object.entries(room.players)) {
    if (!playerInfo.socketId || playerInfo.isAI) continue;
    const sanitized = sanitizeState(room.state, playerId);
    io.to(playerInfo.socketId).emit("game:state_update", sanitized);
    io.to(playerInfo.socketId).emit("game:action_result", { success: true, animations });
  }
}

export function deleteRoom(gameId: string): void {
  const room = rooms.get(gameId);
  if (room) {
    clearTurnTimer(room);
    for (const h of room.mulliganTimerHandles.values()) clearTimeout(h);
  }
  rooms.delete(gameId);
}

export { rooms };
