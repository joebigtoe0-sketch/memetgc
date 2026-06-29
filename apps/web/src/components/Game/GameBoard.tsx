"use client";

import React, { useState, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { sendAction } from "@/hooks/useSocket";
import MinionCard from "../Board/MinionCard";
import HeroZone from "../Board/HeroZone";
import HandZone from "../Board/HandZone";
import type { MinionSlot, Card } from "@memetgc/types";

type PhaseAction = "idle" | "select_play_target" | "select_attack_target" | "select_hero_power_target";

export default function GameBoard() {
  const { gameState, isMyTurn, selectedCardInstanceId, selectedAttackerId, lastActionError, playerId } = useGameStore();
  const { selectCard, selectAttacker, setActionError } = useGameStore();
  const [phase, setPhase] = useState<PhaseAction>("idle");

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">🎮</div>
          <p className="text-lg">Connecting to game...</p>
        </div>
      </div>
    );
  }

  const { myState, opponentState } = gameState;
  const canAct = isMyTurn && gameState.phase === "main" && gameState.status === "in_progress";

  // Get valid attack targets when attacker is selected
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
      // Play selected card targeting this minion
      sendAction({
        type: "play_card",
        cardInstanceId: selectedCardInstanceId!,
        targetInstanceId: instanceId,
      });
      selectCard(null);
      setPhase("idle");
      return;
    }

    if (phase === "select_attack_target") {
      // Attack with selected attacker
      sendAction({
        type: "attack",
        attackerInstanceId: selectedAttackerId!,
        defenderInstanceId: instanceId,
      });
      selectAttacker(null);
      setPhase("idle");
      return;
    }

    selectCard(instanceId);
    setPhase("select_play_target");
  }

  function handleMinionClick(instanceId: string, isEnemy: boolean) {
    if (!canAct) return;

    if (phase === "select_attack_target") {
      if (validTargets.includes(instanceId)) {
        sendAction({
          type: "attack",
          attackerInstanceId: selectedAttackerId!,
          defenderInstanceId: instanceId,
        });
        selectAttacker(null);
        setPhase("idle");
      }
      return;
    }

    if (phase === "select_play_target") {
      sendAction({
        type: "play_card",
        cardInstanceId: selectedCardInstanceId!,
        targetInstanceId: instanceId,
      });
      selectCard(null);
      setPhase("idle");
      return;
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
          sendAction({
            type: "attack",
            attackerInstanceId: selectedAttackerId,
            defenderInstanceId: heroId,
          });
          selectAttacker(null);
          setPhase("idle");
        }
      } else if (phase === "select_play_target" && selectedCardInstanceId) {
        sendAction({
          type: "play_card",
          cardInstanceId: selectedCardInstanceId,
          targetInstanceId: "hero_" + opponentState.playerId,
        });
        selectCard(null);
        setPhase("idle");
      } else if (myState.hasWeapon && !myState.heroHasAttacked) {
        // Hero weapon attack
        const heroId = "hero_" + opponentState.playerId;
        const opponentMinions = opponentState.board.filter((s): s is MinionSlot => s !== null);
        const tauntMinions = opponentMinions.filter((m) => m.hasTaunt);
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
    selectCard(null);
    selectAttacker(null);
    setPhase("idle");
  }

  function handleCancel() {
    selectCard(null);
    selectAttacker(null);
    setPhase("idle");
  }

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ background: "linear-gradient(180deg, #060810 0%, #0a0d1a 100%)", userSelect: "none" }}
    >
      {/* Error banner */}
      {lastActionError && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium text-red-300"
          style={{ background: "rgba(100,0,0,0.85)", border: "1px solid #ff3333" }}
        >
          {lastActionError}
        </div>
      )}

      {/* Top — Opponent side */}
      <div className="flex-none p-3 flex items-start gap-4">
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

        {/* Opponent hand count */}
        <div className="flex-1 flex items-center justify-end">
          <div className="flex gap-1">
            {Array.from({ length: opponentState.handCount }).map((_, i) => (
              <div
                key={i}
                className="rounded"
                style={{
                  width: 28,
                  height: 40,
                  background: "linear-gradient(135deg, #1a2040, #0d1030)",
                  border: "1px solid #2a3560",
                }}
              />
            ))}
          </div>
        </div>

        {/* Deck count */}
        <div
          className="flex flex-col items-center gap-1 cursor-default"
          style={{ color: "#4060a0", fontSize: 11 }}
        >
          <div className="font-bold text-lg" style={{ color: "#6080c0" }}>{opponentState.deckCount}</div>
          <div>Deck</div>
        </div>
      </div>

      {/* Opponent board */}
      <div className="flex-none flex items-center justify-center gap-2 py-2 px-4">
        {Array.from({ length: 7 }).map((_, i) => {
          const slot = opponentState.board[i];
          const isValidTarget = phase === "select_attack_target" && slot ? validTargets.includes(slot.instanceId) : false;
          return (
            <div key={i} style={{ width: 72, height: 88 }}>
              {slot ? (
                <MinionCard
                  slot={slot}
                  isEnemy
                  isValidTarget={isValidTarget}
                  onClick={() => handleMinionClick(slot.instanceId, true)}
                />
              ) : (
                <div
                  className="w-full h-full rounded-lg border border-dashed"
                  style={{ border: "1px dashed rgba(30,50,100,0.4)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Center divider */}
      <div
        className="flex-none mx-4 my-1 flex items-center gap-3"
        style={{ height: 28 }}
      >
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #2a3560, transparent)" }} />
        <div className="flex items-center gap-2">
          {/* Mana crystals */}
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 12,
                  height: 12,
                  background:
                    i < myState.mana
                      ? "radial-gradient(circle, #80aaff, #2040c0)"
                      : i < myState.maxMana
                      ? "radial-gradient(circle, #1a2040, #0d1020)"
                      : "transparent",
                  border: i < myState.maxMana ? "1px solid #2040c0" : "1px solid transparent",
                  opacity: i < myState.maxMana ? 1 : 0.2,
                }}
              />
            ))}
            <span className="text-blue-400 font-bold ml-1" style={{ fontSize: 11 }}>
              {myState.mana}/{myState.maxMana}
            </span>
          </div>

          {/* Turn indicator */}
          <div
            className="px-3 py-1 rounded font-bold text-xs"
            style={{
              background: isMyTurn ? "rgba(40,100,40,0.7)" : "rgba(100,40,40,0.4)",
              border: `1px solid ${isMyTurn ? "#40e080" : "#804040"}`,
              color: isMyTurn ? "#40e080" : "#a06060",
            }}
          >
            {gameState.status === "mulligan" ? "MULLIGAN" : isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
          </div>
        </div>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #2a3560, transparent)" }} />
      </div>

      {/* Player board */}
      <div className="flex-none flex items-center justify-center gap-2 py-2 px-4">
        {Array.from({ length: 7 }).map((_, i) => {
          const slot = myState.board[i];
          const isAttacking = slot?.instanceId === selectedAttackerId;
          return (
            <div key={i} style={{ width: 72, height: 88 }}>
              {slot ? (
                <MinionCard
                  slot={slot}
                  isSelected={isAttacking}
                  isAttacking={isAttacking}
                  onClick={() => handleMinionClick(slot.instanceId, false)}
                />
              ) : (
                <div
                  className="w-full h-full rounded-lg cursor-pointer transition-colors"
                  style={{
                    border: phase === "select_play_target" && selectedCardInstanceId
                      ? "1px dashed rgba(64,224,128,0.5)"
                      : "1px dashed rgba(30,50,100,0.3)",
                    background: phase === "select_play_target" ? "rgba(64,224,128,0.03)" : "transparent",
                  }}
                  onClick={() => {
                    if (phase === "select_play_target" && selectedCardInstanceId) {
                      sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, boardPosition: i });
                      selectCard(null);
                      setPhase("idle");
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom — Player controls */}
      <div className="flex-none p-3 flex items-end gap-4">
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
            currentMana={myState.mana + myState.tempMana}
            onCardClick={(id) => {
              const card = myState.hand.find(
                (c) => (c as Card & { instanceId?: string }).instanceId === id
              );
              if (!card) return;

              // Cards with targeted effects need target selection
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
          />
        </div>

        {/* Right side controls */}
        <div className="flex flex-col items-end gap-2">
          {/* Cancel button */}
          {phase !== "idle" && (
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded text-xs font-bold text-orange-300 hover:text-orange-200 transition-colors"
              style={{ background: "rgba(60,30,0,0.7)", border: "1px solid #ff8033" }}
            >
              Cancel
            </button>
          )}

          {/* End Turn */}
          <button
            onClick={handleEndTurn}
            disabled={!canAct}
            className="px-4 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: canAct
                ? "linear-gradient(135deg, #2a6040, #1a4020)"
                : "rgba(30,30,40,0.6)",
              border: `1px solid ${canAct ? "#40e080" : "#333"}`,
              color: canAct ? "#40e080" : "#555",
              cursor: canAct ? "pointer" : "not-allowed",
              boxShadow: canAct ? "0 0 10px rgba(64,224,128,0.3)" : "none",
              minWidth: 90,
            }}
          >
            End Turn
          </button>

          {/* Deck / Burn pile */}
          <div className="flex gap-2 text-xs" style={{ color: "#4060a0" }}>
            <div className="text-center">
              <div className="font-bold" style={{ color: "#6080c0" }}>{myState.deckCount}</div>
              <div>Deck</div>
            </div>
            <div className="text-center">
              <div className="font-bold" style={{ color: "#a06040" }}>{myState.burnPile.length}</div>
              <div>Burn</div>
            </div>
          </div>
        </div>
      </div>

      {/* Turn # */}
      <div
        className="absolute top-2 right-3 text-xs"
        style={{ color: "#304060" }}
      >
        Turn {gameState.turnNumber}
      </div>

      {/* Action guide */}
      {phase !== "idle" && (
        <div
          className="absolute bottom-36 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium text-yellow-300 pointer-events-none"
          style={{ background: "rgba(60,50,0,0.85)", border: "1px solid #e0c040" }}
        >
          {phase === "select_play_target" && "Select a target"}
          {phase === "select_attack_target" && "Select attack target"}
          {phase === "select_hero_power_target" && "Select Hero Power target"}
        </div>
      )}
    </div>
  );
}
