"use client";

import React from "react";
import Logo from "@/components/Brand/Logo";
import { BRAND } from "@/lib/brand";

interface Props {
  percent: number;
  phase: string;
}

export default function AssetLoadingScreen({ percent, phase }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)",
        fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(120% 80% at 85% -10%,rgba(247,147,26,.07),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.07),transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <Logo size={56} />
      <div
        style={{
          marginTop: 18,
          font: `900 20px var(--font-cinzel,'Cinzel',serif)`,
          color: "#f3e8cc",
          letterSpacing: ".5px",
        }}
      >
        {BRAND.shortName.toUpperCase()}
      </div>
      <div
        style={{
          marginTop: 6,
          font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`,
          color: "#8a93a6",
          letterSpacing: "1.5px",
        }}
      >
        PREPARING THE MEMEPOOL
      </div>

      <div style={{ width: "min(340px, 86vw)", marginTop: 36 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            font: `600 11px var(--font-archivo,'Archivo',sans-serif)`,
            color: "#aeb6c4",
          }}
        >
          <span>{phase}</span>
          <span style={{ fontFamily: "var(--font-mono,'JetBrains Mono',monospace)", color: "#e7c768" }}>
            {percent}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 99,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              borderRadius: 99,
              background: "linear-gradient(90deg,#e0890f,#ffe07a)",
              boxShadow: "0 0 14px rgba(224,137,15,.45)",
              transition: "width .25s ease-out",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 14,
            textAlign: "center",
            font: `500 10px var(--font-archivo,'Archivo',sans-serif)`,
            color: "#6a7488",
            lineHeight: 1.5,
          }}
        >
          Caching card art, boards, and sounds for smooth gameplay.
          <br />
          This only happens once per session.
        </div>
      </div>
    </div>
  );
}
