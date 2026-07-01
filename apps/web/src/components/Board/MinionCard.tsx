"use client";

import React from "react";
import type { MinionSlot } from "@memetgc/types";

import { factionColor } from "@/lib/factions";

interface Props {
  slot: MinionSlot;
  isEnemy?: boolean;
  isSelected?: boolean;
  isValidTarget?: boolean;
  isAttacking?: boolean;
  isLunging?: boolean;
  isDamageFlash?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
}

export default function MinionCard({ slot, isEnemy, isSelected, isValidTarget, isAttacking, isLunging, isDamageFlash, onClick, onHover }: Props) {
  const fac = factionColor(slot.card.faction);
  const isDamaged = slot.currentHealth < (slot.card.health ?? slot.maxHealth ?? slot.currentHealth);
  const hp1 = isDamaged ? "#ff6a5a" : "#ff8f7e";
  const hp2 = isDamaged ? "#9c1209" : "#c2271c";
  const sick = !!(slot.summoningSickness && !slot.hasCharge && !isEnemy);
  const attacked = !!(slot.hasAttacked && !isEnemy);
  const taunt = slot.hasTaunt;
  const shield = slot.hasDivineShield;

  const atk = (slot.currentAttack ?? 0) + (slot.tempAttackBoost ?? 0);

  // Glow border for interactive states
  let borderColor = "#caa24a";
  let outerShadow = `0 6px 12px rgba(0,0,0,.55), 0 1px 0 rgba(255,240,190,.3)`;
  if (isValidTarget) {
    borderColor = "#e0e040";
    outerShadow = `0 0 16px 4px rgba(224,224,64,0.7), 0 6px 12px rgba(0,0,0,.55)`;
  } else if (isSelected || isAttacking) {
    borderColor = "#40e080";
    outerShadow = `0 0 16px 4px rgba(64,224,128,0.7), 0 6px 12px rgba(0,0,0,.55)`;
  } else if (taunt) {
    outerShadow = `0 0 0 2px rgba(231,199,104,.9), 0 0 14px rgba(231,199,104,.55)`;
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{
        position: "relative",
        width: 96,
        height: 116,
        fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
        borderRadius: 11,
        cursor: "pointer",
        transform: (isSelected || isAttacking || isValidTarget) ? "scale(1.06) translateY(-4px)" : "scale(1)",
        transition: isLunging || isDamageFlash ? "none" : "transform 0.15s ease, box-shadow 0.15s ease",
        animation: isLunging
          ? isEnemy ? "minionLungeDown 0.52s ease-in-out" : "minionLungeUp 0.52s ease-in-out"
          : isDamageFlash
          ? `damageFlash 0.45s ease-in-out`
          : taunt ? "bmTaunt 1.8s ease-in-out infinite" : "none",
        boxShadow: taunt && !isSelected && !isValidTarget
          ? "0 0 0 2px rgba(231,199,104,.9), 0 0 14px rgba(231,199,104,.55)"
          : undefined,
      }}
    >
      {/* Gold border frame */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 11, padding: 3, boxSizing: "border-box",
        background: `linear-gradient(160deg,${borderColor},${borderColor}88 55%,${borderColor}44)`,
        boxShadow: outerShadow,
      }}>
        {/* Inner faction-colored content */}
        <div style={{
          position: "relative", width: "100%", height: "100%", borderRadius: 9, overflow: "hidden",
          background: `radial-gradient(120% 90% at 50% 0%,color-mix(in srgb,${fac} 22%,#1a1f29),#0e1219)`,
          boxShadow: `inset 0 0 0 1.5px color-mix(in srgb,${fac} 55%,#000)`,
        }}>
          {/* Art window: full card image, with name fallback underneath (shows on 404) */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            background: `repeating-linear-gradient(135deg,color-mix(in srgb,${fac} 16%,transparent) 0 8px,transparent 8px 16px)`,
          }}>
            <div style={{ font: `700 9px/1.1 var(--font-archivo,'Archivo',sans-serif)`, textAlign: "center", color: `color-mix(in srgb,${fac} 50%,#fff)`, textShadow: "0 1px 2px #000", padding: "0 6px" }}>
              {(slot.card.name ?? "").toUpperCase()}
            </div>
            <img
              src={slot.card.art_url ?? `/card-art/${slot.card.id}.png`}
              alt={slot.card.name}
              loading="eager"
              style={{
                width: "108%",
                height: "112%",
                objectFit: "cover",
                objectPosition: "50% 12%",
                position: "absolute",
                left: "50%",
                top: "-6%",
                transform: "translateX(-50%)",
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          {/* Divine Shield inner glow */}
          {shield && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 9,
              boxShadow: "inset 0 0 0 2.5px rgba(240,244,255,.95), inset 0 0 12px rgba(200,220,255,.7)",
              animation: "bmShield 1.6s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}
        </div>
      </div>

      {/* Name tag (top-center, outside frame) */}
      <div style={{
        position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)",
        maxWidth: "92%", padding: "2px 7px", borderRadius: 5, zIndex: 3,
        background: "linear-gradient(#2f3645,#161b24)",
        border: `1px solid color-mix(in srgb,${fac} 40%,#0a0d12)`,
        boxShadow: "0 2px 4px rgba(0,0,0,.5)",
        font: `700 8.5px/1 var(--font-cinzel,'Cinzel',serif)`,
        color: "#f3e8cc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {slot.card.name}
      </div>

      {/* Attack bubble (bottom-left) */}
      <div style={{
        position: "absolute", bottom: -8, left: -8, zIndex: 4,
        width: 30, height: 30,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%",
        background: "radial-gradient(circle at 38% 30%,#ffe7a8,#d97a16 70%)",
        boxShadow: "0 0 0 2px #caa24a, 0 2px 5px rgba(0,0,0,.6)",
      }}>
        <span style={{ font: `800 15px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#3a1d00", textShadow: "0 1px 0 rgba(255,255,255,.3)" }}>
          {atk}
        </span>
      </div>

      {/* Health bubble (bottom-right) */}
      <div style={{
        position: "absolute", bottom: -8, right: -8, zIndex: 4,
        width: 30, height: 30,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%",
        background: `radial-gradient(circle at 38% 30%,${hp1},${hp2} 70%)`,
        boxShadow: "0 0 0 2px #caa24a, 0 2px 5px rgba(0,0,0,.6)",
      }}>
        <span style={{ font: `800 15px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>
          {slot.currentHealth}
        </span>
      </div>

      {/* Summoning sickness overlay */}
      {sick && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 11, background: "rgba(8,10,16,.45)", backdropFilter: "saturate(.4)", zIndex: 2, pointerEvents: "none" }} />
      )}

      {/* Attacked overlay */}
      {attacked && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 11, background: "rgba(0,0,0,0.25)", zIndex: 2, pointerEvents: "none" }} />
      )}

      <style>{`
        @keyframes bmTaunt {
          0%, 100% { box-shadow: 0 0 0 2px rgba(231,199,104,.9), 0 0 14px rgba(231,199,104,.55); }
          50% { box-shadow: 0 0 0 3px rgba(255,228,150,1), 0 0 22px rgba(231,199,104,.85); }
        }
        @keyframes bmShield {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
        @keyframes minionLungeUp {
          0%   { transform: translateY(0) scale(1); }
          30%  { transform: translateY(-44px) scale(1.08); }
          60%  { transform: translateY(-44px) scale(1.06); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes minionLungeDown {
          0%   { transform: translateY(0) scale(1); }
          30%  { transform: translateY(44px) scale(1.08); }
          60%  { transform: translateY(44px) scale(1.06); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes damageFlash {
          0%,100% { filter: none; }
          35%     { filter: brightness(2.2) saturate(0.15) sepia(0.8) hue-rotate(-15deg); }
        }
      `}</style>
    </div>
  );
}
