"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { sendAction } from "@/hooks/useSocket";
import MinionCard from "../Board/MinionCard";
import HeroZone from "../Board/HeroZone";
import HandZone from "../Board/HandZone";
import MulliganScreen from "./MulliganScreen";
import CardComponent from "../Card/CardComponent";
import type { MinionSlot, Card, AnimationHint } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

const TURN_SECONDS = 30;

type PhaseAction = "idle" | "select_play_target" | "select_attack_target";

interface Toast {
  id: string;
  text: string;
  color: string;
}

const FAC: Record<string, string> = {
  bitcoin: "#f7931a", ethereum: "#7b8cf4", solana: "#19e08a",
  meme: "#ff5fae", stable: "#2bbd86", degen: "#9aa3b2",
};

export default function GameBoard() {
  const { gameState, isMyTurn, selectedCardInstanceId, selectedAttackerId, lastActionError, playerId, pendingAnimations } = useGameStore();
  const { selectCard, selectAttacker, setActionError, clearAnimations } = useGameStore();
  const [phase, setPhase] = useState<PhaseAction>("idle");
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(TURN_SECONDS);
  const [showNewTurn, setShowNewTurn] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsMyTurn = useRef(false);

  // Turn timer
  useEffect(() => {
    const inProgress = gameState?.status === "in_progress";
    if (inProgress && isMyTurn && !prevIsMyTurn.current) {
      setTurnSecondsLeft(TURN_SECONDS);
      setShowNewTurn(true);
      setTimeout(() => setShowNewTurn(false), 1800);
    }
    prevIsMyTurn.current = !!(inProgress && isMyTurn);

    if (inProgress && isMyTurn) {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      turnTimerRef.current = setInterval(() => setTurnSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    } else {
      if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
      if (!isMyTurn) setTurnSecondsLeft(TURN_SECONDS);
    }
    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current); };
  }, [isMyTurn, gameState?.status]);

  // Toast notifications from animations
  const addToast = useCallback((text: string, color: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { id, text, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400);
  }, []);

  useEffect(() => {
    if (!pendingAnimations?.length) return;
    for (const anim of pendingAnimations) {
      if (anim.type === "draw") {
        const data = anim.data as { overdraw?: boolean; fatigue?: number; playerId?: string };
        if (data.playerId === playerId) {
          if (data.fatigue) addToast(`💀 Fatigue! -${data.fatigue}`, "#ff5555");
          else if (data.overdraw) addToast("🔥 Card burned (overdraw)", "#ff9944");
          else addToast("🎴 Drew a card", "#7cc4ff");
        }
      } else if (anim.type === "death") {
        const data = anim.data as { cardId?: string };
        addToast(`💀 Minion destroyed`, "#ff8888");
      } else if (anim.type === "heal") {
        addToast(`💚 Healed`, "#66ee88");
      }
    }
    clearAnimations();
  }, [pendingAnimations, playerId, addToast, clearAnimations]);

  if (!gameState) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6a7488" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
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

  if (gameState.status === "finished") {
    const iWon = gameState.winner === playerId;
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(6,8,13,.96)" }}>
        <div style={{ font: `900 72px/1 var(--font-cinzel,'Cinzel',serif)`, color: iWon ? "#f7c64a" : "#ff5555", textShadow: `0 0 60px ${iWon ? "rgba(247,198,74,.5)" : "rgba(255,85,85,.5)"}`, animation: "victoryPop 0.4s ease-out" }}>
          {iWon ? "VICTORY" : "DEFEAT"}
        </div>
        <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: "#8a93a6" }}>
          {gameState.endReason === "surrender" ? "SURRENDER" : `TURN ${gameState.turnNumber}`}
        </div>
        <button onClick={() => { window.location.href = "/"; }} style={{ cursor: "pointer", border: "none", padding: "15px 44px", borderRadius: 12, font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 24px rgba(224,137,15,.4)" }}>
          Back to Menu
        </button>
      </div>
    );
  }

  const { myState, opponentState } = gameState;
  const canAct = isMyTurn && gameState.phase === "main" && gameState.status === "in_progress";
  const timerUrgent = isMyTurn && turnSecondsLeft <= 5;

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
    } else {
      if (myState.hasWeapon && !myState.heroHasAttacked && canAct) {
        selectAttacker("hero_" + playerId);
        setPhase("select_attack_target");
      }
    }
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

  function handleSurrender() {
    sendAction({ type: "surrender" });
    setShowSurrenderConfirm(false);
  }

  const manaAvailable = myState.mana + myState.tempMana;

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%",
      display: "flex", flexDirection: "column", overflow: "hidden",
      background: "radial-gradient(120% 80% at 50% 50%,#16202f 0%,#0a0e16 70%,#070a10 100%)",
      fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
    }}>
      {/* Subtle grid bg */}
      <div style={{ position: "absolute", inset: 0, opacity: .4, backgroundImage: "repeating-linear-gradient(90deg,transparent 0 39px,rgba(255,255,255,.015) 39px 40px)", pointerEvents: "none" }} />

      {/* ═══════════════ OPPONENT ZONE (top 44%) ═══════════════ */}
      <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "column", padding: "8px 0 4px" }}>

        {/* Opponent info bar */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "4px 16px" }}>
          {/* Deck */}
          <DeckPile count={opponentState.deckCount} />
          {/* Hero zone */}
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
          {/* Opponent mana */}
          <ManaDisplay mana={opponentState.mana} maxMana={opponentState.maxMana} compact />
          {/* Hand count */}
          <HandCountDisplay count={opponentState.handCount} faction={opponentState.heroFaction} />
        </div>

        {/* Opponent board — slots pushed to bottom */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: "0 60px 4px" }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const slot = opponentState.board[i];
            const isValidTarget = phase === "select_attack_target" && slot ? validTargets.includes(slot.instanceId) : false;
            return (
              <BoardSlot key={i} highlighted={isValidTarget} dimmed={phase === "select_attack_target" && !isValidTarget && !!slot}>
                {slot && (
                  <MinionCard
                    slot={slot}
                    isEnemy
                    isValidTarget={isValidTarget}
                    onClick={() => handleMinionClick(slot.instanceId, true)}
                    onHover={(c) => setZoomedCard(c ? slotToCardData(slot) : null)}
                  />
                )}
              </BoardSlot>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ CENTER DIVIDER BAR ═══════════════ */}
      <div style={{ flex: "0 0 52px", position: "relative", display: "flex", alignItems: "center" }}>
        {/* Gold center line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "linear-gradient(90deg,transparent,rgba(231,199,104,.4),transparent)", pointerEvents: "none" }} />

        {/* Turn badge (left) */}
        <div style={{
          position: "absolute", left: 16, zIndex: 10,
          padding: "7px 14px", borderRadius: 9,
          background: isMyTurn ? "rgba(25,224,138,.1)" : "rgba(255,255,255,.04)",
          border: `1px solid ${isMyTurn ? "rgba(25,224,138,.35)" : "rgba(255,255,255,.1)"}`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
        }}>
          <span style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: isMyTurn ? "#7fe8bd" : "#c4ccd8" }}>
            {isMyTurn ? "YOUR TURN" : "ENEMY TURN"}
          </span>
          {isMyTurn && (
            <span style={{ font: `900 13px var(--font-mono,'JetBrains Mono',monospace)`, color: timerUrgent ? "#ff4444" : "#7fe8bd", animation: timerUrgent ? "urgentPulse 0.5s ease-in-out infinite" : "none" }}>
              {turnSecondsLeft}s
            </span>
          )}
        </div>

        {/* Phase instruction (center) */}
        {phase !== "idle" && (
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 20, padding: "6px 16px", borderRadius: 20, background: "rgba(60,50,0,.95)", border: "1px solid #e0c040", color: "#ffe060", font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", whiteSpace: "nowrap", boxShadow: "0 0 16px rgba(224,192,64,.3)" }}>
            {phase === "select_play_target" && "→ SELECT TARGET FOR SPELL"}
            {phase === "select_attack_target" && "→ SELECT ATTACK TARGET"}
          </div>
        )}

        {/* Controls (right) */}
        <div style={{ position: "absolute", right: 16, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
          {/* Surrender */}
          <button
            onClick={() => setShowSurrenderConfirm(true)}
            title="Surrender"
            style={{ cursor: "pointer", width: 34, height: 34, borderRadius: 8, background: "rgba(120,20,20,.7)", border: "1px solid rgba(255,80,80,.35)", color: "#ff8888", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >🏳</button>
          {/* Settings */}
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{ cursor: "pointer", width: 34, height: 34, borderRadius: 8, background: "rgba(8,11,18,.7)", border: "1px solid rgba(255,255,255,.12)", color: "#c4ccd8", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >⚙</button>
          {/* End Turn / Cancel */}
          {phase !== "idle" ? (
            <button onClick={handleCancel} style={{ cursor: "pointer", padding: "8px 18px", borderRadius: 10, border: "2px solid rgba(255,140,60,.6)", background: "rgba(255,90,30,.08)", color: "#ffaa66", font: `800 13px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px" }}>
              CANCEL
            </button>
          ) : (
            <button
              onClick={handleEndTurn}
              disabled={!canAct}
              style={{
                cursor: canAct ? "pointer" : "not-allowed",
                padding: "10px 22px", borderRadius: 10,
                border: `2px solid ${canAct ? "#e0b13a" : "rgba(255,255,255,.1)"}`,
                background: canAct ? "linear-gradient(180deg,#3a4150,#1c2230)" : "rgba(20,22,30,.7)",
                boxShadow: canAct ? "0 0 20px rgba(231,199,104,.3), inset 0 1px 0 rgba(255,240,190,.25)" : "none",
                color: canAct ? "#f3e8cc" : "#4a5060",
                font: `800 14px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: ".5px",
                animation: canAct ? "pulseEndTurn 2s ease-in-out infinite" : "none",
              }}
            >
              END TURN
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════ PLAYER ZONE (flex 1) ═══════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Player board — slots at top */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 8, padding: "4px 60px 0", minHeight: 0 }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const slot = myState.board[i];
            const isAttacking = slot?.instanceId === selectedAttackerId;
            return (
              <BoardSlot
                key={i}
                highlighted={isAttacking || (phase === "select_play_target" && !slot)}
                glowing={isAttacking}
                clickable={!slot && phase === "select_play_target"}
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
                    onHover={(c) => setZoomedCard(c ? slotToCardData(slot) : null)}
                  />
                )}
              </BoardSlot>
            );
          })}
        </div>

        {/* Player info bar */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "4px 16px 0" }}>
          {/* Weapon (if any) */}
          {myState.hasWeapon && (
            <div style={{ font: `700 11px var(--font-cinzel,'Cinzel',serif)`, color: "#e8d090", padding: "4px 8px", borderRadius: 6, background: "rgba(231,199,104,.1)", border: "1px solid rgba(231,199,104,.2)" }}>
              ⚔️ {myState.weaponAttack}/{myState.weaponDurability}
            </div>
          )}
          {/* Deck */}
          <DeckPile count={myState.deckCount} />
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
            onHeroClick={() => handleHeroClick(false)}
            onHeroPowerClick={() => { if (canAct && !myState.heroPowerUsed) sendAction({ type: "hero_power" }); }}
          />
          {/* Mana crystals */}
          <ManaCrystals available={manaAvailable} total={myState.maxMana} />
        </div>

        {/* Player hand */}
        <div style={{ flex: "0 0 148px", position: "relative" }}>
          <HandZone
            hand={myState.hand as (Card & { instanceId?: string })[]}
            selectedInstanceId={selectedCardInstanceId}
            currentMana={manaAvailable}
            onCardClick={(id) => {
              if (!canAct) return;
              const card = myState.hand.find((c) => (c as Card & { instanceId?: string }).instanceId === id);
              if (!card) return;
              const needsTarget = card.effects?.some((e) => e.target === "chosen_minion" || e.target === "chosen_any");
              if (needsTarget) { selectCard(id); setPhase("select_play_target"); }
              else { sendAction({ type: "play_card", cardInstanceId: id }); }
            }}
            onCardHover={(card) => setZoomedCard(card)}
          />
        </div>
      </div>

      {/* ═══════════════ OVERLAYS ═══════════════ */}

      {/* Card zoom overlay (center) */}
      {zoomedCard && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", background: "rgba(4,6,12,.6)", backdropFilter: "blur(3px)" }}>
          <div style={{ animation: "cardZoomIn 0.18s ease-out", filter: "drop-shadow(0 0 40px rgba(0,0,0,.9))" }}>
            <CardComponent card={zoomedCard} size="lg" glowing />
          </div>
        </div>
      )}

      {/* Error banner */}
      {lastActionError && (
        <div onClick={() => setActionError(null)} style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", zIndex: 80, padding: "8px 18px", borderRadius: 10, background: "rgba(100,0,0,.95)", border: "1px solid #ff3333", color: "#ff8888", cursor: "pointer", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, whiteSpace: "nowrap" }}>
          {lastActionError} ✕
        </div>
      )}

      {/* NEW TURN flash */}
      {showNewTurn && (
        <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ font: `900 52px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#f7c64a", textShadow: "0 0 60px rgba(247,198,74,.8)", animation: "newTurnSlide 1.8s ease-out forwards" }}>
            YOUR TURN
          </div>
        </div>
      )}

      {/* Urgent timer alert */}
      {timerUrgent && turnSecondsLeft > 0 && (
        <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 75, padding: "8px 20px", borderRadius: 20, background: "rgba(120,0,0,.9)", border: "2px solid #ff3333", color: "#ff8888", font: `900 13px var(--font-cinzel,'Cinzel',serif)`, animation: "urgentPulse 0.5s ease-in-out infinite", boxShadow: "0 0 24px rgba(255,50,50,.5)", whiteSpace: "nowrap" }}>
          ⚠️ TURN ENDS IN {turnSecondsLeft}s
        </div>
      )}

      {/* Toast notifications */}
      <div style={{ position: "absolute", top: 70, right: 16, zIndex: 72, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(8,11,20,.92)", border: `1px solid ${t.color}44`, color: t.color, font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, animation: "toastIn 0.2s ease-out", boxShadow: `0 2px 12px rgba(0,0,0,.5)` }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Surrender confirm dialog */}
      {showSurrenderConfirm && (
        <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(4,6,12,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ padding: "32px 40px", borderRadius: 16, background: "#0d1118", border: "1px solid rgba(231,199,104,.2)", boxShadow: "0 20px 60px rgba(0,0,0,.7)", textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ font: `800 20px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>SURRENDER?</div>
            <div style={{ font: `500 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6" }}>You will forfeit this match.</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={handleSurrender} style={{ cursor: "pointer", padding: "10px 28px", borderRadius: 10, border: "1px solid #ff5555", background: "rgba(180,30,30,.3)", color: "#ff8888", font: `700 14px var(--font-cinzel,'Cinzel',serif)` }}>SURRENDER</button>
              <button onClick={() => setShowSurrenderConfirm(false)} style={{ cursor: "pointer", padding: "10px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#c4ccd8", font: `700 14px var(--font-cinzel,'Cinzel',serif)` }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseEndTurn {
          0%,100% { box-shadow: 0 0 20px rgba(231,199,104,.3),inset 0 1px 0 rgba(255,240,190,.25); }
          50% { box-shadow: 0 0 32px rgba(231,199,104,.55),inset 0 1px 0 rgba(255,240,190,.45); }
        }
        @keyframes urgentPulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        @keyframes cardZoomIn { from { transform:scale(0.82) translateY(12px); opacity:0; } to { transform:scale(1) translateY(0); opacity:1; } }
        @keyframes newTurnSlide { 0% { opacity:0; transform:scale(0.7) translateY(20px); } 20% { opacity:1; transform:scale(1.05) translateY(0); } 70% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(1.1) translateY(-16px); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes victoryPop { from { transform:scale(0.6); opacity:0; } to { transform:scale(1); opacity:1; } }
      `}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function BoardSlot({ children, highlighted, glowing, dimmed, clickable, onClick }: {
  children?: React.ReactNode;
  highlighted?: boolean;
  glowing?: boolean;
  dimmed?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 96, height: 116, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: highlighted
          ? (glowing ? "2px solid rgba(255,200,60,.7)" : "1.5px dashed rgba(64,224,128,.5)")
          : "1.5px dashed rgba(255,255,255,.07)",
        background: highlighted
          ? (glowing ? "rgba(255,200,60,.06)" : "rgba(64,224,128,.04)")
          : "rgba(255,255,255,.01)",
        opacity: dimmed ? 0.45 : 1,
        cursor: clickable ? "pointer" : "default",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function DeckPile({ count }: { count: number }) {
  return (
    <div style={{ width: 44, height: 60, borderRadius: 7, background: "linear-gradient(150deg,#2a3142,#12161f)", border: "1.5px solid rgba(231,199,104,.25)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, boxShadow: "2px 2px 0 rgba(0,0,0,.4)", flexShrink: 0 }}>
      <span style={{ font: `800 15px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c9b48a" }}>{count}</span>
      <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", letterSpacing: 1 }}>DECK</span>
    </div>
  );
}

function HandCountDisplay({ count, faction }: { count: number; faction: string }) {
  const fc = FAC[faction] ?? "#2a3142";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
        <div key={i} style={{ width: 26, height: 36, borderRadius: 5, background: `linear-gradient(150deg,color-mix(in srgb,${fc} 30%,#1e2430),#0e1218)`, border: `1px solid color-mix(in srgb,${fc} 25%,rgba(255,255,255,.08))`, transform: `rotate(${(i - Math.floor(Math.min(count, 8) / 2)) * 5}deg)` }} />
      ))}
      {count > 8 && <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ffaad8", marginLeft: 2 }}>+{count - 8}</span>}
    </div>
  );
}

function ManaDisplay({ mana, maxMana, compact }: { mana: number; maxMana: number; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <span style={{ font: `800 ${compact ? 11 : 13}px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>{mana}/{maxMana}</span>
      <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478" }}>GAS</span>
    </div>
  );
}

function ManaCrystals({ available, total }: { available: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const on = i < available;
        const exists = i < total;
        return (
          <div key={i} style={{ width: 14, height: 14, transform: "rotate(45deg)", borderRadius: 2, background: on ? "linear-gradient(135deg,#bfe4ff,#2f8fe0)" : exists ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)", border: exists ? (on ? "1px solid #7cc4ff" : "1px solid rgba(255,255,255,.1)") : "1px solid rgba(255,255,255,.03)", boxShadow: on ? "0 0 6px rgba(74,160,230,.55)" : "none", transition: "all 0.2s" }} />
        );
      })}
      <span style={{ marginLeft: 6, font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>
        {available}<span style={{ color: "#4a5478" }}>/{total}</span>
      </span>
    </div>
  );
}

function slotToCardData(slot: MinionSlot): CardData {
  return {
    id: slot.card.id,
    name: slot.card.name,
    cost: slot.card.cost,
    attack: slot.currentAttack,
    health: slot.currentHealth,
    type: slot.card.type,
    faction: slot.card.faction,
    rarity: slot.card.rarity,
    text: slot.card.text,
    tribe: slot.card.tribe,
    keywords: slot.card.keywords,
    set: slot.card.set,
    collectible: slot.card.collectible,
    craftable: slot.card.craftable,
    dust_value: slot.card.dust_value,
    craft_cost: slot.card.craft_cost,
  } as CardData;
}
