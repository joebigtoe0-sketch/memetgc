"use client";

import React, { useEffect, useState } from "react";
import { musicManager } from "@/lib/music/MusicManager";
import { getMasterVolume, setMasterVolume } from "@/lib/sounds";

function VolumeSlider({
  label,
  description,
  value,
  disabled,
  onChange,
  accent = "#e7c768",
}: {
  label: string;
  description: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  accent?: string;
}) {
  return (
    <div style={{ padding: "12px 18px" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3" }}>{label}</div>
        <div style={{ font: `500 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", marginTop: 2 }}>
          {description}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={disabled ? 0 : value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: accent }}
        />
        <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", minWidth: 32, textAlign: "right" }}>
          {disabled ? "—" : `${value}%`}
        </span>
      </div>
    </div>
  );
}

export default function MusicSettings() {
  const [musicVolume, setMusicVolume] = useState(40);
  const [sfxVolume, setSfxVolume] = useState(65);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMusicVolume(Math.round(musicManager.getVolume() * 100));
    setSfxVolume(Math.round(getMasterVolume() * 100));
    setMuted(musicManager.isMuted());
  }, []);

  function onMusicVolumeChange(v: number) {
    setMusicVolume(v);
    musicManager.setVolume(v / 100);
  }

  function onSfxVolumeChange(v: number) {
    setSfxVolume(v);
    setMasterVolume(v / 100);
  }

  function onMuteToggle() {
    const nowMuted = musicManager.toggleMute();
    setMuted(nowMuted);
  }

  return (
    <>
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3" }}>Music</div>
            <div style={{ font: `500 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", marginTop: 2 }}>
              Background music volume
            </div>
          </div>
          <button
            onClick={onMuteToggle}
            style={{
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${muted ? "rgba(255,90,90,.4)" : "rgba(255,255,255,.14)"}`,
              background: muted ? "rgba(255,90,90,.12)" : "rgba(255,255,255,.05)",
              color: muted ? "#ff8a8a" : "#c4ccd8",
              font: `700 11px var(--font-archivo,'Archivo',sans-serif)`,
            }}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : musicVolume}
            disabled={muted}
            onChange={(e) => onMusicVolumeChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#e7c768" }}
          />
          <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", minWidth: 32, textAlign: "right" }}>
            {muted ? "—" : `${musicVolume}%`}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "8px 0" }} />

      <VolumeSlider
        label="Sound effects"
        description="UI clicks, cards, combat, and match sounds"
        value={sfxVolume}
        onChange={onSfxVolumeChange}
        accent="#7b8cf4"
      />
    </>
  );
}
