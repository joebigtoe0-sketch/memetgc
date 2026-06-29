"use client";

import React, { useState } from "react";
import CardComponent from "../Card/CardComponent";
import CardZoom from "../Card/CardZoom";
import type { Card } from "@memetgc/types";

interface Props {
  hand: (Card & { instanceId?: string })[];
  selectedInstanceId?: string | null;
  currentMana: number;
  onCardClick?: (instanceId: string) => void;
}

export default function HandZone({ hand, selectedInstanceId, currentMana, onCardClick }: Props) {
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);

  const count = hand.length;
  const fanSpread = Math.min(count * 8, 60);

  return (
    <div className="relative flex items-end justify-center" style={{ height: 130, minWidth: 400 }}>
      {hand.map((card, i) => {
        const instId = (card as Card & { instanceId?: string }).instanceId ?? card.id;
        const rot = count <= 1 ? 0 : (-fanSpread / 2 + (i / (count - 1)) * fanSpread);
        const costMod = (card as Card & { costModifier?: number }).costModifier ?? 0;
        const canPlay = (card.cost + costMod) <= currentMana;
        const isSelected = selectedInstanceId === instId;

        return (
          <div
            key={instId}
            className="absolute cursor-pointer transition-transform duration-150"
            style={{
              bottom: 0,
              left: `calc(50% + ${(i - (count - 1) / 2) * (count > 5 ? 45 : 60)}px)`,
              transform: `rotate(${rot}deg) translateY(${isSelected ? -20 : 0}px)`,
              transformOrigin: "bottom center",
              zIndex: isSelected ? 50 : i,
              filter: canPlay ? "none" : "brightness(0.5) saturate(0.5)",
            }}
            onClick={() => {
              if (instId && canPlay) onCardClick?.(instId);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setZoomedCard(card);
            }}
          >
            <CardComponent
              card={card}
              size="sm"
              interactive={canPlay}
              selected={isSelected}
              glowing={isSelected}
            />
          </div>
        );
      })}

      <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} />
    </div>
  );
}
