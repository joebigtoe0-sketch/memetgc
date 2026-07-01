"use client";

import React, { useState } from "react";
import { factionDisplayName, factionColor } from "@/lib/factions";
import FactionIcon from "@/components/Faction/FactionIcon";
import GameIcon from "@/components/UI/GameIcon";

interface Props {
  heroName: string;
  faction: string;
  hp: number;
  armor: number;
  heroPowerName?: string;
  heroPowerDescription?: string;
  heroPowerCost?: number;
  heroPowerUsed?: boolean;
  hasWeapon?: boolean;
  weaponAttack?: number;
  weaponDurability?: number;
  isEnemy?: boolean;
  isValidTarget?: boolean;
  onHeroClick?: () => void;
  onHeroPowerClick?: () => void;
  secretCount?: number;
}

export default function HeroZone({
  heroName,
  faction,
  hp,
  armor,
  heroPowerName,
  heroPowerDescription,
  heroPowerCost = 2,
  heroPowerUsed,
  hasWeapon,
  weaponAttack,
  weaponDurability,
  isEnemy,
  isValidTarget,
  onHeroClick,
  onHeroPowerClick,
  secretCount = 0,
}: Props) {
  const [powerTipOpen, setPowerTipOpen] = useState(false);
  const fac = factionColor(faction);
  const facName = factionDisplayName(faction);
  const isDangerous = hp <= 10;

  const portraitSize = isEnemy ? 88 : 96;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {/* Secrets */}
      {secretCount > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: secretCount }).map((_, i) => (
            <div key={i} style={{
              width: 20, height: 20, borderRadius: 5,
              background: "#1a0d2e", border: "1px solid #9b6dff",
              display: "flex", alignItems: "center", justifyContent: "center",
              font: `700 7px var(--font-mono,'JetBrains Mono',monospace)`, color: "#9b6dff",
            }}>SC</div>
          ))}
        </div>
      )}

      {/* Hero portrait */}
      <div
        data-sound-skip-click={onHeroClick ? "" : undefined}
        onClick={onHeroClick}
        style={{
          position: "relative",
          cursor: onHeroClick ? "pointer" : "default",
          transform: isValidTarget ? "scale(1.06)" : "scale(1)",
          transition: "transform 0.15s",
        }}
      >
        <FactionIcon faction={faction} size={portraitSize} />

        {/* HP bubble (bottom-right of portrait) */}
        <div style={{
          position: "absolute", bottom: -4, right: -4,
          width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "50%",
          background: isDangerous
            ? "radial-gradient(circle at 38% 30%,#ff8f7e,#c2271c 70%)"
            : "radial-gradient(circle at 38% 30%,#ff8f7e,#c2271c 70%)",
          boxShadow: `0 0 0 2px #caa24a, ${isDangerous ? "0 0 8px rgba(255,50,50,.7)" : ""}`,
          font: `800 14px/1 var(--font-mono,'JetBrains Mono',monospace)`,
          color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.6)",
        }}>
          {hp}
        </div>

        {/* Armor bubble (over HP) */}
        {armor > 0 && (
          <div style={{
            position: "absolute", bottom: -4, left: -4,
            width: 26, height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%",
            background: "radial-gradient(circle at 38% 30%,#dfe5ec,#7e8a99 70%)",
            boxShadow: "0 0 0 2px #caa24a",
            font: `800 12px/1 var(--font-mono,'JetBrains Mono',monospace)`,
            color: "#1c222c",
          }}>
            {armor}
          </div>
        )}
      </div>

      {/* Hero name + faction */}
      <div style={{ textAlign: isEnemy ? "left" : "right" }}>
        <div style={{ font: `800 14px 'Cinzel',serif`, color: "#f3e8cc" }}>{heroName}</div>
        <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: fac, letterSpacing: "1px" }}>{facName}</div>
      </div>

      {/* Weapon card */}
      {hasWeapon && (
        <div style={{
          position: "relative", width: 50, height: 64, borderRadius: 8,
          background: `linear-gradient(150deg,color-mix(in srgb,${fac} 35%,#1a1f29),#0d1017)`,
          border: `2px solid #caa24a`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 14px rgba(0,0,0,.5)",
          font: `700 8px var(--font-cinzel,'Cinzel',serif)`, color: "#dff7ec", textAlign: "center",
        }}>
          <GameIcon name="battle" size={14} />
          <div style={{ position: "absolute", bottom: -6, left: -6, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 38% 30%,#ffe7a8,#d97a16)", boxShadow: "0 0 0 2px #caa24a", font: `800 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#3a1d00" }}>{weaponAttack}</div>
          <div style={{ position: "absolute", bottom: -6, right: -6, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 38% 30%,#dfe5ec,#7e8a99)", boxShadow: "0 0 0 2px #caa24a", font: `800 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#1c222c" }}>{weaponDurability}</div>
        </div>
      )}

      {/* Hero Power button (player side only) */}
      {!isEnemy && heroPowerName && (
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setPowerTipOpen(true)}
          onMouseLeave={() => setPowerTipOpen(false)}
        >
          {powerTipOpen && heroPowerDescription && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 10px)",
                left: "50%",
                transform: "translateX(-50%)",
                width: 220,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(10,14,22,.96)",
                border: "1px solid rgba(231,199,104,.45)",
                boxShadow: "0 12px 32px rgba(0,0,0,.55), 0 0 20px rgba(231,199,104,.12)",
                zIndex: 40,
                pointerEvents: "none",
              }}
            >
              <div style={{ font: `800 12px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", marginBottom: 4 }}>
                {heroPowerName}
              </div>
              <div style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff", marginBottom: 8 }}>
                {heroPowerCost} mana · once per game
              </div>
              <div style={{ font: `500 11px/1.45 var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4" }}>
                {heroPowerDescription}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: -6,
                  left: "50%",
                  transform: "translateX(-50%) rotate(45deg)",
                  width: 10,
                  height: 10,
                  background: "rgba(10,14,22,.96)",
                  borderRight: "1px solid rgba(231,199,104,.45)",
                  borderBottom: "1px solid rgba(231,199,104,.45)",
                }}
              />
            </div>
          )}
          <button
            onClick={onHeroPowerClick}
            disabled={heroPowerUsed}
            style={{
              position: "relative",
              width: 72, height: 72,
              borderRadius: "50%",
              cursor: heroPowerUsed ? "not-allowed" : "pointer",
              border: `2px solid ${heroPowerUsed ? "#3a4050" : "#e0b13a"}`,
              background: heroPowerUsed ? "radial-gradient(circle at 40% 30%,#2a3040,#0e1015)" : "radial-gradient(circle at 40% 30%,#3a4150,#12161f)",
              boxShadow: heroPowerUsed ? "none" : `0 0 18px rgba(231,199,104,.4)`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              animation: heroPowerUsed ? "none" : "pulseGlow 2.4s ease-in-out infinite",
              opacity: heroPowerUsed ? 0.5 : 1,
            }}
          >
            <span style={{ font: `900 13px var(--font-cinzel,'Cinzel',serif)`, color: heroPowerUsed ? "#5a6478" : "#f3e8cc" }}>
              {heroPowerName}
            </span>
            <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: heroPowerUsed ? "#4a5060" : "#c9b48a", letterSpacing: "1px" }}>
              POWER
            </span>
            <div style={{
              position: "absolute", top: -8, right: -6,
              width: 26, height: 26,
              borderRadius: "50%",
              background: "radial-gradient(circle at 38% 30%,#dcefff,#4a90e6 60%,#1f4f9e)",
              boxShadow: "0 0 0 2px #d6b052",
              display: "flex", alignItems: "center", justifyContent: "center",
              font: `800 12px var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff",
            }}>{heroPowerCost}</div>
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
