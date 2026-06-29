"use client";

import { create } from "zustand";
import type { SanitizedGameState, GameAction, AnimationHint } from "@memetgc/types";

interface GameStore {
  // Connection
  connected: boolean;
  gameId: string | null;
  playerId: string | null;

  // Game state
  gameState: SanitizedGameState | null;
  pendingAnimations: AnimationHint[];
  lastActionError: string | null;

  // UI state
  selectedCardInstanceId: string | null;
  selectedAttackerId: string | null;
  zoomedCard: SanitizedGameState["myState"]["hand"][0] | null;
  isMyTurn: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setGameId: (id: string | null) => void;
  setPlayerId: (id: string | null) => void;
  setGameState: (state: SanitizedGameState) => void;
  setAnimations: (animations: AnimationHint[]) => void;
  clearAnimations: () => void;
  setActionError: (error: string | null) => void;
  selectCard: (instanceId: string | null) => void;
  selectAttacker: (instanceId: string | null) => void;
  setZoomedCard: (card: SanitizedGameState["myState"]["hand"][0] | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  gameId: null,
  playerId: null,
  gameState: null,
  pendingAnimations: [],
  lastActionError: null,
  selectedCardInstanceId: null,
  selectedAttackerId: null,
  zoomedCard: null,
  isMyTurn: false,

  setConnected: (connected) => set({ connected }),
  setGameId: (gameId) => set({ gameId }),
  setPlayerId: (playerId) => set({ playerId }),

  setGameState: (state) =>
    set((store) => ({
      gameState: state,
      isMyTurn: state.activePlayerId === store.playerId,
      lastActionError: null,
    })),

  setAnimations: (animations) => set({ pendingAnimations: animations }),
  clearAnimations: () => set({ pendingAnimations: [] }),
  setActionError: (error) => set({ lastActionError: error }),

  selectCard: (selectedCardInstanceId) =>
    set({ selectedCardInstanceId, selectedAttackerId: null }),

  selectAttacker: (selectedAttackerId) =>
    set({ selectedAttackerId, selectedCardInstanceId: null }),

  setZoomedCard: (zoomedCard) => set({ zoomedCard }),

  reset: () =>
    set({
      gameId: null,
      gameState: null,
      pendingAnimations: [],
      lastActionError: null,
      selectedCardInstanceId: null,
      selectedAttackerId: null,
      zoomedCard: null,
      isMyTurn: false,
    }),
}));
