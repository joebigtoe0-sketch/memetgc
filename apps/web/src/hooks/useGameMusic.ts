"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { musicManager } from "@/lib/music/MusicManager";
import type { MusicTrack } from "@/lib/music/constants";

function hpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 1;
  return hp / maxHp;
}

export function useGameMusic(): void {
  const { gameState, playerId } = useGameStore();
  const currentGameTrack = useRef<MusicTrack | null>(null);
  const endPlayed = useRef(false);

  useEffect(() => {
    if (!musicManager.isUnlocked()) return;
    if (!gameState) return;
    if (gameState.status === "mulligan") return;
    if (gameState.status !== "in_progress" && gameState.status !== "finished") return;

    if (gameState.status === "finished") {
      if (endPlayed.current) return;
      endPlayed.current = true;
      const won = gameState.winner === playerId;
      if (won) musicManager.playVictory();
      else musicManager.playDefeat();
      currentGameTrack.current = null;
      return;
    }

    endPlayed.current = false;

    const my = gameState.myState;
    const opp = gameState.opponentState;
    const myRatio = hpRatio(my.hp, my.maxHp);
    const oppRatio = hpRatio(opp.hp, opp.maxHp);

    let next: MusicTrack = "game_normal";

    if (myRatio < 0.4) {
      next = "game_losing";
    } else if (oppRatio < 0.5 && myRatio > 0.5) {
      next = "game_winning";
    }

    if (currentGameTrack.current === next) return;
    currentGameTrack.current = next;
    musicManager.crossfade(next);
  }, [gameState, playerId]);

  useEffect(() => {
    return () => {
      currentGameTrack.current = null;
      endPlayed.current = false;
    };
  }, []);
}
