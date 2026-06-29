"use client";

import React from "react";
import CardComponent from "../Card/CardComponent";
import type { Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

interface Props {
  hand: (Card & { instanceId?: string })[];
  selectedInstanceId?: string | null;
  currentMana: number;
  onCardClick?: (instanceId: string) => void;
  onCardHover?: (card: CardData | null) => void;
}

export default function HandZone({ hand, selectedInstanceId, currentMana, onCardClick, onCardHover }: Props) {
  const count = hand.length;
  const fanSpread = Math.min(count * 8, 56);

  return (
    <div className="relative flex items-end justify-center" style={{ height: 140, minWidth: 420 }}>
      {hand.map((card, i) => {
        const instId = (card as Card & { instanceId?: string }).instanceId ?? card.id;
        const rot = count <= 1 ? 0 : (-fanSpread / 2 + (i / (count - 1)) * fanSpread);
        const costMod = (card as Card & { costModifier?: number }).costModifier ?? 0;
        const canPlay = (card.cost + costMod) <= currentMana;
        const isSelected = selectedInstanceId === instId;

        return (
          <div
            key={instId}
            className="absolute cursor-pointer"
            style={{
              bottom: 0,
              left: `calc(50% + ${(i - (count - 1) / 2) * (count > 6 ? 40 : 52)}px)`,
              transform: `rotate(${rot}deg) translateY(${isSelected ? -24 : 0}px)`,
              transformOrigin: "bottom center",
              zIndex: isSelected ? 50 : i + 1,
              filter: canPlay ? "none" : "brightness(0.45) saturate(0.4)",
              transition: "transform 0.15s ease, filter 0.15s ease",
            }}
            onClick={() => {
              if (instId && canPlay) onCardClick?.(instId);
            }}
            onMouseEnter={() => onCardHover?.(card as CardData)}
            onMouseLeave={() => onCardHover?.(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              onCardHover?.(card as CardData);
            }}
          >
            {/* Hover lift effect via CSS */}
            <div
              className="group"
              style={{ display: "contents" }}
            >
              <div
                style={{
                  transition: "transform 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-12px) scale(1.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                }}
              >
                <CardComponent
                  card={card}
                  size="sm"
                  interactive={canPlay}
                  selected={isSelected}
                  glowing={isSelected || (canPlay && !isSelected)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
