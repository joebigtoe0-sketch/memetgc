"use client";

import React from "react";
import { FACTION_COLORS } from "@/lib/constants";

interface Props {
  heroName: string;
  faction: string;
  hp: number;
  armor: number;
  heroPowerName?: string;
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
  const fac = FACTION_COLORS[faction] ?? FACTION_COLORS.degen!;
  const isDangerous = hp <= 10;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Secrets row */}
      {secretCount > 0 && (
        <div className="flex gap-1">
          {Array.from({ length: secretCount }).map((_, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold"
              style={{ background: "#1a0d2e", border: "1px solid #9b6dff", color: "#9b6dff" }}
              title="Smart Contract (Secret)"
            >
              SC
            </div>
          ))}
        </div>
      )}

      {/* Hero portrait */}
      <div
        onClick={onHeroClick}
        className="relative flex flex-col items-center justify-center cursor-pointer"
        style={{
          width: 80,
          height: 80,
          background: `radial-gradient(ellipse, ${fac.bg} 0%, #0d0f1a 70%)`,
          border: `2px solid ${isValidTarget ? "#e0e040" : isDangerous ? "#ff3a3a" : fac.base}`,
          borderRadius: "50%",
          boxShadow: isValidTarget
            ? "0 0 16px 6px rgba(224,224,64,0.7)"
            : isDangerous
            ? "0 0 14px 6px rgba(255,50,50,0.5)"
            : `0 0 10px 3px ${fac.glow}`,
          transition: "all 0.2s",
          transform: isValidTarget ? "scale(1.05)" : "scale(1)",
        }}
      >
        <span className="text-2xl font-black" style={{ color: fac.base }}>
          {heroName[0]}
        </span>
        <span className="text-xs font-medium" style={{ color: fac.base, fontSize: 9, marginTop: 2 }}>
          {heroName}
        </span>
      </div>

      {/* HP + Armor row */}
      <div className="flex gap-1 items-center">
        {armor > 0 && (
          <div
            className="flex items-center justify-center rounded font-black text-white"
            style={{
              width: 28,
              height: 24,
              background: "linear-gradient(135deg, #7df0c0, #1f9c6e)",
              border: "1.5px solid rgba(255,255,255,0.3)",
              fontSize: 11,
              boxShadow: "0 0 6px #7df0c0",
            }}
          >
            {armor}
          </div>
        )}
        <div
          className="flex items-center justify-center rounded font-black text-white"
          style={{
            width: 36,
            height: 28,
            background: isDangerous ? "linear-gradient(135deg, #ff4444, #880000)" : "linear-gradient(135deg, #ff8f7e, #c2271c)",
            border: "1.5px solid rgba(255,255,255,0.3)",
            fontSize: 14,
            boxShadow: isDangerous ? "0 0 8px rgba(255,50,50,0.7)" : "0 0 6px #ff8f7e66",
          }}
        >
          {hp}
        </div>
      </div>

      {/* Weapon */}
      {hasWeapon && (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{ background: "rgba(255,216,119,0.15)", border: "1px solid #ffd877" }}
        >
          <span style={{ color: "#ffd877", fontSize: 10 }}>⚔️ {weaponAttack}/{weaponDurability}</span>
        </div>
      )}

      {/* Hero Power (player side only) */}
      {!isEnemy && heroPowerName && (
        <button
          onClick={onHeroPowerClick}
          disabled={heroPowerUsed}
          className="px-2 py-1 rounded text-xs font-bold transition-all"
          style={{
            background: heroPowerUsed
              ? "rgba(50,50,60,0.6)"
              : `linear-gradient(135deg, ${fac.base}33, ${fac.base}66)`,
            border: `1px solid ${heroPowerUsed ? "#333" : fac.base}`,
            color: heroPowerUsed ? "#555" : fac.base,
            cursor: heroPowerUsed ? "not-allowed" : "pointer",
            boxShadow: heroPowerUsed ? "none" : `0 0 8px ${fac.glow}`,
            fontSize: 9,
          }}
        >
          ⚡ {heroPowerName}
          {heroPowerUsed && " (used)"}
        </button>
      )}
    </div>
  );
}
