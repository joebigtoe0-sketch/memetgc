"use client";

import React, { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import GameBoard from "@/components/Game/GameBoard";
import ScaleToFit from "@/components/Game/ScaleToFit";
import RotateDevicePrompt from "@/components/Game/RotateDevicePrompt";
import { useGameMusic } from "@/hooks/useGameMusic";
import { useIsMobile } from "@/hooks/useViewport";
import { useMobileBrowserChromeHide } from "@/hooks/useMobileBrowserChromeHide";
import TutorialGuide from "@/components/Game/TutorialGuide";
import { spectateGame, leaveSpectate } from "@/hooks/useSocket";

const GAME_SCROLL_SHELL_ID = "game-scroll-shell";

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { gameState, gameId, connected, isSpectator } = useGameStore();
  const isMobile = useIsMobile();
  const spectateMode = searchParams.get("spectate") === "1";
  const routeGameId = String(params.id);

  useGameMusic();
  useMobileBrowserChromeHide(GAME_SCROLL_SHELL_ID, isMobile);

  useEffect(() => {
    if (!spectateMode) return;
    spectateGame(routeGameId);
    return () => {
      leaveSpectate();
    };
  }, [spectateMode, routeGameId]);

  useEffect(() => {
    if (!gameId && !gameState && !spectateMode) {
      router.push("/");
    }
  }, [gameId, gameState, router, spectateMode]);

  if (!gameState) {
    return (
      <div
        className="h-full w-full flex items-center justify-center flex-col gap-4"
        style={{ background: "#060810", color: "#4060a0" }}
      >
        <div className="text-4xl animate-pulse">🎮</div>
        <p className="text-sm">{spectateMode ? "Joining spectate…" : `Loading game ${routeGameId.slice(0, 8)}…`}</p>
        {!connected && <p className="text-xs" style={{ color: "#ff4444" }}>Reconnecting...</p>}
      </div>
    );
  }

  return (
    <>
      {isSpectator && (
        <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "6px 14px", borderRadius: 8, background: "rgba(231,199,104,.15)", border: "1px solid rgba(231,199,104,.45)", font: `800 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7c768", letterSpacing: "2px", pointerEvents: "none" }}>
          SPECTATING
        </div>
      )}
      <div
        id={GAME_SCROLL_SHELL_ID}
        style={{
          position: "fixed",
          inset: 0,
          overflowY: isMobile ? "auto" : "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ height: isMobile ? "calc(100vh + 2px)" : "100vh", position: "relative" }}>
          <ScaleToFit>
            <GameBoard />
          </ScaleToFit>
        </div>
      </div>
      {!isSpectator && <TutorialGuide />}
      {!isSpectator && <RotateDevicePrompt />}
    </>
  );
}
