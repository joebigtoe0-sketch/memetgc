"use client";

import React, { useRef } from "react";
import { factionColor, factionImageUrl } from "@/lib/factions";
import { cardArtUrl } from "@/lib/cardArt";
import { playSound } from "@/lib/sounds";

export interface CardData {
  id: string;
  name: string;
  cost: number;
  costModifier?: number;
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
  /** How many copies the player owns — drives the frame tier (silver >50, gold >100). */
  ownedCount?: number;
}

interface Props {
  card: CardData;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  glowing?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  soundOnHover?: boolean;
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
}

const RARITY_GEM: Record<string, [string, string]> = {
  common:    ["#dfe6f0", "#8d95a3"],
  rare:      ["#7cc4ff", "#2b6fd0"],
  epic:      ["#d29bff", "#8a32d8"],
  legendary: ["#ffe07a", "#e0890f"],
};

// Frame tier driven by how many copies you own: dark by default, silver >50, gold >100.
const FRAME: Record<"dark" | "silver" | "gold", { bg: string; edge: string; glow: string }> = {
  dark: {
    bg: "linear-gradient(150deg,#171b22 0%,#262b34 38%,#0d1015 50%,#262b34 62%,#0a0c10 100%)",
    edge: "rgba(255,255,255,.07)",
    glow: "transparent",
  },
  silver: {
    bg: "linear-gradient(150deg,#33373d 0%,#7e858f 17%,#d6dbe2 37%,#ffffff 50%,#d6dbe2 63%,#7e858f 83%,#2c3036 100%)",
    edge: "rgba(255,255,255,.55)",
    glow: "rgba(200,210,225,.5)",
  },
  gold: {
    bg: "linear-gradient(150deg,#5e431a 0%,#a9842f 17%,#e7c768 37%,#fff2be 50%,#e7c768 63%,#a9842f 83%,#553c17 100%)",
    edge: "rgba(255,240,190,.5)",
    glow: "rgba(231,199,104,.55)",
  },
};
function frameTier(owned?: number): "dark" | "silver" | "gold" {
  if (owned != null && owned > 100) return "gold";
  if (owned != null && owned > 50) return "silver";
  return "dark";
}

// sm=0.5×, md=0.75×, lg=1× all based on a 260×380 design
const SCALE: Record<string, number> = { sm: 0.5, md: 0.75, lg: 1 };
// displayed outer size (the 260×380 scaled)
const OUTER = { sm: { w: 130, h: 190 }, md: { w: 195, h: 285 }, lg: { w: 260, h: 380 } };

