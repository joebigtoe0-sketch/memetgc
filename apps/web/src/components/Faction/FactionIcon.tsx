"use client";

import React from "react";
import { factionColor, factionImageUrl } from "@/lib/factions";

interface Props {
  faction: string;
  size?: number;
  /** Soft glow around the transparent PNG silhouette */
  glow?: boolean;
  style?: React.CSSProperties;
}

export default function FactionIcon({ faction, size = 48, glow = false, style }: Props) {
  const color = factionColor(faction);

  return (
    <img
      src={factionImageUrl(faction)}
      alt=""
      loading="eager"
      draggable={false}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: "contain",
        display: "block",
        filter: glow ? `drop-shadow(0 0 ${Math.round(size * 0.18)}px color-mix(in srgb, ${color} 70%, transparent))` : undefined,
        ...style,
      }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}
