"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

const WalletButton = dynamic(() => import("../WalletConnect/WalletButton"), { ssr: false });

const NAV_ITEMS = [
  { href: "/", label: "Play" },
  { href: "/collection", label: "Collection" },
  { href: "/deck-builder", label: "Deck Builder" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { username, fragments, rankTier, logout } = useAuthStore();

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", gap: 14, padding: "11px 22px",
      background: "rgba(8,11,18,.86)", backdropFilter: "blur(10px)",
      borderBottom: "1px solid rgba(231,199,104,.16)",
      height: 52, boxSizing: "border-box",
      fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 8, textDecoration: "none" }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,#f7c64a,#c2860f)", boxShadow: "0 0 10px rgba(231,199,104,.4)", font: `900 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#2a1a00" }}>D</div>
        <span style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: "1px", color: "#f3e8cc" }}>DEGEN TCG</span>
        <span style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#6a7488" }}>UI</span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                cursor: "pointer", padding: "8px 14px", borderRadius: 9, whiteSpace: "nowrap", textDecoration: "none",
                font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, letterSpacing: ".2px",
                border: active ? "1px solid rgba(231,199,104,.6)" : "1px solid rgba(255,255,255,.1)",
                background: active ? "linear-gradient(180deg,rgba(247,147,26,.25),rgba(247,147,26,.1))" : "rgba(255,255,255,.04)",
                color: active ? "#ffd187" : "#aeb6c4",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {username && (
          <>
            {fragments > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(123,140,244,.10)", border: "1px solid rgba(123,140,244,.3)" }}>
                <span style={{ font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7b8cf4" }}>✦</span>
                <span style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c3ccff" }}>{fragments.toLocaleString()}</span>
                <span style={{ font: `600 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#8b93c4" }}>frags</span>
              </div>
            )}
            {rankTier && rankTier !== "Unranked" && (
              <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a", padding: "8px 12px", borderRadius: 9, background: "rgba(247,147,26,.1)", border: "1px solid rgba(247,147,26,.3)" }}>
                {rankTier.toUpperCase()}
              </div>
            )}
            <div title={username} style={{ width: 42, height: 42, borderRadius: 11, background: "linear-gradient(150deg,#2a3142,#161b25)", border: "1.5px solid rgba(231,199,104,.4)", display: "flex", alignItems: "center", justifyContent: "center", font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", cursor: "pointer" }}>
              {username[0]?.toUpperCase()}
            </div>
            <button onClick={logout} style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>
              Logout
            </button>
          </>
        )}
        <WalletButton />
      </div>
    </nav>
  );
}
