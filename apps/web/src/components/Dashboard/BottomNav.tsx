"use client";

import React from "react";
import { useRouter } from "next/navigation";

type Tab = "play" | "collection" | "shop" | "profile";

const TABS: { key: Tab; label: string; icon: string; href: string }[] = [
  { key: "play", label: "Play", icon: "⚔", href: "/" },
  { key: "collection", label: "Collection", icon: "🃏", href: "/collection" },
  { key: "shop", label: "Shop", icon: "✦", href: "/shop" },
  { key: "profile", label: "Profile", icon: "◈", href: "/profile" },
];

export default function BottomNav({ active }: { active: Tab }) {
  const router = useRouter();
  return (
    <nav style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 36, padding: "12px 0 14px", borderTop: "1px solid rgba(255,255,255,.07)", background: "rgba(8,11,18,.7)", backdropFilter: "blur(8px)" }}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} onClick={() => router.push(t.href)} style={{ cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 6px", position: "relative" }}>
            <span style={{ fontSize: 15, opacity: on ? 1 : 0.55, color: on ? "#f7931a" : "#aeb6c4" }}>{t.icon}</span>
            <span style={{ font: `700 11px var(--font-archivo,'Archivo',sans-serif)`, color: on ? "#f3e8cc" : "#8a93a6" }}>{t.label}</span>
            {on && <span style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 22, height: 2, borderRadius: 2, background: "#f7931a", boxShadow: "0 0 8px #f7931a" }} />}
          </button>
        );
      })}
    </nav>
  );
}
