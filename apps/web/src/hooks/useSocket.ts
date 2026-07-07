"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/lib/constants";
import { playSound } from "@/lib/sounds";
import { useGameStore } from "@/store/gameStore";
import { useAuthStore } from "@/store/authStore";
import type { ServerToClientEvents, ClientToServerEvents, GameAction } from "@memetgc/types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  return socket;
}

export function sendAction(action: GameAction): void {
  if (useGameStore.getState().isSpectator) return;
  socket?.emit("game:action", action);
}

export function spectateGame(gameId: string): void {
  socket?.emit("game:spectate", { gameId });
}

export function leaveSpectate(): void {
  socket?.emit("game:spectate_leave");
}

export function useSocket() {
  const { token, userId } = useAuthStore();
  const { setConnected, setGameId, setGameState, setAnimations, setActionError, setPlayerId, setMatchReward, setRankUpdate, setOpponentDisconnected, setSpectator } = useGameStore();
  const initializedRef = useRef(false);
  // Buffer incoming state so combat/spell animations land before the board
  // visibly updates (minion travels, particles fly, THEN it takes damage/dies).
  const pendingStateRef = useRef<Parameters<typeof setGameState>[0] | null>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || !userId || initializedRef.current) return;
    initializedRef.current = true;

    socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
    });

    setPlayerId(userId);

    /** How long to hold the new state so the animation reads before it applies. */
    function stateApplyDelay(animations: { type: string; data?: Record<string, unknown> }[]): number {
      if (!animations.length) return 0;
      let delay = 0;
      for (const a of animations) {
        if (a.type === "attack") delay = Math.max(delay, 760);
        else if (a.type === "death") delay = Math.max(delay, 720);
        else if (a.type === "spell_cast" && (a.data?.damage as number ?? 0) > 0) delay = Math.max(delay, 720);
        else if (a.type === "heal" || a.type === "armor_gain" || a.type === "effect_vfx" || a.type === "spell_cast") delay = Math.max(delay, 320);
      }
      return delay;
    }

    function flushPendingState() {
      if (applyTimerRef.current) { clearTimeout(applyTimerRef.current); applyTimerRef.current = null; }
      if (pendingStateRef.current) {
        setGameState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("match:found", (gameId) => {
      setGameId(gameId);
    });

    socket.on("game:state_update", (state) => {
      // Hold the newest snapshot; applied immediately or after animations by
      // the paired action_result handler. Newest snapshot always wins.
      pendingStateRef.current = state;
    });

    socket.on("game:action_result", (result) => {
      if (!result.success) {
        playSound("denied");
        setActionError(result.error ?? "Action failed");
        // No state_update accompanies a failed action.
        return;
      }
      const animations = result.animations ?? [];
      if (animations.length) setAnimations(animations);
      const delay = stateApplyDelay(animations);
      if (applyTimerRef.current) { clearTimeout(applyTimerRef.current); applyTimerRef.current = null; }
      if (delay <= 0) {
        flushPendingState();
      } else {
        applyTimerRef.current = setTimeout(flushPendingState, delay);
      }
    });

    socket.on("game:game_over", (result) => {
      setMatchReward(typeof result.fragments === "number" ? result.fragments : null);
    });

    socket.on("game:rank_update", (result) => {
      setRankUpdate(result);
    });

    socket.on("game:opponent_status", (status) => {
      setOpponentDisconnected(!status.connected);
    });

    socket.on("game:spectate_started", (state) => {
      setSpectator(true);
      setGameId(state.gameId);
      setGameState(state);
    });

    socket.on("game:error", (msg) => {
      playSound("denied");
      setActionError(msg);
    });

    return () => {
      if (applyTimerRef.current) { clearTimeout(applyTimerRef.current); applyTimerRef.current = null; }
      pendingStateRef.current = null;
      socket?.disconnect();
      socket = null;
      initializedRef.current = false;
    };
  }, [token, userId]);
}
