"use client";

import React, { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { sendAction } from "@/hooks/useSocket";
import MinionCard from "../Board/MinionCard";
import HeroZone from "../Board/HeroZone";
import HandZone from "../Board/HandZone";
import MulliganScreen from "./MulliganScreen";
import CardComponent from "../Card/CardComponent";
import type { MinionSlot, Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

const TURN_SECONDS = 30;

type PhaseAction = "idle" | "select_play_target" | "select_attack_target" | "select_hero_power_target";

export default function GameBoard() {
  const { gameState, isMyTurn, selectedCardInstanceId, selectedAttackerId, lastActionError, playerId } = useGameStore();
  const { selectCard, selectAttacker, setActionError } = useGameStore();
  const [phase, setPhase] = useState<PhaseAction>("idle");
  const [hoveredCard, setHoveredCard] = useState<CardData | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(TURN_SECONDS);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsMyTurn = useRef(false);

  useEffect(() => {
    const inProgress = gameState?.status === "in_progress";
    if (inProgress && isMyTurn && !prevIsMyTurn.current) {
      setTurnSecondsLeft(TURN_SECONDS);
    }
    prevIsMyTurn.current = !!(inProgress && isMyTurn);

    if (inProgress && isMyTurn) {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      turnTimerRef.current = setInterval(() => {
        setTurnSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
    } else {
      if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
      setTurnSecondsLeft(TURN_SECONDS);
    }
    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current); };
  }, [isMyTurn, gameState?.status]);

  if (!gameState) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6a7488" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, animation: "pulseGlow 1.6s ease-in-out infinite" }}>⚔️</div>
          <p style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Connecting to game…</p>
        </div>
      </div>
    );
  }

  if (gameState.status === "mulligan") {
    return (
      <MulliganScreen
        hand={gameState.myState.hand as (Card & { instanceId: string })[]}
        isFirstPlayer={gameState.myState.playerId !== gameState.activePlayerId}
      />
    );
  }

  const { myState, opponentState } = gameState;
  const canAct = isMyTurn && gameState.phase === "main" && gameState.status === "in_progress";

  if (gameState.status === "finished") {
    const iWon = gameState.activePlayerId === playerId;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(6,8,13,.95)" }}>
        <div style={{ font: `900 64px/1 var(--font-cinzel,'Cinzel',serif)`, color: iWon ? "#f7c64a" : "#ff5555", textShadow: `0 0 40px ${iWon ? "rgba(247,198,74,.6)" : "rgba(255,85,85,.6)"}` }}>
          {iWon ? "VICTORY" : "DEFEAT"}
        </div>
        <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: "#8a93a6" }}>TURN {gameState.turnNumber}</div>
        <button
          onClick={() => { window.location.href = "/"; }}
          style={{ cursor: "pointer", border: "none", padding: "15px 40px", borderRadius: 12, font: `800 16px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px", color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.4),inset 0 1px 0 rgba(255,255,255,.5)" }}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  function getValidTargets(): string[] {
    if (!selectedAttackerId) return [];
    const opponentMinions = opponentState.board.filter((s): s is MinionSlot => s !== null);
    const tauntMinions = opponentMinions.filter((m) => m.hasTaunt);
    if (tauntMinions.length > 0) return tauntMinions.map((m) => m.instanceId);
    return [...opponentMinions.map((m) => m.instanceId), "hero_" + opponentState.playerId];
  }

  const validTargets = getValidTargets();

  function handleMinionClick(instanceId: string, isEnemy: boolean) {
    if (!canAct) return;
    if (phase === "select_attack_target") {
      if (validTargets.includes(instanceId)) {
        sendAction({ type: "attack", attackerInstanceId: selectedAttackerId!, defenderInstanceId: instanceId });
        selectAttacker(null); setPhase("idle");
      }
      return;
    }
    if (phase === "select_play_target") {
      sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId!, targetInstanceId: instanceId });
      selectCard(null); setPhase("idle"); return;
    }
    if (!isEnemy) {
      const slot = myState.board.find((s): s is MinionSlot => s !== null && s.instanceId === instanceId);
      if (slot && !slot.hasAttacked && (!slot.summoningSickness || slot.hasCharge)) {
        selectAttacker(instanceId);
        setPhase("select_attack_target");
      }
    }
  }

  function handleHeroClick(isEnemy: boolean) {
    if (!canAct) return;
    if (isEnemy) {
      if (phase === "select_attack_target" && selectedAttackerId) {
        const heroId = "hero_" + opponentState.playerId;
        if (validTargets.includes(heroId)) {
          sendAction({ type: "attack", attackerInstanceId: selectedAttackerId, defenderInstanceId: heroId });
          selectAttacker(null); setPhase("idle");
        }
      } else if (phase === "select_play_target" && selectedCardInstanceId) {
        sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, targetInstanceId: "hero_" + opponentState.playerId });
        selectCard(null); setPhase("idle");
      }
    }
  }

  function handleHeroPowerClick() {
    if (!canAct || myState.heroPowerUsed) return;
    sendAction({ type: "hero_power" });
  }

  function handleEndTurn() {
    if (!canAct) return;
    sendAction({ type: "end_turn" });
    selectCard(null); selectAttacker(null); setPhase("idle");
  }

  function handleCancel() {
    selectCard(null); selectAttacker(null); setPhase("idle");
    setActionError(null);
  }

  const manaTotal = Math.min(10, gameState.turnNumber);
  const manaAvailable = myState.mana + myState.tempMana;
  const timerUrgent = isMyTurn && turnSecondsLeft <= 5;

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%", overflow: "hidden",
      background: "radial-gradient(120% 80% at 50% 50%,#16202f 0%,#0a0e16 70%,#070a10 100%)",
      fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
    }}>
      {/* Candlestick BG lines */}
      <div style={{ position: "absolute", inset: 0, opacity: .5, backgroundImage: "repeating-linear-gradient(90deg,transparent 0 30px,rgba(255,255,255,.018) 30px 31px)", pointerEvents: "none" }} />
      {/* Center gold divider line */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, transform: "translateY(-1px)", background: "linear-gradient(90deg,transparent,rgba(231,199,104,.35),transparent)", pointerEvents: "none" }} />

      {/* Settings button (top-right) */}
      <button
        onClick={() => { window.location.href = "/"; }}
        style={{ position: "absolute", top: 14, right: 16, zIndex: 20, width: 38, height: 38, borderRadius: 10, background: "rgba(8,11,18,.7)", border: "1px solid rgba(255,255,255,.12)", color: "#c4ccd8", fontSize: 15, cursor: "pointer" }}
      >⚙</button>

      {/* Turn + timer badge (left, vertically centered) */}
      <div style={{
        position: "absolute", top: "50%", left: 30, transform: "translateY(-50%)", zIndex: 15,
        font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`,
        letterSpacing: "2px",
        color: isMyTurn ? "#7fe8bd" : "#c4ccd8",
        padding: "8px 14px", borderRadius: 9,
        background: isMyTurn ? "rgba(25,224,138,.08)" : "rgba(255,255,255,.04)",
        border: `1px solid ${isMyTurn ? "rgba(25,224,138,.3)" : "rgba(255,255,255,.1)"}`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <span>{isMyTurn ? "YOUR TURN" : "ENEMY TURN"}</span>
        {isMyTurn && (
          <span style={{
            fontSize: 13, fontWeight: 900,
            color: timerUrgent ? "#ff4444" : "#7fe8bd",
            animation: timerUrgent ? "urgentPulse 0.5s ease-in-out infinite" : "none",
          }}>
            {turnSecondsLeft}s
          </span>
        )}
      </div>

      {/* End Turn button (right, vertically centered) */}
      <div style={{ position: "absolute", top: "50%", right: 30, transform: "translateY(-50%)", zIndex: 15 }}>
        {phase !== "idle" ? (
          <button
            onClick={handleCancel}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "16px 22px", borderRadius: 14, border: "2px solid rgba(255,140,60,.6)", background: "rgba(255,90,30,.08)", color: "#ffaa66", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}
          >
            <span style={{ font: `900 15px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px" }}>CANCEL</span>
            <span style={{ font: `700 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#ffaa66", opacity: .8 }}>ESC</span>
          </button>
        ) : (
          <button
            onClick={handleEndTurn}
            disabled={!canAct}
            style={{
              cursor: canAct ? "pointer" : "not-allowed",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "16px 22px", borderRadius: 14,
              border: `2px solid ${canAct ? "#e0b13a" : "rgba(255,255,255,.1)"}`,
              background: canAct ? "linear-gradient(180deg,#3a4150,#1c2230)" : "rgba(20,22,30,.7)",
              boxShadow: canAct ? "0 0 22px rgba(231,199,104,.35), inset 0 1px 0 rgba(255,240,190,.3)" : "none",
              color: canAct ? "#f3e8cc" : "#4a5060",
              animation: canAct ? "pulse-end-turn 2s ease-in-out infinite" : "none",
            }}
          >
            <span style={{ font: `900 15px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px" }}>END</span>
            <span style={{ font: `700 10px var(--font-archivo,'Archivo',sans-serif)`, color: canAct ? "#c9b48a" : "#4a5060" }}>TURN</span>
          </button>
        )}
      </div>

      {/* Error banner */}
      {lastActionError && (
        <div
          onClick={() => setActionError(null)}
          style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 50, padding: "8px 16px", borderRadius: 10, background: "rgba(100,0,0,.9)", border: "1px solid #ff3333", color: "#ff8888", cursor: "pointer", font: `600 12px var(--font-archivo,'Archivo',sans-serif)` }}
        >
          {lastActionError} ✕
        </div>
      )}

      {/* Phase instruction */}
      {phase !== "idle" && (
        <div style={{
          position: "absolute", bottom: "calc(50% + 10px)", left: "50%", transform: "translateX(-50%)", zIndex: 40,
          padding: "8px 18px", borderRadius: 20,
          background: "rgba(60,50,0,.9)", border: "1px solid #e0c040", color: "#ffe060",
          font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px",
          boxShadow: "0 0 20px rgba(224,192,64,.3)", pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          {phase === "select_play_target" && "→ SELECT TARGET"}
          {phase === "select_attack_target" && "→ SELECT TARGET TO ATTACK"}
        </div>
      )}

      {/* ===== OPPONENT BAR ===== */}
      <div style={{ position: "absolute", top: 14, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 26, padding: "0 70px" }}>
        {/* Deck count (left) */}
        <div style={{ position: "absolute", left: 24, display: "flex", gap: 10 }}>
          <div style={{
            width: 50, height: 70, borderRadius: 8,
            background: "linear-gradient(150deg,#2a3142,#12161f)",
            border: "1.5px solid rgba(231,199,104,.3)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            boxShadow: "3px 3px 0 rgba(0,0,0,.4)",
          }}>
            <span style={{ font: `800 16px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c9b48a" }}>{opponentState.deckCount}</span>
            <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", letterSpacing: 1 }}>DECK</span>
          </div>
        </div>

        {/* Opponent hero */}
        <HeroZone
          heroName={opponentState.heroName}
          faction={opponentState.heroFaction}
          hp={opponentState.hp}
          armor={opponentState.armor}
          isEnemy
          isValidTarget={phase === "select_attack_target" && validTargets.includes("hero_" + opponentState.playerId)}
          onHeroClick={() => handleHeroClick(true)}
          secretCount={opponentState.secretCount}
          hasWeapon={opponentState.hasWeapon}
          weaponAttack={opponentState.weaponAttack}
          weaponDurability={opponentState.weaponDurability}
        />

        {/* Opponent mana + hand (right) */}
        <div style={{ position: "absolute", right: 24, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <span style={{ font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>{Math.min(10, gameState.turnNumber)} / {Math.min(10, gameState.turnNumber)}</span>
            <span style={{ font: `600 8px var(--font-archivo,'Archivo',sans-serif)`, color: "#7a8296" }}>GAS</span>
          </div>
          {/* Back-of-cards fan */}
          <div style={{ position: "relative", height: 60, width: Math.min(opponentState.handCount, 6) * 18 + 40 }}>
            {Array.from({ length: Math.min(opponentState.handCount, 7) }).map((_, i) => {
              const rot = (i - Math.floor(Math.min(opponentState.handCount, 7) / 2)) * 8;
              const fc = FAC_BY_FACTION[opponentState.heroFaction] ?? "#2a3142";
              return (
                <div key={i} style={{
                  position: "absolute", left: i * 18, top: i % 2 === 0 ? 2 : 6,
                  width: 40, height: 56, borderRadius: 7,
                  background: `linear-gradient(150deg,color-mix(in srgb,${fc} 40%,#1a1f29),#12161f)`,
                  border: `1.5px solid color-mix(in srgb,${fc} 40%,rgba(255,255,255,.1))`,
                  transform: `rotate(${rot}deg)`,
                }} />
              );
            })}
            {opponentState.handCount > 0 && (
              <div style={{
                position: "absolute", right: 0, bottom: 0,
                font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ffaad8",
              }}>
                {opponentState.handCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== OPPONENT MINION ROW ===== */}
      <div style={{ position: "absolute", top: 128, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10, padding: "0 80px" }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const slot = opponentState.board[i];
          const isValidTarget = phase === "select_attack_target" && slot ? validTargets.includes(slot.instanceId) : false;
          return (
            <div key={i} style={{
              width: 104, height: 132,
              borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
              border: slot ? "none" : "1.5px dashed rgba(255,255,255,.08)",
              background: slot ? "transparent" : "rgba(255,255,255,.01)",
            }}>
              {slot && (
                <MinionCard
                  slot={slot}
                  isEnemy
                  isValidTarget={isValidTarget}
                  onClick={() => handleMinionClick(slot.instanceId, true)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ===== PLAYER MINION ROW ===== */}
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10, padding: "0 80px" }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const slot = myState.board[i];
          const isAttacking = slot?.instanceId === selectedAttackerId;
          return (
            <div
              key={i}
              style={{
                width: 104, height: 132, borderRadius: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: slot ? "none" : phase === "select_play_target" ? "1.5px dashed rgba(64,224,128,.4)" : "1.5px dashed rgba(255,255,255,.08)",
                background: slot ? "transparent" : phase === "select_play_target" ? "rgba(64,224,128,.04)" : "rgba(255,255,255,.01)",
                cursor: !slot && phase === "select_play_target" ? "pointer" : "default",
              }}
              onClick={() => {
                if (!slot && phase === "select_play_target" && selectedCardInstanceId) {
                  sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, boardPosition: i });
                  selectCard(null); setPhase("idle");
                }
              }}
            >
              {slot && (
                <MinionCard
                  slot={slot}
                  isSelected={isAttacking}
                  isAttacking={isAttacking}
                  onClick={() => handleMinionClick(slot.instanceId, false)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ===== PLAYER HERO BAR ===== */}
      <div style={{ position: "absolute", top: 452, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "0 70px" }}>
        {/* Weapon + location (left) */}
        <div style={{ position: "absolute", left: 30, display: "flex", gap: 14, alignItems: "center" }}>
          {myState.hasWeapon && (
            <div style={{ position: "relative", width: 62, height: 80, borderRadius: 9, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", font: `700 8px var(--font-cinzel,'Cinzel',serif)`, color: "#dff7ec", textAlign: "center" }}>
              <span style={{ fontSize: 10 }}>⚔️ {myState.weaponAttack}/{myState.weaponDurability}</span>
            </div>
          )}
        </div>

        {/* Player hero */}
        <HeroZone
          heroName={myState.heroName}
          faction={myState.heroFaction}
          hp={myState.hp}
          armor={myState.armor}
          heroPowerName={myState.heroPower.name}
          heroPowerUsed={myState.heroPowerUsed}
          hasWeapon={myState.hasWeapon}
          weaponAttack={myState.weaponAttack}
          weaponDurability={myState.weaponDurability}
          onHeroClick={() => {
            if (myState.hasWeapon && !myState.heroHasAttacked && canAct) {
              selectAttacker("hero_" + playerId);
              setPhase("select_attack_target");
            }
          }}
          onHeroPowerClick={handleHeroPowerClick}
        />

        {/* Hero power + deck (right) */}
        <div style={{ position: "absolute", right: 30, display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{
            width: 50, height: 70, borderRadius: 8,
            background: "linear-gradient(150deg,#2a3142,#12161f)",
            border: "1.5px solid rgba(231,199,104,.3)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            boxShadow: "3px 3px 0 rgba(0,0,0,.4)",
          }}>
            <span style={{ font: `800 16px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c9b48a" }}>{myState.deckCount}</span>
            <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", letterSpacing: 1 }}>DECK</span>
          </div>
        </div>
      </div>

      {/* ===== GAS CRYSTALS ===== */}
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const on = i < manaAvailable;
          const exists = i < manaTotal;
          return (
            <div key={i} style={{
              width: 17, height: 17,
              transform: "rotate(45deg)",
              borderRadius: 3,
              background: on ? "linear-gradient(135deg,#bfe4ff,#2f8fe0)" : exists ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)",
              border: exists ? (on ? "1px solid #7cc4ff" : "1px solid rgba(255,255,255,.12)") : "1px solid rgba(255,255,255,.04)",
              boxShadow: on ? "0 0 7px rgba(74,160,230,.6)" : "none",
              transition: "all 0.2s",
            }} />
          );
        })}
        <span style={{ marginLeft: 12, font: `800 15px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>
          {manaAvailable} <span style={{ color: "#5a6478" }}>/ {manaTotal}</span>
        </span>
      </div>

      {/* ===== PLAYER HAND (fanned, bottom) ===== */}
      <div style={{ position: "absolute", bottom: -46, left: 0, right: 0, height: 260 }}>
        <HandZone
          hand={myState.hand as (Card & { instanceId?: string })[]}
          selectedInstanceId={selectedCardInstanceId}
          currentMana={manaAvailable}
          onCardClick={(id) => {
            if (!canAct) return;
            const card = myState.hand.find((c) => (c as Card & { instanceId?: string }).instanceId === id);
            if (!card) return;
            const needsTarget = card.effects?.some((e) => e.target === "chosen_minion" || e.target === "chosen_any");
            if (needsTarget) {
              selectCard(id);
              setPhase("select_play_target");
            } else {
              sendAction({ type: "play_card", cardInstanceId: id });
            }
          }}
          onCardHover={(card) => setHoveredCard(card)}
        />
      </div>

      {/* Card hover preview (bottom-right corner) */}
      {hoveredCard && (
        <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 40, pointerEvents: "none", filter: "drop-shadow(0 0 24px rgba(0,0,0,.9))", animation: "cardPopIn 0.15s ease-out" }}>
          <CardComponent card={hoveredCard} size="lg" glowing />
        </div>
      )}

      {/* Urgent timer alert */}
      {timerUrgent && turnSecondsLeft > 0 && (
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 50,
          padding: "8px 20px", borderRadius: 20,
          background: "rgba(120,0,0,.9)", border: "2px solid #ff3333", color: "#ff8888",
          font: `900 13px var(--font-cinzel,'Cinzel',serif)`,
          animation: "urgentPulse 0.5s ease-in-out infinite",
          boxShadow: "0 0 24px rgba(255,50,50,.5)",
        }}>
          ⚠️ TURN ENDS IN {turnSecondsLeft}s
        </div>
      )}

      <style>{`
        @keyframes pulse-end-turn {
          0%, 100% { box-shadow: 0 0 22px rgba(231,199,104,.35), inset 0 1px 0 rgba(255,240,190,.3); }
          50% { box-shadow: 0 0 32px rgba(231,199,104,.6), inset 0 1px 0 rgba(255,240,190,.5); }
        }
        @keyframes cardPopIn {
          from { transform: scale(0.85) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes urgentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const FAC_BY_FACTION: Record<string, string> = {
  bitcoin: "#f7931a",
  ethereum: "#7b8cf4",
  solana: "#19e08a",
  meme: "#ff5fae",
  stable: "#2bbd86",
  degen: "#9aa3b2",
};
