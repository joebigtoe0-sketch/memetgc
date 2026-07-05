"use client";

import React, { useState } from "react";
import CardComponent from "../Card/CardComponent";
import { playSound } from "@/lib/sounds";
import type { Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

interface Props {
  hand: (Card & { instanceId?: string })[];
  selectedInstanceId?: string | null;
  currentMana: number;
  actionsEnabled?: boolean;
  newCardIds?: string[];
  isMobile?: boolean;
  /** When set, overrides mana-only playability (targets, board space, etc.). */
  canPlayInstance?: (instanceId: string) => boolean;
  onCardClick?: (instanceId: string) => void;
  onCardHover?: (card: CardData | null) => void;
  onCardInspect?: (card: CardData) => void;
}

// Card display in hand is scaled to 0.50× of ~260px wide = 130px
const CARD_SCALE = 0.50;
// Drag distance (screen px) a card must travel upward to count as "play"
const PLAY_DRAG_THRESHOLD = 64;
// Finger jitter below this still counts as a tap-to-inspect on mobile
const TAP_MOVE_THRESHOLD = 18;

export default function HandZone({ hand, selectedInstanceId, currentMana, actionsEnabled = true, newCardIds = [], isMobile = false, canPlayInstance, onCardClick, onCardHover, onCardInspect }: Props) {
  const n = hand.length;
  const mid = (n - 1) / 2;

  // Fan spacing tightens as the hand grows so cards never spill onto the side
  // columns / board. Kept generous for small hands.
  const spacing = n <= 1 ? 0 : Math.min(130, 760 / (n - 1));

  // Mobile drag-to-play state (only one card is ever dragged at a time)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const dragStart = React.useRef<{ x: number; y: number; moved: boolean } | null>(null);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}>
      {hand.map((card, i) => {
        const instId = (card as Card & { instanceId?: string }).instanceId ?? card.id;
        const off = i - mid;
        const ang = off * 5;
        const x = off * spacing;
        const y = Math.min(26, off * off * 3);
        const isNewCard = newCardIds.includes(instId);
        const costMod = (card as Card & { costModifier?: number }).costModifier ?? 0;
        const hasMana = (card.cost + costMod) <= currentMana;
        const canPlay = hasMana && (canPlayInstance ? canPlayInstance(instId) : true);
        const isSelected = selectedInstanceId === instId;
        const isDragging = dragId === instId;
        const dragLift = isDragging ? Math.min(0, dragDy) : 0;
        const willPlay = isDragging && dragDy <= -PLAY_DRAG_THRESHOLD && canPlay;
        // Scale lives on the OUTER wrapper so the clickable/hover hitbox shrinks
        // to the visible card size (CSS transforms scale hit-testing, but do not
        // change an inner element's layout box — which is what made the hitbox huge).
        const baseScale = willPlay ? CARD_SCALE * 1.08 : CARD_SCALE;

        return (
          <div
            key={instId}
            data-sound-hand-card
            style={{
              position: "absolute",
              left: "50%",
              bottom: 26,
              transform: `translateX(calc(-50% + ${x}px)) translateY(${(isSelected ? y - 30 : y) + dragLift}px) rotate(${isDragging ? 0 : ang}deg) scale(${baseScale})`,
              transformOrigin: "bottom center",
              zIndex: isDragging ? 60 : isSelected ? 50 : 10 + i,
              pointerEvents: "auto",
              cursor: canPlay ? "pointer" : "default",
              touchAction: isMobile ? "none" : "auto",
              transition: isDragging ? "none" : "transform 0.18s ease",
            }}
            // ── Desktop: click to play, hover to preview ──
            onClick={() => {
              if (isMobile) return;
              if (!instId) return;
              if (!actionsEnabled) { playSound("denied"); return; }
              if (!canPlay) { playSound(hasMana ? "denied" : "noMana"); return; }
              onCardClick?.(instId);
            }}
            onMouseEnter={() => {
              if (isMobile) return;
              playSound("cardHover", 0.5);
              onCardHover?.(card as CardData);
            }}
            onMouseLeave={() => { if (!isMobile) onCardHover?.(null); }}
            // ── Mobile: tap to inspect, drag upward to play ──
            onPointerDown={(e) => {
              if (!isMobile) return;
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
              setDragId(instId);
              setDragDy(0);
            }}
            onPointerMove={(e) => {
              if (!isMobile || dragId !== instId || !dragStart.current) return;
              const dy = e.clientY - dragStart.current.y;
              const dx = e.clientX - dragStart.current.x;
              if (Math.abs(dy) > TAP_MOVE_THRESHOLD || Math.abs(dx) > TAP_MOVE_THRESHOLD) dragStart.current.moved = true;
              setDragDy(dy);
            }}
            onPointerUp={() => {
              if (!isMobile || dragId !== instId) return;
              const moved = dragStart.current?.moved;
              const playedByDrag = dragDy <= -PLAY_DRAG_THRESHOLD;
              setDragId(null);
              setDragDy(0);
              dragStart.current = null;
              if (playedByDrag) {
                if (!actionsEnabled) { playSound("denied"); return; }
                if (!canPlay) { playSound(hasMana ? "denied" : "noMana"); return; }
                onCardClick?.(instId);
              } else if (!moved || dragDy > -PLAY_DRAG_THRESHOLD) {
                // Tap or small wobble → inspect; only upward drags play the card
                onCardInspect?.(card as CardData);
              }
            }}
            onPointerCancel={() => {
              if (!isMobile || dragId !== instId) return;
              setDragId(null);
              setDragDy(0);
              dragStart.current = null;
            }}
          >
            <div
              style={{
                transformOrigin: "bottom center",
                filter: canPlay
                  ? (isSelected || willPlay ? "brightness(1.2)" : "none")
                  : "brightness(0.45) saturate(0.3)",
                transition: "filter 0.15s ease, transform 0.12s ease",
                animation: isNewCard ? "drawCardIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards" : "none",
              }}
              onMouseEnter={(e) => {
                if (isMobile) return;
                if (canPlay) (e.currentTarget as HTMLDivElement).style.transform = `translateY(-18px)`;
              }}
              onMouseLeave={(e) => {
                if (isMobile) return;
                (e.currentTarget as HTMLDivElement).style.transform = `translateY(0)`;
              }}
            >
              <CardComponent
                card={card as CardData}
                size="lg"
                selected={isSelected}
                glowing={isSelected || willPlay}
              />
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes drawCardIn {
          0%   { opacity: 0; transform: scale(0.8) translateY(30px); filter: brightness(1.8); }
          60%  { opacity: 1; transform: scale(1.08) translateY(-6px); filter: brightness(1.2); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: none; }
        }
      `}</style>
    </div>
  );
}
