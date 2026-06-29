import { applyAction, sanitizeState, getAIAction, createGameState } from "@memetgc/game-engine";
import type { GameState, GameAction, Card, PlayerState, AnimationHint } from "@memetgc/types";
import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@memetgc/types";

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
}

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
    {
      id: p1.userId,
      heroId: p1.heroId,
      heroName: p1.heroName,
      heroFaction: p1.heroFaction,
      heroPower: p1.heroPower,
      deck: p1.deck,
    },
    {
      id: p2.userId,
      heroId: p2.heroId,
      heroName: p2.heroName,
      heroFaction: p2.heroFaction,
      heroPower: p2.heroPower,
      deck: p2.deck,
    }
  );

  const room: GameRoom = {
    gameId,
    state,
    players: {
      [p1.userId]: p1,
      [p2.userId]: p2,
    },
    mode,
    cardRegistry,
  };

  rooms.set(gameId, room);
  return room;
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
  const result = applyAction(room.state, action, room.cardRegistry);

  if (!result.success) {
    const player = room.players[userId];
    if (player?.socketId) {
      io.to(player.socketId).emit("game:action_result", {
        success: false,
        error: result.error,
      });
    }
    return;
  }

  room.state = result.newState;

  // Broadcast updated state to both players
  broadcastState(room, io, result.animations);

  // If game over, record result
  if (room.state.status === "finished") {
    io.to(room.gameId).emit("game:game_over", {
      winner: room.state.winner ?? "",
      reason: room.state.endReason ?? "hero_death",
    });
    rooms.delete(room.gameId);
    return;
  }

  // AI turn
  const activePlayer = room.state.players[room.state.activePlayerId];
  const activePlayerInfo = activePlayer ? room.players[room.state.activePlayerId] : undefined;

  if (activePlayerInfo?.isAI && room.state.status === "in_progress") {
    setTimeout(() => processAITurn(room, io), 1000);
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
    if (!result.success) break;
    room.state = result.newState;
    iterations++;
    if (action.type === "end_turn") break;
  }

  broadcastState(room, io, []);

  if (room.state.status === "finished") {
    io.to(room.gameId).emit("game:game_over", {
      winner: room.state.winner ?? "",
      reason: room.state.endReason ?? "hero_death",
    });
    rooms.delete(room.gameId);
  }
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
  rooms.delete(gameId);
}

export { rooms };
