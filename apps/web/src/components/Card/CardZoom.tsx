"use client";

import React, { useEffect } from "react";
import CardComponent, { type CardData } from "./CardComponent";

interface Props {
  card: CardData | null;
  onClose: () => void;
}

export default function CardZoom({ card, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "cardZoom 0.2s ease-out" }}
      >
        <CardComponent card={card} size="lg" glowing interactive />
        <button
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gray-800 border border-gray-600 text-gray-300 text-sm flex items-center justify-center hover:bg-gray-700"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <style>{`
        @keyframes cardZoom {
          from { transform: scale(0.7); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
