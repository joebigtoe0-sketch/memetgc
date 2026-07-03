"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useIsMobile } from "@/hooks/useViewport";
import { isTutorialGame, clearTutorialGame } from "@/lib/tutorial";
import { BRAND } from "@/lib/brand";
import type { SanitizedGameState } from "@memetgc/types";

/**
 * Floating mascot + speech bubble that walks a first-time player through the
 * guided tutorial game. Steps advance automatically by watching the game
 * state; informational steps advance with a "Got it" button.
 */

type StepId =
  | "mulligan"
  | "mana"
  | "play"
  | "endturn"
  | "enemyturn"
  | "attack"
  | "heropower"
  | "finish"
  | "victory";

interface Step {
  id: StepId;
  text: (gs: SanitizedGameState) => string;
  /** Auto-advance when this returns true. Omit for button-advanced steps. */
  advanceWhen?: (gs: SanitizedGameState, myTurn: boolean) => boolean;
  /** Show a "Got it" button instead of waiting on game state. */
  button?: string;
}

const STEPS: Step[] = [
  {
    id: "mulligan",
    text: () =>
      "Welcome to the Memepool! I'm your guide for this one. These are your starting cards — you could swap any you don't like, but these are solid. Hit CONFIRM to keep them!",
    advanceWhen: (gs) => gs.status !== "mulligan",
  },
  {
    id: "mana",
    text: (gs) =>
      `It's your turn! See the blue crystals at the bottom? That's your GAS — you have ${gs.myState.maxMana} right now and get 1 more every turn. Every card costs gas to play (the number in its top-left corner).`,
    button: "Got it",
  },
  {
    id: "play",
    text: () =>
      "Let's summon your first minion! Tap a card in your hand that you can afford, then tap the board to play it (you can also drag it up). Glowing cards are playable.",
    advanceWhen: (gs) => gs.myState.board.some((s) => s !== null),
  },
  {
    id: "endturn",
    text: () =>
      "Summoned! Fresh minions are sleepy (summoning sickness) and can't attack until next turn. Press the END TURN button on the right to pass the turn.",
    advanceWhen: (gs, myTurn) => !myTurn && gs.status === "in_progress",
  },
  {
    id: "enemyturn",
    text: () =>
      "The Training Bot is taking its turn. Don't worry — this one couldn't hit water if it fell out of a boat. You literally can't lose this game.",
    advanceWhen: (gs, myTurn) => myTurn && gs.status === "in_progress",
  },
  {
    id: "attack",
    text: () =>
      "Your minion is awake and ready! Tap your minion, then tap the enemy hero (or an enemy minion) to attack. On mobile you can also drag your minion onto the target.",
    advanceWhen: (gs) =>
      gs.myState.board.some((s) => s !== null && s.hasAttacked) ||
      gs.opponentState.hp + gs.opponentState.armor < gs.opponentState.maxHp + 5,
  },
  {
    id: "heropower",
    text: () =>
      "One more trick: your HERO POWER (next to your hero portrait) costs 2 gas and can be used once per turn. Satoshi's grants armor to protect your hero. Use it whenever you have spare gas!",
    button: "Got it",
  },
  {
    id: "finish",
    text: () =>
      "That's everything you need! Keep playing minions, keep attacking — bring the enemy hero to 0 HP and the win is yours. Finish them!",
    advanceWhen: (gs) => gs.status === "finished",
  },
  {
    id: "victory",
    text: () =>
      "GG, you did it! Tutorial complete — Casual and Ranked are now UNLOCKED. Open some packs, build your deck, and go show real players who's boss!",
    button: "Let's go!",
  },
];