export default function CardComponent({
  card,
  size = "md",
  glowing = false,
  selected = false,
  dimmed = false,
  soundOnHover = false,
  onClick,
  onRightClick,
}: Props) {
  const fac = factionColor(card.faction);
  const [gem1, gem2] = RARITY_GEM[card.rarity] ?? RARITY_GEM.common;
  const isLeg = card.rarity === "legendary";
  const scale = SCALE[size];
  const outer = OUTER[size];
  const tier = frameTier(card.ownedCount);
  const frame = FRAME[tier];

  // Stats
  const currentAtk = card.currentAttack ?? card.attack;
  const currentHp = card.currentHealth ?? card.health;
  const showLeft = card.type === "minion" || card.type === "weapon" || (card.type === "hero" && (card.armor ?? 0) > 0);
  const showRight = card.type === "minion" || card.type === "weapon" || card.type === "hero" || card.type === "location";
  const leftVal = card.type === "hero" ? (card.armor ?? 0) : (currentAtk ?? 0);
  const leftColors: [string, string] = card.type === "hero" ? ["#dfe5ec", "#7e8a99"] : ["#ffd877", "#d97a16"];
  const rightVal = (card.type === "weapon" || card.type === "location") ? (card.durability ?? 0) : (currentHp ?? 0);
  const rightColors: [string, string] = (card.type === "weapon" || card.type === "location") ? ["#dfe5ec", "#7e8a99"] : ["#ff8f7e", "#c2271c"];
  const typeLabel = { minion: "Minion", spell: "Spell", weapon: "Weapon", hero: "Hero", location: "Location" }[card.type] ?? "Card";
  const artSrc = cardArtUrl(card.id, card.art_url);

  // Effective cost reflecting in-game cost modifiers (e.g. "reduce cost of cards in hand")
  const costMod = card.costModifier ?? 0;
  const effectiveCost = Math.max(0, card.cost + costMod);
  const costReduced = costMod < 0;
  const costRaised = costMod > 0;
  const costBubbleBg = costReduced
    ? "radial-gradient(circle at 38% 30%,#d8ffe6 0%,#3fcf6e 52%,#157f3a 100%)"
    : costRaised
    ? "radial-gradient(circle at 38% 30%,#ffd8d8 0%,#e6604a 52%,#9e2718 100%)"
    : "radial-gradient(circle at 38% 30%,#dcefff 0%,#4a90e6 52%,#1f4f9e 100%)";

  const hoverPlayed = useRef(false);
  function handleMouseEnter() {
    if (!soundOnHover || hoverPlayed.current) return;
    hoverPlayed.current = true;
    playSound("cardHover", 0.55);
  }
  function handleMouseLeave() {
    hoverPlayed.current = false;
  }

  return (
    <div
      {...(onClick || onRightClick ? { "data-sound-skip-click": "" } : {})}
      style={{
        width: outer.w,
        height: outer.h,
        position: "relative",
        flexShrink: 0,
        opacity: dimmed ? 0.5 : 1,
        cursor: onClick ? "pointer" : "default",
        filter: tier === "gold"
          ? `drop-shadow(0 0 13px rgba(224,137,15,0.55))`
          : tier === "silver"
          ? `drop-shadow(0 0 11px rgba(200,210,225,0.5))`
          : glowing || selected ? `drop-shadow(0 0 10px ${fac})` : undefined,
      }}
      onClick={onClick}
      onContextMenu={onRightClick}
      onMouseEnter={soundOnHover ? handleMouseEnter : undefined}
      onMouseLeave={soundOnHover ? handleMouseLeave : undefined}
    >
      {/* Scaled inner — always renders at 260×380, scaled down */}
      <div style={{ width: 260, height: 380, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>

        {/* Frame (tier: dark default, silver >50 owned, gold >100 owned) */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 18,
          background: frame.bg,
          boxShadow: `inset 0 0 0 1px ${frame.edge}, inset 0 0 6px rgba(0,0,0,.45), 0 10px 22px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.5)${tier !== "dark" ? `, 0 0 14px ${frame.glow}` : ""}${selected ? `, 0 0 0 3px #40e080` : ""}`,
          padding: 11,
          boxSizing: "border-box",
        }}>
          {/* Inner dark content area */}
          <div style={{
            position: "relative", width: "100%", height: "100%", borderRadius: 10,
            padding: "10px 10px 0",
            background: "radial-gradient(125% 85% at 50% 0%,#2b3340 0%,#161b25 62%,#0d1017 100%)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,.7), inset 0 2px 8px rgba(0,0,0,.6)",
            boxSizing: "border-box",
          }}>
            {/* Art window */}
            <div style={{
              position: "relative",
              height: 178,
              borderRadius: "48% 48% 16% 16% / 30% 30% 10% 10%",
              overflow: "hidden",
              background: `repeating-linear-gradient(135deg, color-mix(in srgb,${fac} 26%,#171c26) 0 11px, #13171f 11px 22px)`,
              boxShadow: `inset 0 0 0 2px rgba(0,0,0,.55), 0 0 0 2px ${fac}, 0 0 0 4px rgba(0,0,0,.7), 0 0 14px color-mix(in srgb,${fac} 45%,transparent)`,
            }}>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 5, textAlign: "center", padding: "0 16px",
              }}>
                <img
                  src={factionImageUrl(card.faction)}
                  alt=""
                  draggable={false}
                  style={{ width: Math.round(64 * scale), height: Math.round(64 * scale), objectFit: "contain", opacity: 0.45 }}
                />
                <div style={{ font: `800 12px/1.15 var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", color: `color-mix(in srgb,${fac} 55%,#cfd6e0)`, textShadow: "0 1px 3px #000" }}>
                  {card.name.toUpperCase()}
                </div>
                <div style={{ font: `700 7.5px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1.5px", color: "rgba(255,255,255,.32)" }}>
                  ART PLACEHOLDER
                </div>
              </div>
              <img
                src={artSrc}
                alt={card.name}
                style={{
                  position: "absolute",
                  zIndex: 1,
                  left: "50%",
                  top: "-6%",
                  width: "108%",
                  height: "112%",
                  transform: "translateX(-50%)",
                  objectFit: "cover",
                  objectPosition: "50% 12%",
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {/* Legendary sheen — above art (z-index 2) */}
              {isLeg && (
                <div style={{
                  position: "absolute", top: 0, bottom: 0, width: "38%", left: 0, zIndex: 2,
                  background: "linear-gradient(90deg,transparent,rgba(255,243,200,.5),transparent)",
                  mixBlendMode: "screen",
                  animation: "dcSheen 3.6s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
            </div>

            {/* Name bar */}
            <div style={{
              position: "relative", margin: "-14px auto 0", width: "97%", height: 32, zIndex: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6,
              background: "linear-gradient(#2f3645,#161b24)",
              border: `1px solid color-mix(in srgb,${fac} 38%,#0a0d12)`,
              boxShadow: "inset 0 1px 0 rgba(231,199,104,.45), inset 0 -1px 0 rgba(0,0,0,.6), 0 3px 6px rgba(0,0,0,.5)",
            }}>
              <span style={{
                font: `700 14px/1 var(--font-cinzel,'Cinzel',serif)`,
                color: "#f3e8cc",
                letterSpacing: ".3px",
                textShadow: `0 1px 2px #000, 0 0 6px color-mix(in srgb,${fac} 30%,transparent)`,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "94%",
              }}>
                {card.name}
              </span>
              {/* Rarity diamond gem (bottom-center of name bar) */}
              <div style={{
                position: "absolute", left: "50%", bottom: -8,
                width: 15, height: 15,
                transform: "translateX(-50%) rotate(45deg)",
                background: `linear-gradient(135deg,${gem1},${gem2})`,
                boxShadow: `0 0 0 1.5px #caa24a, 0 0 6px color-mix(in srgb,${gem1} 60%,transparent), inset 0 0 3px rgba(255,255,255,.6)`,
                borderRadius: 2,
              }} />
            </div>

            {/* Card text */}
            <div style={{
              margin: "11px 7px 0",
              textAlign: "center",
              font: `500 10.5px/1.32 var(--font-archivo,'Archivo',sans-serif)`,
              color: "#d3d9e3",
            }}>
              {card.text}
              {/* Keyword badges */}
              {card.keywords && card.keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 4 }}>
                  {card.keywords.slice(0, 4).map((kw) => (
                    <span key={kw.id} style={{
                      padding: "1px 6px", borderRadius: 4,
                      background: KEYWORD_COLORS[kw.id] ?? "#888",
                      color: "#000", fontSize: 8, fontWeight: 800, lineHeight: "14px",
                      fontFamily: "var(--font-mono,'JetBrains Mono',monospace)",
                    }}>
                      {kw.display}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cost bubble (top-left, outside frame) */}
        <div style={{
          position: "absolute", top: -8, left: -9, zIndex: 8,
          width: 52, height: 52,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "50%",
          background: costBubbleBg,
          boxShadow: `0 0 0 3px #d6b052, 0 0 0 5px rgba(0,0,0,.65), 0 4px 9px rgba(0,0,0,.6), inset 0 -4px 6px rgba(0,0,0,.35), inset 0 4px 6px rgba(255,255,255,.4)${costReduced ? ", 0 0 12px rgba(63,207,110,.8)" : costRaised ? ", 0 0 12px rgba(230,96,74,.8)" : ""}`,
        }}>
          <span style={{ font: `800 27px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff", textShadow: "0 2px 3px rgba(0,0,40,.7)" }}>
            {effectiveCost}
          </span>
        </div>

        {/* Tribe label (bottom-center, outside frame) */}
        <div style={{
          position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", zIndex: 7,
          padding: "3px 16px", borderRadius: 7,
          background: "linear-gradient(#3a2f17,#1c160b)",
          border: "1px solid #6b5320",
          boxShadow: "0 2px 5px rgba(0,0,0,.6)",
          font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`,
          letterSpacing: "1.4px", color: "#e7cf95", textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          {card.tribe ?? typeLabel}
        </div>

        {/* Attack bubble (bottom-left) */}
        {showLeft && leftVal !== undefined && (
          <div style={{
            position: "absolute", bottom: -7, left: -7, zIndex: 8,
            width: 48, height: 48,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 30%,#fff 0%,${leftColors[0]} 30%,${leftColors[1]} 100%)`,
            boxShadow: "0 0 0 3px #d6b052, 0 0 0 5px rgba(0,0,0,.65), 0 4px 8px rgba(0,0,0,.6), inset 0 -4px 6px rgba(0,0,0,.3)",
          }}>
            <span style={{ font: `800 24px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff", textShadow: "0 2px 3px rgba(0,0,0,.6)" }}>
              {leftVal}
            </span>
          </div>
        )}

        {/* Health/Durability bubble (bottom-right) */}
        {showRight && rightVal !== undefined && (
          <div style={{
            position: "absolute", bottom: -7, right: -7, zIndex: 8,
            width: 48, height: 48,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 30%,#fff 0%,${rightColors[0]} 30%,${rightColors[1]} 100%)`,
            boxShadow: "0 0 0 3px #d6b052, 0 0 0 5px rgba(0,0,0,.65), 0 4px 8px rgba(0,0,0,.6), inset 0 -4px 6px rgba(0,0,0,.3)",
          }}>
            <span style={{ font: `800 24px/1 var(--font-mono,'JetBrains Mono',monospace)`, color: "#fff", textShadow: "0 2px 3px rgba(0,0,0,.6)" }}>
              {rightVal}
            </span>
          </div>
        )}

      </div>

      <style>{`
        @keyframes dcSheen {
          0% { transform: translateX(-170%) skewX(-18deg); }
          100% { transform: translateX(430%) skewX(-18deg); }
        }
      `}</style>
    </div>
  );
}

const KEYWORD_COLORS: Record<string, string> = {
  hodl: "#f7931a",
  pump: "#7b8cf4",
  rekt: "#ff5fae",
  moon_shot: "#19e08a",
  taunt: "#e7c768",
  divine_shield: "#c8d8ff",
  charge: "#ff8f7e",
  stealth: "#9aa3b2",
};
