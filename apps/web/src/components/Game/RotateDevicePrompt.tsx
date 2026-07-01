"use client";

import React from "react";
import { useViewportSize, useIsMobile } from "@/hooks/useViewport";

/**
 * Full-screen overlay shown on the battle screen when a mobile device is held
 * in portrait. The board is landscape-first, so we ask players to rotate.
 */
export default function RotateDevicePrompt() {
  const { isPortrait } = useViewportSize();
  const isMobile = useIsMobile();

  if (!isMobile || !isPortrait) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "radial-gradient(120% 90% at 50% 40%,#0d1422 0%,#06080d 75%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 28,
        textAlign: "center",
        fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
      }}
    >
      <div style={{ fontSize: 64, animation: "rotateHint 2s ease-in-out infinite", lineHeight: 1 }}>📱</div>
      <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>
        Rotate your device
      </div>
      <div style={{ font: `500 14px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", maxWidth: 320, lineHeight: 1.5 }}>
        The battle screen is best played in landscape. Turn your phone sideways to enter the arena.
      </div>
      <style>{`
        @keyframes rotateHint {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(90deg); }
        }
      `}</style>
    </div>
  );
}
