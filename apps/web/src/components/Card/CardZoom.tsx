"use client";

import React, { useEffect } from "react";
import CardComponent, { type CardData } from "./CardComponent";

export interface CardZoomAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "ghost";
}

interface Props {
  card: CardData | null;
  onClose: () => void;
  actions?: CardZoomAction[];
}

export default function CardZoom({ card, onClose, actions }: Props) {
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
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

      {actions && actions.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginTop: 22 }} onClick={(e) => e.stopPropagation()}>
          {actions.map((a, i) => (
            <button key={i} onClick={a.onClick} disabled={a.disabled} style={btnStyle(a.variant ?? "primary", a.disabled)}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes cardZoom {
          from { transform: scale(0.7); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function btnStyle(variant: "primary" | "danger" | "ghost", disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "12px 26px",
    borderRadius: 11,
    font: `800 14px var(--font-cinzel,'Cinzel',serif)`,
    border: "none",
    opacity: disabled ? 0.45 : 1,
  };
  if (variant === "danger") {
    return { ...base, background: "rgba(255,90,90,.12)", border: "1px solid rgba(255,90,90,.4)", color: "#ff8a8a" };
  }
  if (variant === "ghost") {
    return { ...base, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", color: "#cdd4df" };
  }
  return { ...base, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.35)" };
}
