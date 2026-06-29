"use client";

import React from "react";
import { FACTION_COLORS, RARITY_STYLE, STAT_COLORS, KEYWORD_BADGE_COLORS, KEYWORD_DISPLAY_ORDER } from "@/lib/constants";

export interface CardData {
  id: string;
  name: string;
  cost: number;
  type: string;
  faction: string;
  rarity: string;
  tribe?: string;
  attack?: number;
  health?: number;
  durability?: number;
  armor?: number;
  text?: string;
  flavor_text?: string;
  art_url?: string;
  keywords?: Array<{ id: string; display: string }>;
  is_animated?: boolean;
  hasDivineShield?: boolean;
  hasTaunt?: boolean;
  currentAttack?: number;
  currentHealth?: number;
}

interface Props {
  card: CardData;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  glowing?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
}

const SIZE_MAP = {
  sm: { width: 130, height: 190, scale: 0.5 },
  md: { width: 195, height: 285, scale: 0.75 },
  lg: { width: 260, height: 380, scale: 1 },
};

export default function CardComponent({
  card,
  size = "md",
  interactive = false,
  glowing = false,
  selected = false,
  dimmed = false,
  onClick,
  onRightClick,
}: Props) {
  const faction = FACTION_COLORS[card.faction] ?? FACTION_COLORS.degen!;
  const rarity = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common!;
  const { width, height } = SIZE_MAP[size];

  // Sort keywords by display priority
  const sortedKeywords = [...(card.keywords ?? [])].sort((a, b) => {
    const ai = KEYWORD_DISPLAY_ORDER.indexOf(a.id);
    const bi = KEYWORD_DISPLAY_ORDER.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const leftStat = getLeftStat(card);
  const rightStat = getRightStat(card);

  const currentAtk = card.currentAttack ?? card.attack;
  const currentHp = card.currentHealth ?? card.health;

  const hasTaunt = card.hasTaunt ?? card.keywords?.some((k) => k.id === "taunt");
  const hasDivineShield = card.hasDivineShield;

  return (
    <div
      className={`relative select-none ${interactive ? "cursor-pointer" : ""} ${dimmed ? "opacity-50" : ""}`}
      style={{ width, height }}
      onClick={onClick}
      onContextMenu={onRightClick}
    >
      {/* Outer glow for legendary/selected/taunt */}
      {(glowing || selected || hasTaunt) && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: hasTaunt
              ? `0 0 20px 8px rgba(231,199,104,0.7), inset 0 0 10px rgba(231,199,104,0.3)`
              : selected
              ? `0 0 16px 6px ${faction.glow}`
              : `0 0 12px 4px ${rarity.glow || faction.glow}`,
            zIndex: 10,
          }}
        />
      )}

      {/* Divine Shield shimmer */}
      {hasDivineShield && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none animate-pulse"
          style={{ boxShadow: "0 0 18px 8px rgba(240,244,255,0.8), inset 0 0 10px rgba(240,244,255,0.4)", zIndex: 10 }}
        />
      )}

      {/* Card Frame */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #1a1d2e 0%, #0d0f1a 100%)",
          border: `2px solid ${faction.base}`,
          boxShadow: `inset 0 0 20px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Faction color bar at top */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, transparent, ${faction.base}, transparent)` }}
        />

        {/* Cost gem (top-left) */}
        <div
          className="absolute top-2 left-2 flex items-center justify-center rounded-full font-black text-white z-10"
          style={{
            width: size === "lg" ? 36 : size === "md" ? 27 : 18,
            height: size === "lg" ? 36 : size === "md" ? 27 : 18,
            fontSize: size === "lg" ? 16 : size === "md" ? 12 : 8,
            background: `radial-gradient(circle, ${faction.base}, rgba(0,0,0,0.8))`,
            border: `2px solid ${faction.base}`,
            boxShadow: `0 0 8px ${faction.glow}`,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {card.cost}
        </div>

        {/* Rarity gem (top-right) */}
        <div
          className="absolute top-2 right-2 rounded-full"
          style={{
            width: size === "lg" ? 14 : size === "md" ? 10 : 7,
            height: size === "lg" ? 14 : size === "md" ? 10 : 7,
            background: `radial-gradient(circle, ${rarity.gem1}, ${rarity.gem2})`,
            boxShadow: rarity.glow !== "transparent" ? `0 0 6px ${rarity.glow}` : "none",
          }}
        />

        {/* Art area */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: size === "lg" ? 10 : size === "md" ? 8 : 5,
            left: size === "lg" ? 14 : size === "md" ? 10 : 7,
            right: size === "lg" ? 14 : size === "md" ? 10 : 7,
            height: size === "lg" ? 160 : size === "md" ? 120 : 80,
            borderRadius: 6,
            border: `1px solid ${faction.base}44`,
          }}
        >
          {card.art_url ? (
            <img
              src={card.art_url}
              alt={card.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ArtPlaceholder card={card} faction={faction} rarity={card.rarity} size={size} />
          )}
        </div>

        {/* Name bar */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: size === "lg" ? 174 : size === "md" ? 131 : 87,
            left: size === "lg" ? 8 : 6,
            right: size === "lg" ? 8 : 6,
            height: size === "lg" ? 24 : size === "md" ? 18 : 12,
            background: "rgba(0,0,0,0.7)",
            borderRadius: 4,
            border: `1px solid ${faction.base}66`,
          }}
        >
          <span
            className="font-bold text-white uppercase tracking-wide truncate"
            style={{ fontSize: size === "lg" ? 11 : size === "md" ? 8 : 6, maxWidth: "90%" }}
          >
            {card.name}
          </span>
        </div>

        {/* Tribe tag */}
        {card.tribe && size !== "sm" && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: size === "lg" ? 200 : 150,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: size === "lg" ? 8 : 6,
              color: faction.base,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {card.tribe.toUpperCase()}
          </div>
        )}

        {/* Keyword badges */}
        {sortedKeywords.length > 0 && size !== "sm" && (
          <div
            className="absolute flex flex-wrap gap-0.5 justify-center"
            style={{
              top: size === "lg" ? (card.tribe ? 210 : 200) : 155,
              left: size === "lg" ? 8 : 6,
              right: size === "lg" ? 8 : 6,
            }}
          >
            {sortedKeywords.slice(0, 4).map((kw) => (
              <span
                key={kw.id}
                className="font-bold rounded px-1"
                style={{
                  background: KEYWORD_BADGE_COLORS[kw.id] ?? "#888",
                  color: "#000",
                  fontSize: size === "lg" ? 8 : 6,
                  lineHeight: "14px",
                }}
              >
                {kw.display}
              </span>
            ))}
          </div>
        )}

        {/* Card text area */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: size === "lg" ? 228 : size === "md" ? 174 : 115,
            left: size === "lg" ? 10 : 8,
            right: size === "lg" ? 10 : 8,
            bottom: size === "lg" ? 44 : size === "md" ? 33 : 22,
            fontSize: size === "lg" ? 9 : size === "md" ? 7 : 5,
            color: "#c8d0e0",
            lineHeight: 1.4,
          }}
        >
          <p>{card.text}</p>
          {card.flavor_text && size === "lg" && (
            <p className="mt-1 text-xs" style={{ fontStyle: "italic", color: "#6a7282", fontSize: 8 }}>
              {card.flavor_text}
            </p>
          )}
        </div>

        {/* Bottom divider */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${faction.base}88, transparent)` }}
        />

        {/* Stat badges */}
        {leftStat && (
          <StatBadge
            value={leftStat.type === "attack" ? (currentAtk ?? leftStat.value) : leftStat.value}
            colorStart={STAT_COLORS[leftStat.type as keyof typeof STAT_COLORS]?.[0] ?? "#fff"}
            colorEnd={STAT_COLORS[leftStat.type as keyof typeof STAT_COLORS]?.[1] ?? "#888"}
            side="left"
            size={size}
          />
        )}
        {rightStat && (
          <StatBadge
            value={rightStat.type === "health" ? (currentHp ?? rightStat.value) : rightStat.value}
            colorStart={STAT_COLORS[rightStat.type as keyof typeof STAT_COLORS]?.[0] ?? "#fff"}
            colorEnd={STAT_COLORS[rightStat.type as keyof typeof STAT_COLORS]?.[1] ?? "#888"}
            side="right"
            size={size}
          />
        )}
      </div>
    </div>
  );
}

function StatBadge({
  value,
  colorStart,
  colorEnd,
  side,
  size,
}: {
  value: number;
  colorStart: string;
  colorEnd: string;
  side: "left" | "right";
  size: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? 32 : size === "md" ? 24 : 16;
  const fs = size === "lg" ? 14 : size === "md" ? 11 : 7;

  return (
    <div
      className="absolute flex items-center justify-center font-black text-white rounded-full"
      style={{
        bottom: size === "lg" ? 6 : 4,
        [side]: size === "lg" ? 8 : 6,
        width: dim,
        height: dim,
        fontSize: fs,
        background: `radial-gradient(circle, ${colorStart}, ${colorEnd})`,
        border: `2px solid rgba(255,255,255,0.3)`,
        boxShadow: `0 0 8px ${colorStart}88`,
        textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        zIndex: 5,
      }}
    >
      {value}
    </div>
  );
}

function ArtPlaceholder({ card, faction, rarity, size }: { card: CardData; faction: { base: string }; rarity: string; size: string }) {
  const isLegendary = rarity === "legendary";

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: `repeating-linear-gradient(45deg, ${faction.base}15, ${faction.base}15 4px, transparent 4px, transparent 16px)` }}
    >
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, ${faction.base}22 0%, transparent 70%)` }}
      />
      {isLegendary && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: `linear-gradient(135deg, transparent 40%, ${faction.base}33 50%, transparent 60%)` }}
        />
      )}
      <span
        className="relative text-center font-bold uppercase"
        style={{ color: faction.base, fontSize: size === "lg" ? 9 : 7, opacity: 0.9, padding: "0 4px" }}
      >
        {card.name}
      </span>
      <span
        className="relative text-center uppercase"
        style={{ color: faction.base, fontSize: size === "lg" ? 7 : 5, opacity: 0.5, marginTop: 2 }}
      >
        ART PLACEHOLDER
      </span>
    </div>
  );
}

function getLeftStat(card: CardData): { type: string; value: number } | null {
  if (card.type === "minion" || card.type === "weapon") {
    return { type: "attack", value: card.attack ?? 0 };
  }
  if (card.type === "hero" && (card.armor ?? 0) > 0) {
    return { type: "armor", value: card.armor ?? 0 };
  }
  return null;
}

function getRightStat(card: CardData): { type: string; value: number } | null {
  if (card.type === "minion" || card.type === "hero") {
    return { type: "health", value: card.health ?? 0 };
  }
  if (card.type === "weapon" || card.type === "location") {
    return { type: "durability", value: card.durability ?? 0 };
  }
  return null;
}
