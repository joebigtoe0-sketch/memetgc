"use client";

import React from "react";
import MusicSettings from "@/components/Music/MusicSettings";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(4,6,12,.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(360px, 100%)",
          borderRadius: 14,
          background: "#0d1118",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 16px 48px rgba(0,0,0,.65)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Settings</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#5a6478",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "4px 0 8px" }}>
          <MusicSettings />
        </div>
      </div>
    </div>
  );
}
