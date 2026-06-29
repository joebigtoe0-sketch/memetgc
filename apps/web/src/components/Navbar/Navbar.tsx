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
    <nav
      className="flex items-center justify-between px-4"
      style={{
        height: 52,
        background: "rgba(6,8,16,0.95)",
        borderBottom: "1px solid #1a2040",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        <span
          className="font-black text-xl tracking-tight"
          style={{ color: "#f7931a", textShadow: "0 0 10px rgba(247,147,26,0.5)" }}
        >
          DEGEN
        </span>
        <span className="font-black text-xl tracking-tight" style={{ color: "#7b8cf4" }}>
          TCG
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded text-sm font-medium no-underline transition-all"
              style={{
                color: active ? "#f7931a" : "#6080a0",
                background: active ? "rgba(247,147,26,0.08)" : "transparent",
                border: active ? "1px solid rgba(247,147,26,0.3)" : "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Right side — user info */}
      <div className="flex items-center gap-3">
        {username && (
          <>
            {/* Fragments */}
            <div className="flex items-center gap-1 text-xs" style={{ color: "#f7931a" }}>
              <span>💎</span>
              <span className="font-bold">{fragments.toLocaleString()}</span>
            </div>
            {/* Rank */}
            <div
              className="px-2 py-0.5 rounded text-xs font-bold uppercase"
              style={{ background: "rgba(30,50,100,0.4)", border: "1px solid #2a3560", color: "#6080c0" }}
            >
              {rankTier}
            </div>
            {/* Username */}
            <span className="text-sm" style={{ color: "#8090b0" }}>{username}</span>
            <button
              onClick={logout}
              className="text-xs px-2 py-1 rounded"
              style={{ color: "#604040", background: "transparent", border: "none", cursor: "pointer" }}
            >
              Logout
            </button>
          </>
        )}
        <WalletButton />
      </div>
    </nav>
  );
}
