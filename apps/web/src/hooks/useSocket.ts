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
  socket?.emit("game:action", action);
}

export function useSocket() {
  const { token, userId } = useAuthStore();
  const { setConnected, setGameId, setGameState, setAnimations, setActionError, setPlayerId } = useGameStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!token || !userId || initializedRef.current) return;
    initializedRef.current = true;

    socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
    });

    setPlayerId(userId);

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
      setGameState(state);
    });

    socket.on("game:action_result", (result) => {
      if (!result.success) {
        playSound("denied");
        setActionError(result.error ?? "Action failed");
      } else if (result.animations) {
        setAnimations(result.animations);
      }
    });

    socket.on("game:game_over", (result) => {
      console.log("Game over:", result);
    });

    socket.on("game:error", (msg) => {
      playSound("denied");
      setActionError(msg);
    });

    return () => {
      socket?.disconnect();
      socket = null;
      initializedRef.current = false;
    };
  }, [token, userId]);
}
