"use client";

import React from "react";
import { factionColor, factionImageUrl } from "@/lib/factions";

interface Props {
  faction: string;
  size?: number;
  shape?: "circle" | "rounded";
  border?: boolean;
  borderWidth?: number;
  glow?: boolean;
  fit?: "cover" | "contain";
  style?: React.CSSProperties;
}

export default function FactionIcon({
  faction,
  size = 48,
  shape = "circle",
  border = true,
  borderWidth = 2,
  glow = false,
  fit = "cover",
  style,
}: Props) {
  const color = factionColor(faction);
  const radius = shape === "circle" ? "50%" : Math.max(6, Math.round(size * 0.28));

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        overflow: "hidden",
        background: `radial-gradient(circle at 40% 30%, color-mix(in srgb, ${color} 30%, #2a2030), #15101a)`,
        border: border ? `${borderWidth}px solid ${color}` : undefined,
        boxShadow: glow ? `0 0 ${Math.round(size * 0.33)}px color-mix(in srgb, ${color} 45%, transparent)` : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <img
        src={factionImageUrl(faction)}
        alt=""
        loading="eager"
        draggable={false}
        style={{
          width: fit === "contain" ? `${Math.round(size * 0.72)}%` : "100%",
          height: fit === "contain" ? `${Math.round(size * 0.72)}%` : "100%",
          objectFit: fit,
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}
