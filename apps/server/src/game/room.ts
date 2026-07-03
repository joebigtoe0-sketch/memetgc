import { applyAction, sanitizeState, getAIAction, createGameState } from "@memetgc/game-engine";
import type { GameState, GameAction, Card, PlayerState, AnimationHint } from "@memetgc/types";
import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@memetgc/types";
import { recordMatchResults } from "./results.js";
import { computeMatchFragments } from "./matchRewards.js";

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
  /** Equipped card back id (null = default). Shown to the opponent in-game. */
  cardBack?: string | null;
}

export interface GameRoom {
  gameId: string;
  state: GameState;
  players: Record<string, PlayerInfo>;
  mode: string;
  cardRegistry: Map<string, Card>;
  turnTimerHandle: ReturnType<typeof setTimeout> | null;
  turnTimerEndsAt: number | null;
  mulliganTimerHandles: Map<string, ReturnType<typeof setTimeout>>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  lastActionAt: number;
}

const TURN_TIME_LIMIT_MS = 30_000;
const MULLIGAN_TIME_LIMIT_MS = 30_000;
// Grace period after a player disconnects before they forfeit the match. Long
// enough to survive a page refresh / brief network blip + socket reconnect, but
// short enough that the remaining player isn't stuck waiting on a rage-quitter.
const DISCONNECT_GRACE_MS = 45_000;

const rooms = new Map<string, GameRoom>();

export function createRoom(
  gameId: string,
  p1: PlayerInfo,
  p2: PlayerInfo,
  mode: string,
  cardRegistry: Map<string, Card>,
  seed?: number
): GameRoom {
  const state = createGameState(
    gameId,
    { id: p1.userId, playerName: p1.username, heroId: p1.heroId, heroName: p1.heroName, heroFaction: p1.heroFaction, heroPower: p1.heroPower, deck: p1.deck },
    { id: p2.userId, playerName: p2.username, heroId: p2.heroId, heroName: p2.heroName, heroFaction: p2.heroFaction, heroPower: p2.heroPower, deck: p2.deck },
    seed
  );

  const room: GameRoom = {
    gameId, state,
    players: { [p1.userId]: p1, [p2.userId]: p2 },
    mode, cardRegistry,
    turnTimerHandle: null,
    turnTimerEndsAt: null,
    mulliganTimerHandles: new Map(),
    disconnectTimers: new Map(),
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
    scheduleActiveTurnTimer(room, io);
    broadcastState(room, io, []);
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
          scheduleActiveTurnTimer(room, io);
          broadcastState(room, io, []);
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
  if (action.type === "mulligan") {
    const handle = room.mulliganTimerHandles.get(userId);
    if (handle) { clearTimeout(handle); room.mulliganTimerHandles.delete(userId); }
  }

  room.lastActionAt = Date.now();

  // Snapshot the turn identity so we only reset the countdown when the turn
  // actually advances — mid-turn actions (play/attack/hero power) must NOT
  // restart the 30s timer.
  const activeBefore = room.state.activePlayerId;
  const turnBefore = room.state.turnNumber;
  const statusBefore = room.state.status;

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
    // A rejected action must never leave the active player's turn without a
    // running timer — but a running one must be left untouched (no reset).
    if (!room.turnTimerHandle && room.state.status === "in_progress") {
      scheduleActiveTurnTimer(room, io);
    }
    broadcastState(room, io, []);
    return;
  }

  room.state = result.newState;

  if (room.state.status === "finished") {
    clearTurnTimer(room);
    broadcastState(room, io, result.animations);
    cleanupRoom(room, io);
    return;
  }

  if (room.state.status === "in_progress") {
    const turnChanged =
      room.state.activePlayerId !== activeBefore || room.state.turnNumber !== turnBefore;
    const justStarted = statusBefore !== "in_progress";

    if (turnChanged || justStarted) {
      // A new turn began (or the match just started after mulligan) → fresh
      // 30s timer, or hand off to the AI.
      clearTurnTimer(room);
      triggerAIOrTimer(room, io);
    } else if (!room.turnTimerHandle) {
      // Mid-turn action with no timer running (e.g. after a reconnect) → ensure one.
      scheduleActiveTurnTimer(room, io);
    }
    // Otherwise keep the existing deadline — the countdown continues uninterrupted.

    broadcastState(room, io, result.animations);
    return;
  }

  broadcastState(room, io, result.animations);

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

  const activePlayerId = activeInfo.userId;
  room.turnTimerEndsAt = Date.now() + TURN_TIME_LIMIT_MS;
  room.turnTimerHandle = setTimeout(() => {
    autoEndTurnOnTimeout(room, io, activePlayerId);
  }, TURN_TIME_LIMIT_MS);
}

