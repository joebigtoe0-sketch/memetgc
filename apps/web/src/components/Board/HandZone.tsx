"use client";

import React from "react";
import CardComponent from "../Card/CardComponent";
import type { Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

interface Props {
  hand: (Card & { instanceId?: string })[];
  selectedInstanceId?: string | null;
  currentMana: number;
  newCardIds?: string[];
  onCardClick?: (instanceId: string) => void;
  onCardHover?: (card: CardData | null) => void;
}

// Card display in hand is scaled to 0.50× of ~260px wide = 130px
const CARD_SCALE = 0.50;

export default function HandZone({ hand, selectedInstanceId, currentMana, newCardIds = [], onCardClick, onCardHover }: Props) {
  const n = hand.length;
  const mid = (n - 1) / 2;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}>
      {hand.map((card, i) => {
        const instId = (card as Card & { instanceId?: string }).instanceId ?? card.id;
        const off = i - mid;
        const ang = off * 6;
        const x = off * 130;
        const y = Math.abs(off) * Math.abs(off) * 8;
        const isNewCard = newCardIds.includes(instId);
        const costMod = (card as Card & { costModifier?: number }).costModifier ?? 0;
        const canPlay = (card.cost + costMod) <= currentMana;
        const isSelected = selectedInstanceId === instId;

        return (
          <div
            key={instId}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              transform: `translateX(calc(-50% + ${x}px)) translateY(${isSelected ? y - 30 : y}px) rotate(${ang}deg)`,
              transformOrigin: "bottom center",
              zIndex: isSelected ? 50 : 10 + i,
              pointerEvents: "auto",
              cursor: canPlay ? "pointer" : "default",
            }}
            onClick={() => { if (instId && canPlay) onCardClick?.(instId); }}
            onMouseEnter={() => onCardHover?.(card as CardData)}
            onMouseLeave={() => onCardHover?.(null)}
          >
            <div
              style={{
                transform: `scale(${CARD_SCALE})`,
                transformOrigin: "top center",
                filter: canPlay ? (isSelected ? "brightness(1.15)" : "none") : "brightness(0.45) saturate(0.3)",
                transition: "filter 0.15s ease",
                animation: isNewCard ? "drawCardIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards" : "none",
              }}
              onMouseEnter={(e) => {
                if (canPlay) (e.currentTarget as HTMLDivElement).style.transform = `scale(${CARD_SCALE}) translateY(-18px)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = `scale(${CARD_SCALE}) translateY(0)`;
              }}
            >
              <CardComponent
                card={card as CardData}
                size="lg"
                selected={isSelected}
                glowing={isSelected}
              />
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes drawCardIn {
          0%   { opacity: 0; transform: scale(0.4) translateY(30px); filter: brightness(1.8); }
          60%  { opacity: 1; transform: scale(${CARD_SCALE * 1.08}) translateY(-6px); filter: brightness(1.2); }
          100% { opacity: 1; transform: scale(${CARD_SCALE}) translateY(0); filter: none; }
        }
      `}</style>
    </div>
  );
}
