"use client";

import React, { useState, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { sendAction } from "@/hooks/useSocket";
import MinionCard from "../Board/MinionCard";
import HeroZone from "../Board/HeroZone";
import HandZone from "../Board/HandZone";
import MulliganScreen from "./MulliganScreen";
import CardComponent from "../Card/CardComponent";
import type { MinionSlot, Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

type PhaseAction = "idle" | "select_play_target" | "select_attack_target" | "select_hero_power_target";

export default function GameBoard() {
  const { gameState, isMyTurn, selectedCardInstanceId, selectedAttackerId, lastActionError, playerId } = useGameStore();
  const { selectCard, selectAttacker, setActionError } = useGameStore();
  const [phase, setPhase] = useState<PhaseAction>("idle");
  const [hoveredCard, setHoveredCard] = useState<CardData | null>(null);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🎮</div>
          <p className="text-lg">Connecting to game...</p>
        </div>
      </div>
    );
  }

  // Show mulligan screen if game hasn't started yet
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

  // Game over screen
  if (gameState.status === "finished") {
    const iWon = gameState.activePlayerId === playerId;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
        style={{ background: "rgba(2,4,10,0.95)" }}
      >
        <div
          className="text-6xl font-black"
          style={{ color: iWon ? "#f7931a" : "#ff4444", textShadow: `0 0 40px ${iWon ? "rgba(247,147,26,0.6)" : "rgba(255,68,68,0.6)"}` }}
        >
          {iWon ? "VICTORY" : "DEFEAT"}
        </div>
        <p style={{ color: "#6080a0" }}>Turn {gameState.turnNumber}</p>
        <button
          onClick={() => window.location.href = "/"}
          className="px-8 py-3 rounded-xl font-black"
          style={{ background: "linear-gradient(135deg, #f7931a, #c46800)", color: "#fff", border: "2px solid #f7931a" }}
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

  function handleCardClick(instanceId: string) {
    if (!canAct) return;
    if (phase === "select_play_target") {
      sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId!, targetInstanceId: instanceId });
      selectCard(null); setPhase("idle"); return;
    }
    if (phase === "select_attack_target") {
      sendAction({ type: "attack", attackerInstanceId: selectedAttackerId!, defenderInstanceId: instanceId });
      selectAttacker(null); setPhase("idle"); return;
    }
    selectCard(instanceId);
    setPhase("select_play_target");
  }

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
      } else if (myState.hasWeapon && !myState.heroHasAttacked) {
        const heroId = "hero_" + opponentState.playerId;
        const tauntMinions = opponentState.board.filter((s): s is MinionSlot => s !== null && s.hasTaunt);
        if (tauntMinions.length === 0) {
          sendAction({ type: "attack", attackerInstanceId: "hero_" + playerId, defenderInstanceId: heroId });
        }
      }
    }
  }

  function handleHeroPowerClick() {
    if (!canAct || myState.heroPowerUsed) return;
    const cost = myState.heroPower.cost;
    if (myState.mana + myState.tempMana < cost) return;
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

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full overflow-hidden relative"
      style={{ background: "radial-gradient(ellipse at 50% 50%, #080d1a 0%, #030508 100%)" }}
    >
      {/* Subtle grid floor */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#4060ff 1px, transparent 1px), linear-gradient(90deg, #4060ff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Whose turn banner */}
      <div
        className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-6 py-1.5 rounded-full text-xs font-black tracking-widest uppercase transition-all"
        style={{
          background: isMyTurn ? "rgba(64,224,128,0.12)" : "rgba(255,68,68,0.08)",
          border: `1px solid ${isMyTurn ? "#40e080" : "#ff4444"}`,
          color: isMyTurn ? "#40e080" : "#ff6060",
          boxShadow: isMyTurn ? "0 0 16px rgba(64,224,128,0.2)" : "0 0 10px rgba(255,68,68,0.1)",
        }}
      >
        {isMyTurn ? "⚡ YOUR TURN" : "⏳ OPPONENT'S TURN"}
      </div>

      {/* Error banner */}
      {lastActionError && (
        <div
          className="absolute top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium text-red-300 cursor-pointer"
          style={{ background: "rgba(100,0,0,0.9)", border: "1px solid #ff3333" }}
          onClick={() => setActionError(null)}
        >
          {lastActionError} ✕
        </div>
      )}

      {/* Phase instruction */}
      {phase !== "idle" && (
        <div
          className="absolute z-40 px-5 py-2 rounded-full text-sm font-bold pointer-events-none"
          style={{
            bottom: "calc(50% - 20px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(60,50,0,0.9)",
            border: "1px solid #e0c040",
            color: "#ffe060",
            boxShadow: "0 0 20px rgba(224,192,64,0.3)",
          }}
        >
          {phase === "select_play_target" && "→ Select a target to play on"}
          {phase === "select_attack_target" && "→ Select a target to attack"}
          {phase === "select_hero_power_target" && "→ Select a target for Hero Power"}
          <button
            className="ml-3 text-xs opacity-70 pointer-events-auto"
            onClick={handleCancel}
          >
            [ESC]
          </button>
        </div>
      )}

      {/* Main game area — centered, max width */}
      <div className="relative z-10 flex flex-col w-full" style={{ maxWidth: 960, height: "100%" }}>

        {/* === OPPONENT SIDE === */}
        <div
          className="flex-none flex items-start justify-between gap-2 px-4 pt-3 pb-1"
          style={{
            background: "linear-gradient(180deg, rgba(20,10,10,0.6) 0%, transparent 100%)",
            borderBottom: "1px solid rgba(255,80,80,0.08)",
          }}
        >
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
          {/* Opponent hand + deck */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(opponentState.handCount, 10) }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-md"
                  style={{
                    width: 22, height: 32,
                    background: "linear-gradient(135deg, #1a2040, #0d1030)",
                    border: "1px solid #2a3560",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                  }}
                />
              ))}
            </div>
            <div className="text-xs text-right" style={{ color: "#304060" }}>
              <span style={{ color: "#6080c0", fontWeight: 700 }}>{opponentState.deckCount}</span> cards left
            </div>
          </div>
        </div>

        {/* === OPPONENT BOARD === */}
        <div
          className="flex-none flex items-center justify-center gap-2 py-3"
          style={{
            minHeight: 108,
            background: "linear-gradient(180deg, rgba(40,10,10,0.2) 0%, transparent 100%)",
            transform: "perspective(900px) rotateX(4deg)",
            transformOrigin: "bottom center",
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => {
            const slot = opponentState.board[i];
            const isValidTarget = phase === "select_attack_target" && slot ? validTargets.includes(slot.instanceId) : false;
            return (
              <div key={i} style={{ width: 76, height: 92 }}>
                {slot ? (
                  <MinionCard
                    slot={slot}
                    isEnemy
                    isValidTarget={isValidTarget}
                    onClick={() => handleMinionClick(slot.instanceId, true)}
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-lg"
                    style={{
                      border: "1px dashed rgba(255,60,60,0.12)",
                      background: "rgba(255,20,20,0.02)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* === CENTER DIVIDER — mana + turn === */}
        <div
          className="flex-none flex items-center gap-3 px-4"
          style={{ height: 42, background: "rgba(10,12,24,0.8)", borderTop: "1px solid #1a2040", borderBottom: "1px solid #1a2040" }}
        >
          {/* Mana crystals */}
          <div className="flex gap-1 items-center">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: 14, height: 14,
                  background: i < manaAvailable
                    ? "radial-gradient(circle, #80c0ff, #2060d0)"
                    : i < manaTotal
                    ? "radial-gradient(circle, #1a3060, #0a1830)"
                    : "rgba(20,25,40,0.4)",
                  border: i < manaTotal ? "1px solid #2060a0" : "1px solid #1a2035",
                  boxShadow: i < manaAvailable ? "0 0 6px rgba(64,128,255,0.5)" : "none",
                }}
              />
            ))}
            <span className="text-xs font-bold ml-1" style={{ color: "#4080c0" }}>
              {manaAvailable}/{manaTotal}
            </span>
          </div>

          <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #2a3560, transparent)" }} />

          {/* Turn / End button */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#304060" }}>T{gameState.turnNumber}</span>
            {phase !== "idle" ? (
              <button
                onClick={handleCancel}
                className="px-3 py-1 rounded font-bold text-xs"
                style={{ background: "rgba(60,30,0,0.7)", border: "1px solid #ff8033", color: "#ffaa66" }}
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={handleEndTurn}
                disabled={!canAct}
                className="px-5 py-1.5 rounded-lg font-black text-sm transition-all"
                style={{
                  background: canAct
                    ? "linear-gradient(135deg, #2a7040, #1a5025)"
                    : "rgba(20,25,35,0.7)",
                  border: `2px solid ${canAct ? "#40e080" : "#252535"}`,
                  color: canAct ? "#40e080" : "#404050",
                  cursor: canAct ? "pointer" : "not-allowed",
                  boxShadow: canAct ? "0 0 14px rgba(64,224,128,0.4)" : "none",
                  minWidth: 96,
                  animation: canAct ? "pulse-green 2s ease-in-out infinite" : "none",
                }}
              >
                {canAct ? "End Turn" : isMyTurn ? "⏳ Wait..." : "Enemy Turn"}
              </button>
            )}
          </div>
        </div>

        {/* === MY BOARD === */}
        <div
          className="flex-none flex items-center justify-center gap-2 py-3"
          style={{
            minHeight: 108,
            background: "linear-gradient(0deg, rgba(10,30,10,0.2) 0%, transparent 100%)",
            transform: "perspective(900px) rotateX(-4deg)",
            transformOrigin: "top center",
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => {
            const slot = myState.board[i];
            const isAttacking = slot?.instanceId === selectedAttackerId;
            return (
              <div key={i} style={{ width: 76, height: 92 }}>
                {slot ? (
                  <MinionCard
                    slot={slot}
                    isSelected={isAttacking}
                    isAttacking={isAttacking}
                    onClick={() => handleMinionClick(slot.instanceId, false)}
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-lg cursor-pointer transition-all"
                    style={{
                      border: phase === "select_play_target" && selectedCardInstanceId
                        ? "1px dashed rgba(64,224,128,0.5)"
                        : "1px dashed rgba(40,80,40,0.2)",
                      background: phase === "select_play_target" ? "rgba(64,224,128,0.04)" : "rgba(20,40,20,0.03)",
                    }}
                    onClick={() => {
                      if (phase === "select_play_target" && selectedCardInstanceId) {
                        sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, boardPosition: i });
                        selectCard(null); setPhase("idle");
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* === MY SIDE === */}
        <div
          className="flex-1 flex items-end justify-between gap-2 px-4 pb-3"
          style={{
            background: "linear-gradient(0deg, rgba(10,20,10,0.5) 0%, transparent 100%)",
            borderTop: "1px solid rgba(64,224,128,0.06)",
          }}
        >
          {/* Hero zone */}
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

          {/* Hand */}
          <div className="flex-1 flex items-end justify-center">
            <HandZone
              hand={myState.hand as (Card & { instanceId?: string })[]}
              selectedInstanceId={selectedCardInstanceId}
              currentMana={manaAvailable}
              onCardClick={(id) => {
                if (!canAct) return;
                const card = myState.hand.find(
                  (c) => (c as Card & { instanceId?: string }).instanceId === id
                );
                if (!card) return;
                const needsTarget = card.effects?.some(
                  (e) => e.target === "chosen_minion" || e.target === "chosen_any"
                );
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

          {/* Deck/burn info */}
          <div className="flex flex-col items-end gap-1 text-xs pb-2" style={{ color: "#304060" }}>
            <div><span style={{ color: "#6080c0", fontWeight: 700 }}>{myState.deckCount}</span> in deck</div>
            <div><span style={{ color: "#906040", fontWeight: 700 }}>{myState.burnPile.length}</span> burned</div>
          </div>
        </div>
      </div>

      {/* Card hover preview (bottom-right corner) */}
      {hoveredCard && (
        <div
          className="fixed bottom-4 right-4 z-40 pointer-events-none"
          style={{
            filter: "drop-shadow(0 0 24px rgba(0,0,0,0.9))",
            animation: "cardPopIn 0.15s ease-out",
          }}
        >
          <CardComponent card={hoveredCard} size="lg" glowing />
        </div>
      )}

      {/* CSS animation for pulsing end turn */}
      <style>{`
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 14px rgba(64,224,128,0.4); }
          50% { box-shadow: 0 0 22px rgba(64,224,128,0.7); }
        }
        @keyframes cardPopIn {
          from { transform: scale(0.85) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