function autoEndTurnOnTimeout(
  room: GameRoom,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  expectedPlayerId: string
): void {
  room.turnTimerHandle = null;

  if (room.state.status !== "in_progress") {
    clearTurnTimer(room);
    return;
  }

  // Stale callback (turn already ended another way) — ensure the current player has a timer.
  if (room.state.activePlayerId !== expectedPlayerId) {
    scheduleActiveTurnTimer(room, io);
    broadcastState(room, io, []);
    return;
  }

  room.turnTimerEndsAt = null;
  const result = applyAction(room.state, { type: "end_turn" }, room.cardRegistry);
  if (result.success) {
    room.state = result.newState;
    if (room.state.status === "finished") {
      broadcastState(room, io, result.animations);
      cleanupRoom(room, io);
      return;
    }
    // Schedule the next player's timer *before* broadcasting so clients get turnTimerEndsAt.
    triggerAIOrTimer(room, io);
    broadcastState(room, io, result.animations);
    return;
  }

  // Never leave the game without a running timer after a timeout attempt.
  scheduleActiveTurnTimer(room, io);
  broadcastState(room, io, []);
}

function clearTurnTimer(room: GameRoom): void {
  if (room.turnTimerHandle) {
    clearTimeout(room.turnTimerHandle);
    room.turnTimerHandle = null;
  }
  room.turnTimerEndsAt = null;
}

function buildSanitizedState(room: GameRoom, playerId: string) {
  const sanitized = sanitizeState(room.state, playerId);
  const opponentId = Object.keys(room.players).find((id) => id !== playerId);
  const opponentBack = opponentId ? room.players[opponentId]?.cardBack ?? null : null;
  return {
    ...sanitized,
    turnTimerEndsAt: room.turnTimerEndsAt,
    opponentState: { ...sanitized.opponentState, cardBack: opponentBack },
  };
}

export { buildSanitizedState };

/**
 * A player's socket dropped. Instead of instantly ending the game (which breaks
 * on refreshes / brief blips and awards no rank points), we:
 *   1. keep the game moving — if it's their turn, the auto-end timer spends it,
 *      so the remaining player can keep playing toward a real win, and
 *   2. start a grace timer; if they don't reconnect in time they forfeit and
 *      the opponent wins through the normal end-of-game path (points + fragments).
 */
export function handlePlayerDisconnect(
  room: GameRoom,
  userId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  if (room.state.status === "finished") return;
  const player = room.players[userId];
  if (!player || player.isAI) return;

  player.socketId = null; // stop broadcasting to the dead socket
  const opponentId = Object.keys(room.players).find((id) => id !== userId);

  // Tell the still-connected opponent so their UI can show a "waiting" hint.
  if (opponentId) {
    const opp = room.players[opponentId];
    if (opp?.socketId) {
      io.to(opp.socketId).emit("game:opponent_status", { connected: false, graceMs: DISCONNECT_GRACE_MS });
    }
  }

  // If the game is live and it's the departed player's turn, ensure their turns
  // auto-pass so the opponent isn't frozen waiting on a client that's gone.
  if (room.state.status === "in_progress" && room.state.activePlayerId === userId) {
    scheduleActiveTurnTimer(room, io);
    broadcastState(room, io, []);
  }

  const existing = room.disconnectTimers.get(userId);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    const r = getRoom(room.gameId);
    if (!r || r.state.status === "finished") return;
    if (r.players[userId]?.socketId) return; // reconnected in time
    if (!opponentId) return;
    r.state.status = "finished";
    r.state.winner = opponentId;
    r.state.endReason = "opponent_disconnected";
    broadcastState(r, io, []);
    cleanupRoom(r, io);
  }, DISCONNECT_GRACE_MS);
  room.disconnectTimers.set(userId, handle);
}

/** A player's socket came back before the grace timer fired — cancel the forfeit. */
export function handlePlayerReconnect(
  room: GameRoom,
  userId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  const handle = room.disconnectTimers.get(userId);
  if (handle) { clearTimeout(handle); room.disconnectTimers.delete(userId); }

  const opponentId = Object.keys(room.players).find((id) => id !== userId);
  if (opponentId) {
    const opp = room.players[opponentId];
    if (opp?.socketId) io.to(opp.socketId).emit("game:opponent_status", { connected: true });
  }

  // If it's the reconnecting player's turn, make sure a timer is running again.
  if (room.state.status === "in_progress" && room.state.activePlayerId === userId) {
    scheduleActiveTurnTimer(room, io);
    broadcastState(room, io, []);
  }
}

// Delay between individual AI actions so a human can follow the AI playing/attacking
// one card at a time, instead of everything happening instantly.
const AI_ACTION_DELAY_MS = 1100;
const AI_MAX_ACTIONS = 20;

function processAITurn(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  if (room.state.status !== "in_progress") return;

  const aiPlayerId = Object.keys(room.players).find((id) => room.players[id]?.isAI);
  if (!aiPlayerId || room.state.activePlayerId !== aiPlayerId) return;

  stepAITurn(room, io, aiPlayerId, 0);
}

/**
 * Executes ONE AI action, broadcasts it, then schedules the next step after a delay.
 * Mirrors the human action flow (one applyAction + one broadcast per action) so the
 * client sees the AI act incrementally rather than all at once.
 */
