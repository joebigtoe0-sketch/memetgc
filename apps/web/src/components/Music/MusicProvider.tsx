"use client";

import React, { useEffect, useState } from "react";
import { musicManager } from "@/lib/music/MusicManager";
import { useMusicUnlock, useRouteMusic } from "@/hooks/useMusic";

export default function MusicProvider({ children }: { children: React.ReactNode }) {
  useMusicUnlock();
  useRouteMusic();
  return <>{children}</>;
}

export function SoundEnableHint() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !musicManager.isUnlocked();
  });

  useEffect(() => {
    if (musicManager.isUnlocked()) return;
    const hide = () => setShow(false);
    window.addEventListener("pointerdown", hide, { once: true });
    return () => window.removeEventListener("pointerdown", hide);
  }, []);

  if (!show || musicManager.isUnlocked()) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 88,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 90,
        padding: "10px 18px",
        borderRadius: 12,
        background: "rgba(12,16,26,.92)",
        border: "1px solid rgba(231,199,104,.35)",
        color: "#e7c768",
        font: `600 12px var(--font-archivo,'Archivo',sans-serif)`,
        boxShadow: "0 8px 28px rgba(0,0,0,.45)",
        pointerEvents: "none",
        animation: "soundHintPulse 2.4s ease-in-out infinite",
      }}
    >
      🔊 Click anywhere to enable sound
      <style>{`
        @keyframes soundHintPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
