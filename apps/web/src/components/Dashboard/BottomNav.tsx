"use client";

import React from "react";
import { useRouter } from "next/navigation";
import GameIcon from "@/components/UI/GameIcon";
import SettingsButton from "@/components/Settings/SettingsButton";
import type { IconName } from "@/lib/icons";
import { useIsMobile } from "@/hooks/useViewport";

type Tab = "play" | "collection" | "packs" | "shop" | "profile";

const TABS: { key: Tab; label: string; icon: IconName; href: string }[] = [
  { key: "play", label: "Play", icon: "battle", href: "/" },
  { key: "collection", label: "Collection", icon: "collection", href: "/collection" },
  { key: "packs", label: "Packs", icon: "pack", href: "/packs" },
  { key: "shop", label: "Shop", icon: "shop", href: "/shop" },
  { key: "profile", label: "Profile", icon: "profile", href: "/profile" },
];

export default function BottomNav({ active }: { active: Tab }) {
  const router = useRouter();
  const isMobile = useIsMobile();

  return (
    <nav
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: isMobile ? "space-around" : "center",
        gap: isMobile ? 0 : 28,
        padding: isMobile
          ? "8px 4px calc(8px + env(safe-area-inset-bottom))"
          : "12px 20px 14px",
        borderTop: "1px solid rgba(255,255,255,.07)",
        background: "rgba(8,11,18,.7)",
        backdropFilter: "blur(8px)",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isMobile ? "space-around" : "center",
          gap: isMobile ? 0 : 36,
          flex: 1,
        }}
      >
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <button key={t.key} onClick={() => router.push(t.href)} style={{ cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 6px", position: "relative", flex: isMobile ? 1 : undefined }}>
              <GameIcon name={t.icon} size={isMobile ? 24 : 22} style={{ opacity: on ? 1 : 0.55, filter: on ? "drop-shadow(0 0 6px rgba(247,147,26,.45))" : undefined }} />
              <span style={{ font: `700 ${isMobile ? 9.5 : 11}px var(--font-archivo,'Archivo',sans-serif)`, color: on ? "#f3e8cc" : "#8a93a6" }}>{t.label}</span>
              {on && <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 22, height: 2, borderRadius: 2, background: "#f7931a", boxShadow: "0 0 8px #f7931a" }} />}
            </button>
          );
        })}
        {isMobile && (
          <div style={{ display: "flex", flex: 1, justifyContent: "center" }}>
            <SettingsButton showLabel />
          </div>
        )}
      </div>
      {!isMobile && <SettingsButton showLabel style={{ position: "absolute", right: 18, bottom: 10 }} />}
    </nav>
  );
}
