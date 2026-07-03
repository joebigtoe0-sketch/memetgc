"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import GameBoard from "@/components/Game/GameBoard";
import ScaleToFit from "@/components/Game/ScaleToFit";
import RotateDevicePrompt from "@/components/Game/RotateDevicePrompt";
import TutorialGuide from "@/components/Game/TutorialGuide";
import { useGameMusic } from "@/hooks/useGameMusic";
import { useIsMobile } from "@/hooks/useViewport";
import { useMobileBrowserChromeHide } from "@/hooks/useMobileBrowserChromeHide";

const GAME_SCROLL_SHELL_ID = "game-scroll-shell";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { gameState, gameId, connected } = useGameStore();
  const isMobile = useIsMobile();

  useGameMusic();
  useMobileBrowserChromeHide(GAME_SCROLL_SHELL_ID, isMobile);

  useEffect(() => {
    if (!gameId && !gameState) {
      router.push("/");
    }
  }, [gameId, gameState, router]);

  if (!gameState) {
    return (
      <div
        className="h-full w-full flex items-center justify-center flex-col gap-4"
        style={{ background: "#060810", color: "#4060a0" }}
      >
        <div className="text-4xl animate-pulse">🎮</div>
        <p className="text-sm">Loading game {String(params.id).slice(0, 8)}...</p>
        {!connected && <p className="text-xs" style={{ color: "#ff4444" }}>Reconnecting...</p>}
      </div>
    );
  }

  return (
    <>
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
      <TutorialGuide />
      <RotateDevicePrompt />
    </>
  );
}
