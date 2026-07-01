"use client";

import React from "react";
import { useRouter } from "next/navigation";
import GameIcon from "@/components/UI/GameIcon";
import type { IconName } from "@/lib/icons";

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
  return (
    <nav style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 36, padding: "12px 0 14px", borderTop: "1px solid rgba(255,255,255,.07)", background: "rgba(8,11,18,.7)", backdropFilter: "blur(8px)" }}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} onClick={() => router.push(t.href)} style={{ cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 6px", position: "relative" }}>
            <GameIcon name={t.icon} size={22} style={{ opacity: on ? 1 : 0.55, filter: on ? "drop-shadow(0 0 6px rgba(247,147,26,.45))" : undefined }} />
            <span style={{ font: `700 11px var(--font-archivo,'Archivo',sans-serif)`, color: on ? "#f3e8cc" : "#8a93a6" }}>{t.label}</span>
            {on && <span style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 22, height: 2, borderRadius: 2, background: "#f7931a", boxShadow: "0 0 8px #f7931a" }} />}
          </button>
        );
      })}
    </nav>
  );
}
