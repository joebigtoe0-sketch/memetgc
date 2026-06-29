"use client";

import React, { useState } from "react";
import CardComponent from "../Card/CardComponent";
import { sendAction } from "@/hooks/useSocket";
import type { Card } from "@memetgc/types";

interface Props {
  hand: (Card & { instanceId: string })[];
  isFirstPlayer: boolean;
}

export default function MulliganScreen({ hand, isFirstPlayer }: Props) {
  const [replacing, setReplacing] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  function toggleCard(id: string) {
    setReplacing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (confirmed) return;
    setConfirmed(true);
    const keepInstanceIds = hand
      .filter((c) => !replacing.has(c.instanceId))
      .map((c) => c.instanceId);
    sendAction({ type: "mulligan", keepInstanceIds });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg, #04060f 0%, #08091a 100%)" }}
    >
      {/* Animated background lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 60px, #2040a0 60px, #2040a0 61px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 max-w-4xl w-full">
        {/* Title */}
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

        {/* Cards */}
        <div className="flex gap-4 items-center justify-center flex-wrap">
          {hand.map((card) => {
            const isReplacing = replacing.has(card.instanceId);
            return (
              <div
                key={card.instanceId}
                onClick={() => toggleCard(card.instanceId)}
                className="cursor-pointer transition-all duration-200 relative"
                style={{
                  transform: isReplacing ? "translateY(16px) scale(0.92)" : "translateY(0) scale(1)",
                  filter: isReplacing ? "brightness(0.45) saturate(0.3)" : "brightness(1)",
                }}
              >
                <CardComponent card={card} size="lg" />
                {isReplacing && (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <span
                      className="font-black text-2xl"
                      style={{ color: "#ff4444", textShadow: "0 0 10px rgba(255,68,68,0.8)" }}
                    >
                      ✕
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setReplacing(new Set(hand.map((c) => c.instanceId)))}
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: "rgba(100,40,40,0.3)",
              border: "1px solid #804040",
              color: "#ff8888",
            }}
          >
            Replace All
          </button>
          <button
            onClick={() => setReplacing(new Set())}
            className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: "rgba(20,40,80,0.3)",
              border: "1px solid #2a4080",
              color: "#6080c0",
            }}
          >
            Keep All
          </button>
          <button
            onClick={confirm}
            disabled={confirmed}
            className="px-8 py-3 rounded-xl font-black text-base transition-all"
            style={{
              background: confirmed
                ? "rgba(30,30,40,0.6)"
                : "linear-gradient(135deg, #2a6040, #1a4020)",
              border: `2px solid ${confirmed ? "#333" : "#40e080"}`,
              color: confirmed ? "#555" : "#40e080",
              boxShadow: confirmed ? "none" : "0 0 20px rgba(64,224,128,0.3)",
              cursor: confirmed ? "not-allowed" : "pointer",
            }}
          >
            {confirmed ? "Waiting for opponent..." : `Confirm (${hand.length - replacing.size} kept)`}
          </button>
        </div>
      </div>
    </div>
  );
}
