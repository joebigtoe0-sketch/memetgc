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
  | "objective"
  | "mana"
  | "play"
  | "endturn"
  | "enemyturn"
  | "attack_minion"
  | "attack_hero"
  | "heropower"
  | "finish"
  | "victory";

interface StepContext {
  gs: SanitizedGameState;
  myTurn: boolean;
  selectedAttackerId: string | null;
}

interface Step {
  id: StepId;
  text: (ctx: StepContext) => string;
  /** Auto-advance when this returns true. Omit for button-advanced steps. */
  advanceWhen?: (ctx: StepContext) => boolean;
  /** Show a "Got it" button instead of waiting on game state. */
  button?: string;
  /** Pulse-highlight the enemy hero portrait while this step is active. */
  highlightEnemyHero?: boolean;
}

function opponentHeroDamaged(gs: SanitizedGameState): boolean {
  return gs.opponentState.hp < gs.opponentState.maxHp;
}

function attackedMinionNotHero(gs: SanitizedGameState): boolean {
  return gs.myState.board.some((s) => s?.hasAttacked) && !opponentHeroDamaged(gs);
}

const STEPS: Step[] = [
  {
    id: "mulligan",
    text: () =>
      "Welcome to the Memepool! I'm your guide for this one. These are your starting cards — you could swap any you don't like, but these are solid. Hit CONFIRM to keep them!",
    advanceWhen: ({ gs }) => gs.status !== "mulligan",
  },
  {
    id: "objective",
    text: () =>
      "First, the win condition: destroy the enemy HERO. Their portrait is at the top of the board with a red HP number — bring it to 0 and you win. Minions are just obstacles; the hero is the target.",
    button: "Got it",
  },
  {
    id: "mana",
    text: ({ gs }) =>
      `It's your turn! See the blue crystals at the bottom? That's your GAS — you have ${gs.myState.maxMana} right now and get 1 more every turn. Every card costs gas to play (the number in its top-left corner).`,
    button: "Got it",
  },
  {
    id: "play",
    text: () =>
      "Let's summon your first minion! Tap a card in your hand that you can afford, then tap the board to play it (you can also drag it up). Glowing cards are playable.",
    advanceWhen: ({ gs }) => gs.myState.board.some((s) => s !== null),
  },
  {
    id: "endturn",
    text: () =>
      "Summoned! Fresh minions are sleepy (summoning sickness) and can't attack until next turn. Press the END TURN button on the right to pass the turn.",
    advanceWhen: ({ gs, myTurn }) => !myTurn && gs.status === "in_progress",
  },
  {
    id: "enemyturn",
    text: () =>
      "The Training Bot played some minions. You can trade into them later, but remember — only damage to the enemy HERO wins the game. The bot won't attack you, so no rush.",
    advanceWhen: ({ gs, myTurn }) => myTurn && gs.status === "in_progress",
  },
  {
    id: "attack_minion",
    text: () =>
      "Your minion is awake! Tap one of YOUR minions on the board (bottom area) to select it as the attacker. On mobile you can also drag it upward toward the enemy.",
    advanceWhen: ({ gs, selectedAttackerId }) =>
      !!selectedAttackerId || opponentHeroDamaged(gs),
  },
  {
    id: "attack_hero",
    text: ({ gs }) => {
      if (attackedMinionNotHero(gs)) {
        return "That hit an enemy minion — nice, but minions don't win games! Now attack the ENEMY HERO: tap their glowing portrait at the top (red HP number), or drag your minion straight onto them.";
      }
      return "Now strike the ENEMY HERO! Tap their portrait at the top — look for the pulsing highlight and the red HP number. That's how you win.";
    },
    highlightEnemyHero: true,
    advanceWhen: ({ gs }) => opponentHeroDamaged(gs),
  },
  {
    id: "heropower",
    text: () =>
      "Direct hero damage — that's the stuff! One more trick: your HERO POWER (next to your hero portrait) costs 2 gas and can be used once per turn. Satoshi's grants armor to protect your hero.",
    button: "Got it",
  },
  {
    id: "finish",
    text: () =>
      "Keep going! Play minions, then attack the enemy HERO every turn you can. Race their HP to zero — ignore their minions if you want. Finish them!",
    highlightEnemyHero: true,
    advanceWhen: ({ gs }) => gs.status === "finished",
  },
  {
    id: "victory",
    text: () =>
      "GG, you did it! Tutorial complete — Casual and Ranked are now UNLOCKED. Open some packs, build your deck, and go show real players who's boss!",
    button: "Let's go!",
  },
];

export default function TutorialGuide() {
  const { gameState, playerId, isMyTurn, selectedAttackerId, setTutorialHighlight } = useGameStore();
  const isMobile = useIsMobile();
  const [active] = useState(() => isTutorialGame());
  const [stepIdx, setStepIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const step = STEPS[stepIdx];

  // Pulse the enemy hero during attack / finish steps.
  useEffect(() => {
    if (!active || dismissed) {
      setTutorialHighlight(null);
      return;
    }
    setTutorialHighlight(step?.highlightEnemyHero ? "enemy_hero" : null);
    return () => setTutorialHighlight(null);
  }, [active, dismissed, step?.highlightEnemyHero, setTutorialHighlight]);

  // Auto-advance steps as the game state moves forward.
  useEffect(() => {
    if (!active || !gameState || !step?.advanceWhen) return;
    if (step.advanceWhen({ gs: gameState, myTurn: isMyTurn, selectedAttackerId })) {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [active, gameState, isMyTurn, selectedAttackerId, step]);

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
    return step.text({ gs: gameState, myTurn: isMyTurn, selectedAttackerId });
  }, [gameState, step, isMyTurn, selectedAttackerId, iWon]);

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
