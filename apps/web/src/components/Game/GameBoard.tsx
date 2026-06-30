"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
type PhaseAction = "idle" | "select_play_target" | "select_attack_target";

interface Toast { id: string; text: string; color: string; }

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
  // Combat animations
  const [lungeId, setLungeId] = useState<string | null>(null);
  const [damageFlashIds, setDamageFlashIds] = useState<Set<string>>(new Set());
  // Draw animation: track newly added hand cards
  const [newCardIds, setNewCardIds] = useState<string[]>([]);
  const prevHandIds = useRef<string[]>([]);
  const prevMinionHp = useRef<Record<string, number>>({});

  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsMyTurn = useRef(false);

  // Turn timer + new-turn flash
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

  // Detect newly drawn cards for draw animation
  useEffect(() => {
    if (!gameState?.myState.hand) return;
    const currentIds = (gameState.myState.hand as (Card & { instanceId?: string })[])
      .map((c) => c.instanceId ?? "").filter(Boolean);
    const prevSet = new Set(prevHandIds.current);
    const freshIds = currentIds.filter((id) => !prevSet.has(id));
    if (freshIds.length > 0) {
      setNewCardIds(freshIds);
      setTimeout(() => setNewCardIds([]), 700);
    }
    prevHandIds.current = currentIds;
  }, [gameState?.myState.hand]);

  // Detect HP decreases for damage flash
  useEffect(() => {
    if (!gameState) return;
    const flashIds: string[] = [];
    const allSlots = [
      ...(gameState.myState.board as (MinionSlot | null)[]).filter((s): s is MinionSlot => s !== null),
      ...(gameState.opponentState.board as (MinionSlot | null)[]).filter((s): s is MinionSlot => s !== null),
    ];
    for (const slot of allSlots) {
      const prev = prevMinionHp.current[slot.instanceId];
      if (prev !== undefined && slot.currentHealth < prev) flashIds.push(slot.instanceId);
      prevMinionHp.current[slot.instanceId] = slot.currentHealth;
    }
    if (flashIds.length > 0) {
      setDamageFlashIds(new Set(flashIds));
      setTimeout(() => setDamageFlashIds(new Set()), 450);
    }
  }, [gameState]);

  // Toast notifications
  const addToast = useCallback((text: string, color: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { id, text, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400);
  }, []);

  useEffect(() => {
    if (!pendingAnimations?.length) return;
    for (const anim of pendingAnimations) {
      if (anim.type === "draw") {
        const d = anim.data as { overdraw?: boolean; fatigue?: number; playerId?: string };
        if (d.playerId === playerId) {
          if (d.fatigue) addToast(`💀 Fatigue! −${d.fatigue} HP`, "#ff5555");
          else if (d.overdraw) addToast("🔥 Overdraw — card burned", "#ff9944");
          else addToast("🎴 Drew a card", "#7cc4ff");
        }
      } else if (anim.type === "death") addToast("💀 Minion destroyed", "#ff8888");
      else if (anim.type === "heal") addToast("💚 Healed", "#66ee88");
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
    return <MulliganScreen hand={gameState.myState.hand as (Card & { instanceId: string })[]} isFirstPlayer={gameState.myState.playerId !== gameState.activePlayerId} />;
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

  function doAttack(attacker: string, defender: string) {
    sendAction({ type: "attack", attackerInstanceId: attacker, defenderInstanceId: defender });
    setLungeId(attacker);
    setTimeout(() => setLungeId(null), 520);
    selectAttacker(null); setPhase("idle");
  }

  function handleMinionClick(instanceId: string, isEnemy: boolean) {
    if (!canAct) return;
    if (phase === "select_attack_target") {
      if (validTargets.includes(instanceId)) doAttack(selectedAttackerId!, instanceId);
      else cancelTargeting();
      return;
    }
    if (phase === "select_play_target") {
      sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId!, targetInstanceId: instanceId });
      selectCard(null); setPhase("idle"); return;
    }
    if (!isEnemy) {
      const slot = myState.board.find((s): s is MinionSlot => s !== null && s.instanceId === instanceId);
      if (slot && !slot.hasAttacked && (!slot.summoningSickness || slot.hasCharge)) {
        selectAttacker(instanceId); setPhase("select_attack_target");
      }
    }
  }

  function handleHeroClick(isEnemy: boolean) {
    if (!canAct) return;
    if (isEnemy) {
      if (phase === "select_attack_target" && selectedAttackerId) {
        const heroId = "hero_" + opponentState.playerId;
        if (validTargets.includes(heroId)) doAttack(selectedAttackerId, heroId);
        else cancelTargeting();
      } else if (phase === "select_play_target" && selectedCardInstanceId) {
        sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, targetInstanceId: "hero_" + opponentState.playerId });
        selectCard(null); setPhase("idle");
      } else if (phase !== "idle") {
        cancelTargeting();
      }
    } else {
      if (phase !== "idle") {
        cancelTargeting();
        return;
      }
      if (myState.hasWeapon && !myState.heroHasAttacked && canAct) {
        selectAttacker("hero_" + playerId); setPhase("select_attack_target");
      }
    }
  }

  function handleEndTurn() {
    if (!canAct) return;
    sendAction({ type: "end_turn" });
    selectCard(null); selectAttacker(null); setPhase("idle");
  }

  function cancelTargeting() {
    selectCard(null);
    selectAttacker(null);
    setPhase("idle");
    setActionError(null);
  }

  function handleBoardBackgroundClick(e: React.MouseEvent) {
    if (phase === "idle") return;
    if (e.target !== e.currentTarget) return;
    cancelTargeting();
  }

  const manaAvailable = myState.mana + myState.tempMana;
  const turnTimeRatio = turnSecondsLeft / TURN_SECONDS;
  const turnBarColor =
    !isMyTurn ? "rgba(255,255,255,.12)"
    : turnTimeRatio > 0.5 ? "#2ee88a"
    : turnTimeRatio > 0.25 ? "#f0c040"
    : "#ff4444";

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%",
      display: "flex", flexDirection: "column", overflow: "hidden",
      background: "radial-gradient(120% 80% at 50% 50%,#16202f 0%,#0a0e16 70%,#070a10 100%)",
      fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: .35, backgroundImage: "repeating-linear-gradient(90deg,transparent 0 39px,rgba(255,255,255,.015) 39px 40px)", pointerEvents: "none" }} />

      {/* ══════════════ OPPONENT ZONE ══════════════ */}
      <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Opponent left info */}
        <div style={{ width: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "8px 4px 4px", gap: 8 }}>
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
        </div>

        {/* Opponent board — center, slots at bottom */}
        <div
          onClick={handleBoardBackgroundClick}
          style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: "0 8px 4px", cursor: phase !== "idle" ? "pointer" : "default" }}
        >
          {Array.from({ length: 7 }).map((_, i) => {
            const slot = opponentState.board[i];
            const isValidTarget = phase === "select_attack_target" && slot ? validTargets.includes(slot.instanceId) : false;
            return (
              <BoardSlot
                key={i}
                highlighted={isValidTarget}
                dimmed={phase === "select_attack_target" && !isValidTarget && !!slot}
                onClick={!slot && phase !== "idle" ? cancelTargeting : undefined}
              >
                {slot && (
                  <MinionCard
                    slot={slot} isEnemy isValidTarget={isValidTarget}
                    isDamageFlash={damageFlashIds.has(slot.instanceId)}
                    onClick={() => handleMinionClick(slot.instanceId, true)}
                    onHover={(h) => setZoomedCard(h ? slotToCardData(slot) : null)}
                  />
                )}
              </BoardSlot>
            );
          })}
        </div>

        {/* Opponent right info */}
        <div style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "8px 4px 4px", gap: 8 }}>
          <DeckPile count={opponentState.deckCount} />
          <HandCountDisplay count={opponentState.handCount} faction={opponentState.heroFaction} />
          <ManaDisplay mana={opponentState.mana} maxMana={opponentState.maxMana} />
        </div>
      </div>

      {/* ══════════════ CENTER BAR ══════════════ */}
      <div style={{ flex: "0 0 50px", position: "relative", display: "flex", alignItems: "center" }}>
        {/* Turn timer bar — drains left → right */}
        <div style={{
          position: "absolute", left: 140, right: 140, top: "50%", transform: "translateY(-50%)",
          height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.08)", overflow: "hidden", pointerEvents: "none",
        }}>
          <div style={{
            height: "100%",
            width: isMyTurn ? `${turnTimeRatio * 100}%` : "0%",
            borderRadius: 3,
            background: turnBarColor,
            boxShadow: isMyTurn ? `0 0 10px ${turnBarColor}88` : "none",
            transition: "width 1s linear, background 0.4s ease, box-shadow 0.4s ease",
          }} />
        </div>

        {/* Turn badge */}
        <div style={{ position: "absolute", left: 16, zIndex: 10, padding: "6px 14px", borderRadius: 9, background: isMyTurn ? "rgba(25,224,138,.1)" : "rgba(255,255,255,.04)", border: `1px solid ${isMyTurn ? "rgba(25,224,138,.35)" : "rgba(255,255,255,.1)"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <span style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: isMyTurn ? "#7fe8bd" : "#c4ccd8" }}>{isMyTurn ? "YOUR TURN" : "ENEMY TURN"}</span>
          {isMyTurn && <span style={{ font: `900 13px var(--font-mono,'JetBrains Mono',monospace)`, color: timerUrgent ? "#ff4444" : "#7fe8bd", animation: timerUrgent ? "urgentPulse 0.5s ease-in-out infinite" : "none" }}>{turnSecondsLeft}s</span>}
        </div>

        {/* Phase instruction */}
        {phase !== "idle" && (
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 20, padding: "6px 16px", borderRadius: 20, background: "rgba(60,50,0,.95)", border: "1px solid #e0c040", color: "#ffe060", font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", whiteSpace: "nowrap", boxShadow: "0 0 16px rgba(224,192,64,.3)" }}>
            {phase === "select_play_target" && "→ SELECT TARGET FOR SPELL"}
            {phase === "select_attack_target" && "→ SELECT ATTACK TARGET"}
          </div>
        )}

        {/* Right controls */}
        <div style={{ position: "absolute", right: 16, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowSurrenderConfirm(true)} title="Surrender" style={{ cursor: "pointer", width: 32, height: 32, borderRadius: 7, background: "rgba(100,20,20,.7)", border: "1px solid rgba(255,80,80,.3)", color: "#ff8888", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>🏳</button>
          <button onClick={() => { window.location.href = "/"; }} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: 7, background: "rgba(8,11,18,.7)", border: "1px solid rgba(255,255,255,.12)", color: "#c4ccd8", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>⚙</button>
          {phase !== "idle" ? (
            <button onClick={cancelTargeting} style={{ cursor: "pointer", padding: "7px 16px", borderRadius: 9, border: "2px solid rgba(255,140,60,.6)", background: "rgba(255,90,30,.08)", color: "#ffaa66", font: `800 13px var(--font-cinzel,'Cinzel',serif)` }}>CANCEL</button>
          ) : (
            <button onClick={handleEndTurn} disabled={!canAct} style={{ cursor: canAct ? "pointer" : "not-allowed", padding: "8px 20px", borderRadius: 9, border: `2px solid ${canAct ? "#e0b13a" : "rgba(255,255,255,.1)"}`, background: canAct ? "linear-gradient(180deg,#3a4150,#1c2230)" : "rgba(20,22,30,.7)", boxShadow: canAct ? "0 0 18px rgba(231,199,104,.3),inset 0 1px 0 rgba(255,240,190,.25)" : "none", color: canAct ? "#f3e8cc" : "#4a5060", font: `800 14px var(--font-cinzel,'Cinzel',serif)`, animation: canAct ? "pulseEndTurn 2s ease-in-out infinite" : "none" }}>
              END TURN
            </button>
          )}
        </div>
      </div>

      {/* ══════════════ PLAYER ZONE ══════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Player left: Hero info — never covered by hand */}
        <div style={{ width: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 4px 8px", gap: 8, flexShrink: 0 }}>
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
          {myState.hasWeapon && (
            <div style={{ font: `700 11px var(--font-cinzel,'Cinzel',serif)`, color: "#e8d090", padding: "3px 8px", borderRadius: 6, background: "rgba(231,199,104,.1)", border: "1px solid rgba(231,199,104,.2)" }}>
              ⚔️ {myState.weaponAttack}/{myState.weaponDurability}
            </div>
          )}
        </div>

        {/* Player center: board + hand */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "visible" }}>

          {/* Player board — slots at top of center column */}
          <div
            onClick={handleBoardBackgroundClick}
            style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 8, padding: "6px 0 0", cursor: phase !== "idle" ? "pointer" : "default" }}
          >
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
                    if (phase === "select_attack_target") {
                      cancelTargeting();
                      return;
                    }
                    if (!slot && phase === "select_play_target" && selectedCardInstanceId) {
                      sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, boardPosition: i });
                      selectCard(null); setPhase("idle");
                    } else if (!slot && phase === "select_play_target") {
                      cancelTargeting();
                    }
                  }}
                >
                  {slot && (
                    <MinionCard
                      slot={slot}
                      isSelected={isAttacking}
                      isAttacking={isAttacking}
                      isLunging={lungeId === slot.instanceId}
                      isDamageFlash={damageFlashIds.has(slot.instanceId)}
                      onClick={() => handleMinionClick(slot.instanceId, false)}
                      onHover={(h) => setZoomedCard(h ? slotToCardData(slot) : null)}
                    />
                  )}
                </BoardSlot>
              );
            })}
          </div>

          {/* Player hand — overflows upward into board space, NOT into hero side panel */}
          <div style={{ flex: "0 0 148px", position: "relative", overflow: "visible" }}>
            <HandZone
              hand={myState.hand as (Card & { instanceId?: string })[]}
              selectedInstanceId={selectedCardInstanceId}
              currentMana={manaAvailable}
              newCardIds={newCardIds}
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

        {/* Player right: mana + deck */}
        <div style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 4px 8px", gap: 12, flexShrink: 0 }}>
          <ManaCrystals available={manaAvailable} total={myState.maxMana} />
          <DeckPile count={myState.deckCount} />
        </div>
      </div>

      {/* ══════════════ OVERLAYS ══════════════ */}

      {/* Card zoom — centered, full card visible */}
      {zoomedCard && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", background: "rgba(4,6,12,.55)", backdropFilter: "blur(4px)" }}>
          <div style={{ animation: "cardZoomIn 0.18s ease-out", filter: "drop-shadow(0 0 40px rgba(0,0,0,.9))" }}>
            <CardComponent card={zoomedCard} size="lg" glowing />
          </div>
        </div>
      )}

      {/* Error banner */}
      {lastActionError && (
        <div onClick={() => setActionError(null)} style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 80, padding: "8px 18px", borderRadius: 10, background: "rgba(100,0,0,.95)", border: "1px solid #ff3333", color: "#ff8888", cursor: "pointer", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, whiteSpace: "nowrap" }}>
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
        <div style={{ position: "absolute", top: 56, left: "50%", transform: "translateX(-50%)", zIndex: 75, padding: "7px 18px", borderRadius: 20, background: "rgba(120,0,0,.9)", border: "2px solid #ff3333", color: "#ff8888", font: `900 13px var(--font-cinzel,'Cinzel',serif)`, animation: "urgentPulse 0.5s ease-in-out infinite", boxShadow: "0 0 24px rgba(255,50,50,.5)", whiteSpace: "nowrap" }}>
          ⚠️ TURN ENDS IN {turnSecondsLeft}s
        </div>
      )}

      {/* Toast log */}
      <div style={{ position: "absolute", top: 66, right: 14, zIndex: 72, display: "flex", flexDirection: "column", gap: 5, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "5px 12px", borderRadius: 7, background: "rgba(8,11,20,.93)", border: `1px solid ${t.color}44`, color: t.color, font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, animation: "toastIn 0.2s ease-out", boxShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Surrender confirm */}
      {showSurrenderConfirm && (
        <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(4,6,12,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ padding: "32px 40px", borderRadius: 16, background: "#0d1118", border: "1px solid rgba(231,199,104,.2)", boxShadow: "0 20px 60px rgba(0,0,0,.7)", textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ font: `800 20px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>SURRENDER?</div>
            <div style={{ font: `500 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6" }}>You will forfeit this match.</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => { sendAction({ type: "surrender" }); setShowSurrenderConfirm(false); }} style={{ cursor: "pointer", padding: "10px 28px", borderRadius: 10, border: "1px solid #ff5555", background: "rgba(180,30,30,.3)", color: "#ff8888", font: `700 14px var(--font-cinzel,'Cinzel',serif)` }}>SURRENDER</button>
              <button onClick={() => setShowSurrenderConfirm(false)} style={{ cursor: "pointer", padding: "10px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#c4ccd8", font: `700 14px var(--font-cinzel,'Cinzel',serif)` }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseEndTurn { 0%,100%{box-shadow:0 0 18px rgba(231,199,104,.3),inset 0 1px 0 rgba(255,240,190,.25);}50%{box-shadow:0 0 30px rgba(231,199,104,.55),inset 0 1px 0 rgba(255,240,190,.45);} }
        @keyframes urgentPulse { 0%,100%{opacity:1;}50%{opacity:0.55;} }
        @keyframes cardZoomIn { from{transform:scale(0.82) translateY(12px);opacity:0;}to{transform:scale(1) translateY(0);opacity:1;} }
        @keyframes newTurnSlide { 0%{opacity:0;transform:scale(0.7) translateY(20px);}20%{opacity:1;transform:scale(1.05) translateY(0);}70%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(1.08) translateY(-16px);} }
        @keyframes toastIn { from{opacity:0;transform:translateX(10px);}to{opacity:1;transform:translateX(0);} }
        @keyframes victoryPop { from{transform:scale(0.6);opacity:0;}to{transform:scale(1);opacity:1;} }
        @keyframes minionLunge { 0%{transform:translateY(0) scale(1);}30%{transform:translateY(-44px) scale(1.08);}65%{transform:translateY(-44px) scale(1.06);}100%{transform:translateY(0) scale(1);} }
        @keyframes damageFlash { 0%,100%{filter:none;}40%{filter:brightness(2.5) saturate(0.2) sepia(1) hue-rotate(-20deg);} }
        @keyframes drawCardIn { 0%{opacity:0;transform:translateX(80px) translateY(-20px) scale(0.6) rotate(12deg);}60%{opacity:1;transform:translateX(-6px) translateY(4px) scale(1.04) rotate(-1deg);}100%{opacity:1;transform:translateX(0) translateY(0) scale(1) rotate(0deg);} }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function BoardSlot({ children, highlighted, glowing, dimmed, clickable, onClick }: {
  children?: React.ReactNode;
  highlighted?: boolean; glowing?: boolean; dimmed?: boolean; clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ width: 96, height: 116, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: highlighted ? (glowing ? "2px solid rgba(255,200,60,.7)" : "1.5px dashed rgba(64,224,128,.5)") : "1.5px dashed rgba(255,255,255,.07)", background: highlighted ? (glowing ? "rgba(255,200,60,.06)" : "rgba(64,224,128,.04)") : "rgba(255,255,255,.01)", opacity: dimmed ? 0.45 : 1, cursor: clickable ? "pointer" : "default", transition: "all 0.15s", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function DeckPile({ count }: { count: number }) {
  return (
    <div style={{ width: 44, height: 58, borderRadius: 7, background: "linear-gradient(150deg,#2a3142,#12161f)", border: "1.5px solid rgba(231,199,104,.25)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, boxShadow: "2px 2px 0 rgba(0,0,0,.4)", flexShrink: 0 }}>
      <span style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#c9b48a" }}>{count}</span>
      <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", letterSpacing: 1 }}>DECK</span>
    </div>
  );
}

function HandCountDisplay({ count, faction }: { count: number; faction: string }) {
  const fc = FAC[faction] ?? "#2a3142";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", maxWidth: 90 }}>
        {Array.from({ length: Math.min(count, 7) }).map((_, i) => (
          <div key={i} style={{ width: 22, height: 30, borderRadius: 4, background: `linear-gradient(150deg,color-mix(in srgb,${fc} 30%,#1e2430),#0e1218)`, border: `1px solid color-mix(in srgb,${fc} 20%,rgba(255,255,255,.08))`, transform: `rotate(${(i - Math.floor(Math.min(count, 7) / 2)) * 4}deg)` }} />
        ))}
      </div>
      {count > 0 && <span style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>{count} cards</span>}
    </div>
  );
}

function ManaDisplay({ mana, maxMana }: { mana: number; maxMana: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>{mana}/{maxMana}</span>
      <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478" }}>GAS</span>
    </div>
  );
}

function ManaCrystals({ available, total }: { available: number; total: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 14px)", gap: 4 }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const on = i < available;
          const exists = i < total;
          return (
            <div key={i} style={{ width: 14, height: 14, transform: "rotate(45deg)", borderRadius: 2, background: on ? "linear-gradient(135deg,#bfe4ff,#2f8fe0)" : exists ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.02)", border: exists ? (on ? "1px solid #7cc4ff" : "1px solid rgba(255,255,255,.1)") : "1px solid rgba(255,255,255,.03)", boxShadow: on ? "0 0 5px rgba(74,160,230,.55)" : "none", transition: "all 0.2s" }} />
          );
        })}
      </div>
      <span style={{ font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>{available}<span style={{ color: "#4a5478" }}>/{total}</span></span>
    </div>
  );
}

function slotToCardData(slot: MinionSlot): CardData {
  return { ...slot.card, attack: slot.currentAttack, health: slot.currentHealth } as CardData;
}
