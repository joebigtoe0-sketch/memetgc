"use client";

import React from "react";
import { FACTION_COLORS } from "@/lib/constants";
import type { MinionSlot } from "@memetgc/types";

interface Props {
  slot: MinionSlot;
  isEnemy?: boolean;
  isSelected?: boolean;
  isValidTarget?: boolean;
  isAttacking?: boolean;
  onClick?: () => void;
}

export default function MinionCard({ slot, isEnemy, isSelected, isValidTarget, isAttacking, onClick }: Props) {
  const faction = FACTION_COLORS[slot.card.faction] ?? FACTION_COLORS.degen!;
  const canAct = !isEnemy && !slot.hasAttacked && (!slot.summoningSickness || slot.hasCharge);

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-between cursor-pointer select-none"
      style={{
        width: 72,
        height: 88,
        background: "linear-gradient(160deg, #1a1d2e 0%, #0d0f1a 100%)",
        border: `2px solid ${isSelected ? "#40e080" : isValidTarget ? "#e0e040" : isAttacking ? "#e04020" : faction.base}`,
        borderRadius: 8,
        boxShadow: isSelected
          ? "0 0 14px 4px rgba(64,224,128,0.7)"
          : isValidTarget
          ? "0 0 14px 4px rgba(224,224,64,0.7)"
          : isAttacking
          ? "0 0 14px 4px rgba(224,64,32,0.8)"
          : `0 0 8px 2px ${faction.glow}`,
        transition: "all 0.15s ease",
        transform: isSelected || isAttacking ? "scale(1.08)" : "scale(1)",
        opacity: !canAct && !isEnemy ? 0.8 : 1,
        overflow: "hidden",
      }}
    >
      {/* Art area */}
      <div
        className="w-full flex-1 flex items-center justify-center overflow-hidden"
        style={{
          background: `repeating-linear-gradient(45deg, ${faction.base}12, ${faction.base}12 3px, transparent 3px, transparent 10px)`,
          borderBottom: `1px solid ${faction.base}44`,
        }}
      >
        {slot.card.art_url ? (
          <img src={slot.card.art_url} alt={slot.card.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-center px-1 leading-tight" style={{ color: faction.base, fontSize: 8 }}>
            {slot.card.name.toUpperCase()}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="w-full text-center px-1" style={{ background: "rgba(0,0,0,0.6)", padding: "2px 2px" }}>
        <span className="text-white font-bold truncate block" style={{ fontSize: 7 }}>
          {slot.card.name}
        </span>
      </div>

      {/* Keyword icons */}
      <div className="absolute top-1 left-1 flex flex-col gap-0.5">
        {slot.hasTaunt && (
          <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center" title="HODL">
            <span style={{ fontSize: 7, fontWeight: 900 }}>H</span>
          </div>
        )}
        {slot.hasDivineShield && (
          <div className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center" title="Moon Shot">
            <span style={{ fontSize: 7, fontWeight: 900, color: "#000" }}>M</span>
          </div>
        )}
      </div>

      {/* Attack badge (bottom left) */}
      <div
        className="absolute bottom-1 left-1 flex items-center justify-center font-black text-white rounded-full"
        style={{
          width: 18,
          height: 18,
          fontSize: 9,
          background: "radial-gradient(circle, #ffd877, #d97a16)",
          border: "1.5px solid rgba(255,255,255,0.3)",
          boxShadow: "0 0 5px #ffd87788",
          textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        }}
      >
        {slot.currentAttack + (slot.tempAttackBoost ?? 0)}
      </div>

      {/* Health badge (bottom right) */}
      <div
        className="absolute bottom-1 right-1 flex items-center justify-center font-black text-white rounded-full"
        style={{
          width: 18,
          height: 18,
          fontSize: 9,
          background:
            slot.currentHealth < (slot.card.health ?? slot.maxHealth)
              ? "radial-gradient(circle, #ff4444, #880000)"
              : "radial-gradient(circle, #ff8f7e, #c2271c)",
          border: "1.5px solid rgba(255,255,255,0.3)",
          boxShadow: "0 0 5px #ff8f7e88",
          textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        }}
      >
        {slot.currentHealth}
      </div>

      {/* Summoning sickness overlay */}
      {slot.summoningSickness && !slot.hasCharge && !isEnemy && (
        <div
          className="absolute inset-0 rounded"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(1px)" }}
        />
      )}

      {/* Attacked overlay */}
      {slot.hasAttacked && !isEnemy && (
        <div
          className="absolute inset-0 rounded"
          style={{ background: "rgba(0,0,0,0.2)" }}
        />
      )}

      {/* Taunt ring */}
      {slot.hasTaunt && (
        <div
          className="absolute inset-0 rounded pointer-events-none animate-pulse"
          style={{ border: "2px solid rgba(231,199,104,0.6)", borderRadius: 8 }}
        />
      )}
    </div>
  );
}