export default function TutorialGuide() {
  const { gameState, playerId, isMyTurn } = useGameStore();
  const isMobile = useIsMobile();
  const [active] = useState(() => isTutorialGame());
  const [stepIdx, setStepIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const step = STEPS[stepIdx];

  // Auto-advance steps as the game state moves forward.
  useEffect(() => {
    if (!active || !gameState || !step?.advanceWhen) return;
    if (step.advanceWhen(gameState, isMyTurn)) {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [active, gameState, isMyTurn, step]);

  // Game ended: jump straight to the victory (or retry) message.
  useEffect(() => {
    if (!active || gameState?.status !== "finished") return;
    setStepIdx(STEPS.length - 1);
    if (gameState.winner === playerId) clearTutorialGame();
  }, [active, gameState?.status, gameState?.winner, playerId]);

  const iWon = gameState?.status === "finished" && gameState.winner === playerId;
  const text = useMemo(() => {
    if (!gameState || !step) return "";
    if (gameState.status === "finished" && !iWon) {
      return "Ouch — that wasn't supposed to happen! No worries, just start the tutorial again from the home screen.";
    }
    return step.text(gameState);
  }, [gameState, step, iWon]);

  if (!active || dismissed || !gameState || !step) return null;

  const showButton = !!step.button || gameState.status === "finished";
  const buttonLabel = gameState.status === "finished" ? (iWon ? "Let's go!" : "Okay") : step.button;

  function onButton() {
    if (gameState?.status === "finished") {
      setDismissed(true);
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }

  const mascotSize = isMobile ? 64 : 96;

  return (
    <div
      style={{
        position: "fixed",
        left: isMobile ? 8 : 18,
        bottom: isMobile ? 8 : 18,
        zIndex: 400,
        display: "flex",
        alignItems: "flex-end",
        gap: isMobile ? 8 : 12,
        maxWidth: isMobile ? "calc(100vw - 16px)" : 480,
        pointerEvents: "none",
        fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
      }}
    >
      <img
        src={BRAND.logoUrl}
        alt=""
        draggable={false}
        style={{
          width: mascotSize,
          height: mascotSize,
          objectFit: "contain",
          flexShrink: 0,
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,.55))",
          animation: "tutorialMascotBob 2.4s ease-in-out infinite",
        }}
      />
      <div
        key={step.id}
        style={{
          position: "relative",
          pointerEvents: "auto",
          padding: isMobile ? "10px 12px" : "14px 18px",
          borderRadius: 14,
          borderBottomLeftRadius: 4,
          background: "linear-gradient(160deg,rgba(24,31,48,.97),rgba(13,18,30,.97))",
          border: "1px solid rgba(247,147,26,.45)",
          boxShadow: "0 10px 30px rgba(0,0,0,.5), 0 0 24px rgba(247,147,26,.12)",
          marginBottom: isMobile ? 6 : 14,
          animation: "tutorialBubbleIn .25s ease-out",
        }}
      >
        {/* bubble tail pointing at the mascot */}
        <div
          style={{
            position: "absolute",
            left: -8,
            bottom: 12,
            width: 0,
            height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderRight: "9px solid rgba(247,147,26,.45)",
          }}
        />
        <div style={{ font: `800 ${isMobile ? 9 : 10}px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#f7931a", marginBottom: 6 }}>
          TUTORIAL GUIDE
        </div>
        <div style={{ font: `600 ${isMobile ? 12 : 13.5}px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3", lineHeight: 1.55 }}>
          {text}
        </div>
        {showButton && (
          <button
            onClick={onButton}
            style={{
              cursor: "pointer",
              marginTop: 10,
              padding: "7px 18px",
              borderRadius: 9,
              border: "none",
              color: "#2a1a00",
              background: "linear-gradient(180deg,#ffe07a,#e0890f)",
              font: `800 ${isMobile ? 11 : 12}px var(--font-cinzel,'Cinzel',serif)`,
              boxShadow: "0 4px 14px rgba(224,137,15,.4)",
            }}
          >
            {buttonLabel} ›
          </button>
        )}
      </div>
      <style>{`
        @keyframes tutorialMascotBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes tutorialBubbleIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
