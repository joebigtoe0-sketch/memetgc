"use client";

import React from "react";
import GameIcon from "./GameIcon";
import type { IconName } from "@/lib/icons";

interface Props {
  icon: IconName;
  label: string;
  onClick?: () => void;
}

export default function StatChip({ icon, label, onClick }: Props) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9,
        background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <GameIcon name={icon} size={18} />
      <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7ecf3" }}>{label}</span>
    </div>
  );
}
