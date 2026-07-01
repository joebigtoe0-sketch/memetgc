"use client";

import React from "react";
import { useSettingsStore } from "@/store/settingsStore";

const btnStyle: React.CSSProperties = {
  cursor: "pointer",
  width: 40,
  height: 40,
  borderRadius: 10,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#c4ccd8",
  fontSize: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export default function SettingsButton({
  style,
  showLabel,
}: {
  style?: React.CSSProperties;
  showLabel?: boolean;
}) {
  const openSettings = useSettingsStore((s) => s.openSettings);

  if (showLabel) {
    return (
      <button
        onClick={openSettings}
        title="Settings"
        style={{
          cursor: "pointer",
          background: "none",
          border: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "2px 6px",
        }}
      >
        <span style={{ fontSize: 22, opacity: 0.75, lineHeight: 1 }}>⚙</span>
        <span style={{ font: `700 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6" }}>Settings</span>
      </button>
    );
  }

  return (
    <button onClick={openSettings} title="Settings" style={{ ...btnStyle, ...style }}>
      ⚙
    </button>
  );
}