function stepAITurn(
  room: GameRoom,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  aiPlayerId: string,
  iterations: number
): void {
  // Bail if the room was torn down (e.g. opponent surrendered/disconnected mid-turn)
  if (!rooms.has(room.gameId)) return;
  if (room.state.status === "finished") { cleanupRoom(room, io); return; }
  if (room.state.status !== "in_progress") return;

  // Turn already handed back to the human (e.g. AI ended turn last step)
  if (room.state.activePlayerId !== aiPlayerId) {
    scheduleActiveTurnTimer(room, io);
    broadcastState(room, io, []);
    return;
  }

  // Safety cap: force end turn if the AI somehow loops
  if (iterations >= AI_MAX_ACTIONS) {
    finishAITurn(room, io);
    return;
  }

  const action = room.mode === "tutorial"
    ? getTutorialAIAction(room.state, aiPlayerId)
    : getAIAction(room.state, aiPlayerId);
  const result = applyAction(room.state, action, room.cardRegistry);

  if (!result.success) {
    // Never stall: if the chosen action was rejected, just end the turn
    finishAITurn(room, io);
    return;
  }

  room.state = result.newState;

  if (room.state.status === "finished") {
    broadcastState(room, io, result.animations);
    cleanupRoom(room, io);
    return;
  }

  if (action.type === "end_turn") {
    scheduleActiveTurnTimer(room, io);
  }

  broadcastState(room, io, result.animations);

  if (action.type === "end_turn") return;

  setTimeout(() => stepAITurn(room, io, aiPlayerId, iterations + 1), AI_ACTION_DELAY_MS);
}

/**
 * Deliberately harmless AI used only in the guided tutorial game. It plays at
 * most a couple of cheap minions (so the player has something to attack) but
 * NEVER attacks, uses its hero power, or casts spells — the player cannot lose.
 */
function getTutorialAIAction(state: GameState, aiPlayerId: string): GameAction {
  const player = state.players[aiPlayerId];
  if (!player) return { type: "end_turn" };

  // Resolve any pending discover pick (shouldn't happen with minion-only plays, but be safe)
  if (state.pendingDiscover && state.pendingDiscover.playerId === aiPlayerId) {
    const opt = state.pendingDiscover.options[0];
    if (opt) return { type: "discover_choice", cardId: opt.id };
  }

  const minionsOnBoard = player.board.filter((s) => s !== null).length;
  if (minionsOnBoard < 2) {
    // Cheapest affordable minion with no targeting requirement
    const playable = player.hand
      .filter((c) => c.type === "minion" && c.cost <= player.mana + player.tempMana)
      .sort((a, b) => a.cost - b.cost);
    const card = playable[0] as (Card & { instanceId: string }) | undefined;
    if (card) {
      return { type: "play_card", cardInstanceId: card.instanceId };
    }
  }

  return { type: "end_turn" };
}

function finishAITurn(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  const endResult = applyAction(room.state, { type: "end_turn" }, room.cardRegistry);
  if (endResult.success) {
    room.state = endResult.newState;
  }
  if (room.state.status === "finished") {
    if (endResult.success) broadcastState(room, io, endResult.animations);
    cleanupRoom(room, io);
    return;
  }
  scheduleActiveTurnTimer(room, io);
  broadcastState(room, io, endResult.success ? endResult.animations : []);
}

function cleanupRoom(room: GameRoom, io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  clearTurnTimer(room);
  for (const h of room.mulliganTimerHandles.values()) clearTimeout(h);
  room.mulliganTimerHandles.clear();
  for (const h of room.disconnectTimers.values()) clearTimeout(h);
  room.disconnectTimers.clear();
  const winnerId = room.state.winner ?? null;
  const endReason = room.state.endReason ?? "hero_death";
  const turnNumber = room.state.turnNumber ?? 0;
  for (const player of Object.values(room.players)) {
    if (!player.socketId || player.isAI) continue;
    const fragments = computeMatchFragments({
      mode: room.mode,
      isWinner: winnerId === player.userId,
      endReason,
      turnNumber,
      playerId: player.userId,
      winnerId,
    });
    io.to(player.socketId).emit("game:game_over", {
      winner: winnerId ?? "",
      reason: endReason,
      fragments,
    });
  }
  // Persist season stats + daily-quest progress (fire-and-forget)
  void recordMatchResults(room, io);
  rooms.delete(room.gameId);
}

function broadcastState(
  room: GameRoom,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  animations: AnimationHint[]
): void {
  for (const [playerId, playerInfo] of Object.entries(room.players)) {
    if (!playerInfo.socketId || playerInfo.isAI) continue;
    const sanitized = buildSanitizedState(room, playerId);
    io.to(playerInfo.socketId).emit("game:state_update", sanitized);
    io.to(playerInfo.socketId).emit("game:action_result", { success: true, animations });
  }
}

export function deleteRoom(gameId: string): void {
  const room = rooms.get(gameId);
  if (room) {
    clearTurnTimer(room);
    for (const h of room.mulliganTimerHandles.values()) clearTimeout(h);
    for (const h of room.disconnectTimers.values()) clearTimeout(h);
  }
  rooms.delete(gameId);
}

export { rooms };
