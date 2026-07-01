"use client";

import React, { useState, useEffect } from "react";
import CardComponent from "../Card/CardComponent";
import { sendAction } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";
import BoardBackground from "./BoardBackground";
import type { Card } from "@memetgc/types";

const MULLIGAN_SECONDS = 30;

interface Props {
  hand: (Card & { instanceId: string })[];
  isFirstPlayer: boolean;
  boardBg?: string | null;
}

export default function MulliganScreen({ hand, isFirstPlayer, boardBg = null }: Props) {
  const { playerId } = useGameStore();
  const [replacing, setReplacing] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MULLIGAN_SECONDS);

  useEffect(() => {
    if (confirmed) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          confirmMulligan(new Set());
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmed]);

  function confirmMulligan(replaceSet: Set<string>) {
    if (confirmed) return;
    setConfirmed(true);
    const keepInstanceIds = hand
      .filter((c) => !replaceSet.has(c.instanceId))
      .map((c) => c.instanceId);
    sendAction({ type: "mulligan", keepInstanceIds, playerId: playerId ?? undefined });
  }

  function toggleCard(id: string) {
    if (confirmed) return;
    setReplacing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isUrgent = secondsLeft <= 5 && !confirmed;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
      <BoardBackground url={boardBg} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(4,6,12,0.55)", pointerEvents: "none" }} />

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center">
          <h1
            className="text-3xl font-black tracking-widest mb-2"
            style={{ color: "#f7931a", textShadow: "0 0 30px rgba(247,147,26,0.5)" }}
          >
            MULLIGAN
          </h1>
          <p className="text-sm" style={{ color: "#6080a0" }}>
            Click cards you want to replace. Highlighted cards will be swapped for new ones.
          </p>
          {isFirstPlayer && (
            <p className="text-xs mt-1" style={{ color: "#f7931a88" }}>
              You go second — you&apos;ll receive The Coin
            </p>
          )}
        </div>

        {/* Countdown ring */}
        {!confirmed && (
          <div className="flex items-center gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="24" cy="24" r="20" fill="none" stroke="#1a2040" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke={isUrgent ? "#ff4444" : "#4080ff"}
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - secondsLeft / MULLIGAN_SECONDS)}`}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
              />
            </svg>
            <span
              className="text-2xl font-black tabular-nums"
              style={{
                color: isUrgent ? "#ff4444" : "#4080ff",
                animation: isUrgent ? "urgentPulse 0.5s ease-in-out infinite" : "none",
                textShadow: isUrgent ? "0 0 12px rgba(255,68,68,0.6)" : "none",
              }}
            >
              {secondsLeft}s
            </span>
            {isUrgent && (
              <span className="text-sm font-bold" style={{ color: "#ff6666", animation: "urgentPulse 0.5s ease-in-out infinite" }}>
                Choose fast!
              </span>
            )}
          </div>
        )}

        {/* Cards */}
        <div className="flex gap-4 items-center justify-center flex-wrap">
          {hand.map((card) => {
            const isReplacing = replacing.has(card.instanceId);
            return (
              <div
                key={card.instanceId}
                onClick={() => toggleCard(card.instanceId)}
                className="relative"
                style={{
                  cursor: confirmed ? "default" : "pointer",
                  transform: isReplacing ? "translateY(16px) scale(0.92)" : "translateY(0) scale(1)",
                  filter: isReplacing ? "brightness(0.4) saturate(0.3)" : "brightness(1)",
                  transition: "transform 0.2s ease, filter 0.2s ease",
                  pointerEvents: confirmed ? "none" : "auto",
                }}
              >
                <CardComponent card={card} size="lg" />
                {isReplacing && (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <span className="font-black text-2xl" style={{ color: "#ff4444", textShadow: "0 0 10px rgba(255,68,68,0.8)" }}>
                      ✕
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
          {!confirmed && (
            <>
              <button onClick={() => setReplacing(new Set(hand.map((c) => c.instanceId)))} style={ghostBtn("#ff8f8f", "rgba(255,90,90,.3)")}>
                Replace All
              </button>
              <button onClick={() => setReplacing(new Set())} style={ghostBtn("#cdd4df", "rgba(255,255,255,.16)")}>
                Keep All
              </button>
            </>
          )}
          <button
            onClick={() => confirmMulligan(replacing)}
            disabled={confirmed}
            style={{
              cursor: confirmed ? "not-allowed" : "pointer",
              border: "none",
              padding: "13px 30px",
              borderRadius: 12,
              font: `800 15px var(--font-cinzel,'Cinzel',serif)`,
              letterSpacing: ".3px",
              color: confirmed ? "#7a828f" : "#04160b",
              background: confirmed ? "rgba(255,255,255,.06)" : "linear-gradient(180deg,#4ff08f,#17a94f)",
              boxShadow: confirmed ? "none" : "0 10px 24px rgba(23,169,79,.4), inset 0 1px 0 rgba(255,255,255,.45)",
              transition: "transform .12s ease",
            }}
          >
            {confirmed ? "Waiting for opponent…" : `Confirm (${hand.length - replacing.size} kept)`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes urgentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function ghostBtn(color: string, borderColor: string): React.CSSProperties {
  return {
    cursor: "pointer",
    padding: "12px 22px",
    borderRadius: 12,
    background: "rgba(255,255,255,.04)",
    border: `1px solid ${borderColor}`,
    color,
    font: `700 13px var(--font-archivo,'Archivo',sans-serif)`,
    transition: "transform .12s ease, background .12s ease",
  };
}
