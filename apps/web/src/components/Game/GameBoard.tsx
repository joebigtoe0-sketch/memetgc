"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { sendAction } from "@/hooks/useSocket";
import MinionCard from "../Board/MinionCard";
import HeroZone from "../Board/HeroZone";
import HandZone from "../Board/HandZone";
import MulliganScreen from "./MulliganScreen";
import CardComponent from "../Card/CardComponent";
import { getPlayCardTargets } from "@memetgc/game-engine";
import { preloadCardArt, preloadAllCardArt, preloadFactionArt } from "@/lib/preloadArt";
import { getMatchBoardBackground, getDefaultBoardBackground } from "@/lib/boards";
import BoardBackground from "./BoardBackground";
import { CARD_BACK_DEFAULT, CARD_BACK_RADIUS } from "@/lib/cardBacks";
import GameIcon from "@/components/UI/GameIcon";
import type { MinionSlot, Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

const TURN_SECONDS = 30;
type PhaseAction = "idle" | "select_play_target" | "select_attack_target";

interface Toast { id: string; text: string; color: string; }
interface DamageFloat { id: string; entityKey: string; amount: number; isHeal: boolean; }
interface LogEntry { id: string; text: string; turn: number; }

export default function GameBoard() {
  const { gameState, isMyTurn, selectedCardInstanceId, selectedAttackerId, lastActionError, playerId, pendingAnimations } = useGameStore();
  const { selectCard, selectAttacker, setActionError, clearAnimations } = useGameStore();
  const [phase, setPhase] = useState<PhaseAction>("idle");
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(TURN_SECONDS);
  const [showNewTurn, setShowNewTurn] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState<"mine" | "opponent" | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  // Combat animations
  const [lungeId, setLungeId] = useState<string | null>(null);
  const [damageFlashIds, setDamageFlashIds] = useState<Set<string>>(new Set());
  const [damageFloats, setDamageFloats] = useState<DamageFloat[]>([]);
  const [boardBg, setBoardBg] = useState<string>(getDefaultBoardBackground);
  // Draw animation
  const [newCardIds, setNewCardIds] = useState<string[]>([]);
  const prevHandIds = useRef<string[]>([]);
  const prevMinionHp = useRef<Record<string, number>>({});
  const prevHeroHp = useRef<Record<string, number>>({});
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsMyTurn = useRef(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

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

  // Scroll log to bottom when new entries added
  useEffect(() => {
    if (showLog) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries, showLog]);

  // Preload the whole art set once so cards never visibly re-fetch mid-match
  useEffect(() => {
    preloadFactionArt();
    void preloadAllCardArt();
    void getMatchBoardBackground().then(setBoardBg);
  }, []);

  // Preload art for every card currently visible (hand + both boards + graveyards)
  useEffect(() => {
    if (!gameState) return;
    const ids: Array<string | undefined> = [];
    for (const c of gameState.myState.hand) ids.push((c as Card).id);
    for (const s of gameState.myState.board) if (s) ids.push(s.card.id);
    for (const s of gameState.opponentState.board) if (s) ids.push(s.card.id);
    for (const c of gameState.myState.burnPile ?? []) ids.push(c.id);
    for (const c of gameState.opponentState.burnPile ?? []) ids.push(c.id);
    preloadCardArt(ids);
  }, [gameState]);

  // Detect newly drawn cards
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

  const addFloat = useCallback((entityKey: string, amount: number, isHeal: boolean) => {
    const id = `${Date.now()}-${Math.random()}`;
    setDamageFloats((prev) => [...prev, { id, entityKey, amount, isHeal }]);
    setTimeout(() => setDamageFloats((prev) => prev.filter((f) => f.id !== id)), 900);
  }, []);

  const addLog = useCallback((text: string, turn: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    setLogEntries((prev) => [...prev.slice(-99), { id, text, turn }]);
  }, []);

  // Detect HP decreases for damage flash + floaters
  useEffect(() => {
    if (!gameState) return;
    const flashIds: string[] = [];

    // Minions
    const allSlots = [
      ...(gameState.myState.board as (MinionSlot | null)[]).filter((s): s is MinionSlot => s !== null).map((s) => ({ slot: s, side: "my" })),
      ...(gameState.opponentState.board as (MinionSlot | null)[]).filter((s): s is MinionSlot => s !== null).map((s) => ({ slot: s, side: "opp" })),
    ];
    for (const { slot, side } of allSlots) {
      const prev = prevMinionHp.current[slot.instanceId];
      const board = side === "my" ? gameState.myState.board : gameState.opponentState.board;
      const idx = board.findIndex((s) => s !== null && (s as MinionSlot).instanceId === slot.instanceId);
      if (prev !== undefined) {
        const delta = prev - slot.currentHealth;
        if (delta > 0) {
          flashIds.push(slot.instanceId);
          addFloat(`${side}_slot_${idx}`, delta, false);
          addLog(`${slot.card.name} took ${delta} damage (${slot.currentHealth} HP left)`, gameState.turnNumber);
        } else if (delta < 0) {
          addFloat(`${side}_slot_${idx}`, Math.abs(delta), true);
        }
      }
      prevMinionHp.current[slot.instanceId] = slot.currentHealth;
    }

    // Heroes
    const myHp = gameState.myState.hp;
    const oppHp = gameState.opponentState.hp;
    const prevMyHp = prevHeroHp.current["my"];
    const prevOppHp = prevHeroHp.current["opp"];
    if (prevMyHp !== undefined && myHp < prevMyHp) {
      flashIds.push("hero_my");
      addFloat("my_hero", prevMyHp - myHp, false);
      addLog(`${gameState.myState.heroName} took ${prevMyHp - myHp} damage`, gameState.turnNumber);
    }
    if (prevOppHp !== undefined && oppHp < prevOppHp) {
      flashIds.push("hero_opp");
      addFloat("opp_hero", prevOppHp - oppHp, false);
      addLog(`${gameState.opponentState.heroName} took ${prevOppHp - oppHp} damage`, gameState.turnNumber);
    }
    prevHeroHp.current["my"] = myHp;
    prevHeroHp.current["opp"] = oppHp;

    if (flashIds.length > 0) {
      setDamageFlashIds(new Set(flashIds));
      setTimeout(() => setDamageFlashIds(new Set()), 450);
    }
  }, [gameState, addFloat, addLog]);

  // Toast + log from animations
  const addToast = useCallback((text: string, color: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { id, text, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400);
  }, []);

  useEffect(() => {
    if (!pendingAnimations?.length) return;
    for (const anim of pendingAnimations) {
      if (anim.type === "draw") {
        const d = anim.data as { overdraw?: boolean; fatigue?: number; playerId?: string; memeBonus?: string };
        if (d.memeBonus === "extra_draw") {
          // Meme faction coin-flip bonus — explains the extra card so it doesn't look like a bug
          if (d.playerId === playerId) { addToast("🎲 Meme Bonus: +1 card!", "#ff5fae"); addLog("Meme bonus: drew an extra card", gameState?.turnNumber ?? 0); }
          else addLog("Opponent's Meme bonus: extra card", gameState?.turnNumber ?? 0);
        } else if (d.playerId === playerId) {
          if (d.fatigue) { addToast(`💀 Fatigue! −${d.fatigue} HP`, "#ff5555"); addLog(`Fatigue: ${d.fatigue} damage`, gameState?.turnNumber ?? 0); }
          else if (d.overdraw) { addToast("🔥 Overdraw — card burned", "#ff9944"); addLog("Card burned (overdraw)", gameState?.turnNumber ?? 0); }
          else addLog("Drew a card", gameState?.turnNumber ?? 0);
        } else addLog("Opponent drew a card", gameState?.turnNumber ?? 0);
      } else if (anim.type === "spell_cast") {
        const d = anim.data as { memeBonus?: string; playerId?: string };
        if (d.memeBonus === "free_hero_power") {
          if (d.playerId === playerId) { addToast("🎲 Meme Bonus: free Hero Power!", "#ff5fae"); addLog("Meme bonus: free hero power this turn", gameState?.turnNumber ?? 0); }
          else addLog("Opponent's Meme bonus: free hero power", gameState?.turnNumber ?? 0);
        }
      } else if (anim.type === "attack") {
        const d = anim.data as { attackerId?: string };
        if (d.attackerId && !d.attackerId.startsWith("hero_")) {
          const isMyMinion = gameState?.myState.board.some((s) => s?.instanceId === d.attackerId);
          if (!isMyMinion) {
            setLungeId(d.attackerId);
            setTimeout(() => setLungeId(null), 520);
          }
        }
      } else if (anim.type === "death") {
        const d = anim.data as { cardId?: string };
        addToast("💀 Minion destroyed", "#ff8888");
        addLog(`Minion destroyed (${d.cardId ?? "?"})`, gameState?.turnNumber ?? 0);
      } else if (anim.type === "heal") {
        addToast("💚 Healed", "#66ee88");
      } else if (anim.type === "play_card") {
        const d = anim.data as { cardId?: string };
        addLog(`Card played: ${d.cardId ?? "?"}`, gameState?.turnNumber ?? 0);
      } else if (anim.type === "game_over") {
        const d = anim.data as { winner?: string };
        addLog(`Game over — winner: ${d.winner}`, gameState?.turnNumber ?? 0);
      }
    }
    clearAnimations();
  }, [pendingAnimations, playerId, addToast, addLog, clearAnimations, gameState?.turnNumber]);

  if (!gameState) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6a7488" }}>
        <div style={{ textAlign: "center" }}>
          <GameIcon name="battle" size={40} style={{ margin: "0 auto 12px" }} />
          <p style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Connecting to game…</p>
        </div>
      </div>
    );
  }

  if (gameState.status === "mulligan") {
    return <MulliganScreen hand={gameState.myState.hand as (Card & { instanceId: string })[]} isFirstPlayer={gameState.myState.playerId !== gameState.activePlayerId} boardBg={boardBg} />;
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

  function getValidPlayTargets(): string[] {
    if (phase !== "select_play_target" || !selectedCardInstanceId) return [];
    const card = myState.hand.find(
      (c) => (c as Card & { instanceId?: string }).instanceId === selectedCardInstanceId
    ) as Card | undefined;
    if (!card) return [];
    return getPlayCardTargets(
      card,
      myState.board,
      opponentState.board,
      "hero_" + playerId,
      "hero_" + opponentState.playerId
    ).validIds;
  }
  const validPlayTargets = getValidPlayTargets();

  function doAttack(attacker: string, defender: string) {
    sendAction({ type: "attack", attackerInstanceId: attacker, defenderInstanceId: defender });
    setLungeId(attacker);
    setTimeout(() => setLungeId(null), 520);
    selectAttacker(null); setPhase("idle");
  }

  function cancelTargeting() {
    selectCard(null); selectAttacker(null); setPhase("idle"); setActionError(null);
  }

  function handleMinionClick(instanceId: string, isEnemy: boolean) {
    if (!canAct) return;
    if (phase === "select_attack_target") {
      if (validTargets.includes(instanceId)) doAttack(selectedAttackerId!, instanceId);
      else cancelTargeting();
      return;
    }
    if (phase === "select_play_target") {
      if (validPlayTargets.includes(instanceId)) {
        sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId!, targetInstanceId: instanceId });
        selectCard(null); setPhase("idle");
      } else {
        cancelTargeting();
      }
      return;
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
    const heroId = "hero_" + (isEnemy ? opponentState.playerId : playerId);
    if (phase === "select_attack_target" && selectedAttackerId) {
      if (isEnemy && validTargets.includes(heroId)) doAttack(selectedAttackerId, heroId);
      else cancelTargeting();
      return;
    }
    if (phase === "select_play_target" && selectedCardInstanceId) {
      if (validPlayTargets.includes(heroId)) {
        sendAction({ type: "play_card", cardInstanceId: selectedCardInstanceId, targetInstanceId: heroId });
        selectCard(null); setPhase("idle");
      } else {
        cancelTargeting();
      }
      return;
    }
    if (phase !== "idle") { cancelTargeting(); return; }
    if (!isEnemy && myState.hasWeapon && !myState.heroHasAttacked) {
      selectAttacker("hero_" + playerId); setPhase("select_attack_target");
    }
  }

  function handleBoardBackgroundClick(e: React.MouseEvent) {
    if (phase === "idle") return;
    if (e.target !== e.currentTarget) return;
    cancelTargeting();
  }

  const manaAvailable = myState.mana + myState.tempMana;
  const turnTimeRatio = turnSecondsLeft / TURN_SECONDS;
  const turnBarColor = !isMyTurn ? "rgba(255,255,255,.12)" : turnTimeRatio > 0.5 ? "#2ee88a" : turnTimeRatio > 0.25 ? "#f0c040" : "#ff4444";

  const myFloats = damageFloats.filter((f) => f.entityKey.startsWith("my_"));
  const oppFloats = damageFloats.filter((f) => f.entityKey.startsWith("opp_"));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <BoardBackground url={boardBg} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* ══════════════ OPPONENT ZONE ══════════════ */}
      <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Opponent left: hero */}
        <div style={{ width: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "8px 4px 4px", gap: 8, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <HeroZone
              heroName={opponentState.heroName} faction={opponentState.heroFaction}
              hp={opponentState.hp} armor={opponentState.armor} isEnemy
              isValidTarget={(phase === "select_attack_target" && validTargets.includes("hero_" + opponentState.playerId)) || (phase === "select_play_target" && validPlayTargets.includes("hero_" + opponentState.playerId))}
              onHeroClick={() => handleHeroClick(true)}
              secretCount={opponentState.secretCount}
              hasWeapon={opponentState.hasWeapon} weaponAttack={opponentState.weaponAttack} weaponDurability={opponentState.weaponDurability}
            />
            {/* Hero damage floaters */}
            {oppFloats.filter((f) => f.entityKey === "opp_hero").map((f) => (
              <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} />
            ))}
          </div>
        </div>

        {/* Opponent center: face-down hand (top) + board (bottom) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Face-down opponent hand at top */}
          <div style={{ flex: "0 0 200px", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8px 0 0", overflow: "visible" }}>
            <FaceDownHand count={opponentState.handCount} />
          </div>

          {/* Opponent board — slots at bottom */}
          <div
            onClick={handleBoardBackgroundClick}
            style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: "0 8px 4px", cursor: phase !== "idle" ? "pointer" : "default", position: "relative" }}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const slot = opponentState.board[i];
              const isValidTarget = slot
                ? (phase === "select_attack_target" && validTargets.includes(slot.instanceId)) ||
                  (phase === "select_play_target" && validPlayTargets.includes(slot.instanceId))
                : false;
              return (
                <BoardSlot key={i} highlighted={isValidTarget} dimmed={(phase === "select_attack_target" || phase === "select_play_target") && !isValidTarget && !!slot}
                  onClick={!slot && phase !== "idle" ? cancelTargeting : undefined}>
                  <div style={{ position: "relative" }}>
                    {slot && (
                      <MinionCard slot={slot} isEnemy isValidTarget={isValidTarget}
                        isLunging={lungeId === slot.instanceId}
                        isDamageFlash={damageFlashIds.has(slot.instanceId)}
                        onClick={() => handleMinionClick(slot.instanceId, true)}
                        onHover={(h) => setZoomedCard(h ? slotToCardData(slot) : null)}
                      />
                    )}
                    {/* Slot damage floaters */}
                    {oppFloats.filter((f) => f.entityKey === `opp_slot_${i}`).map((f) => (
                      <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} />
                    ))}
                  </div>
                </BoardSlot>
              );
            })}
          </div>
        </div>

        {/* Opponent right: deck + grave + mana */}
        <div style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "8px 4px 4px", gap: 8, flexShrink: 0 }}>
          <ManaDisplay mana={opponentState.mana} maxMana={opponentState.maxMana} />
          <DeckPile count={opponentState.deckCount} />
          <GravePile count={opponentState.burnPile?.length ?? 0} onClick={() => setShowGraveyard("opponent")} />
        </div>
      </div>

      {/* ══════════════ CENTER BAR ══════════════ */}
      <div style={{ flex: "0 0 50px", position: "relative", display: "flex", alignItems: "center" }}>
        {/* Timer bar — fills from left, drains toward right (End Turn side) */}
        <div style={{ position: "absolute", left: 140, right: 140, top: "50%", transform: "translateY(-50%)", height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            height: "100%", width: isMyTurn ? `${turnTimeRatio * 100}%` : "0%",
            borderRadius: 3, background: turnBarColor,
            boxShadow: isMyTurn ? `0 0 10px ${turnBarColor}88` : "none",
            marginLeft: "auto",  /* right-aligned — drains toward right/End Turn */
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

        {/* Right controls — end turn only */}
        <div style={{ position: "absolute", right: 16, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
          {phase !== "idle" ? (
            <button onClick={cancelTargeting} style={{ cursor: "pointer", padding: "7px 16px", borderRadius: 9, border: "2px solid rgba(255,140,60,.6)", background: "rgba(255,90,30,.08)", color: "#ffaa66", font: `800 13px var(--font-cinzel,'Cinzel',serif)` }}>CANCEL</button>
          ) : (
            <button onClick={() => { if (!canAct) return; sendAction({ type: "end_turn" }); selectCard(null); selectAttacker(null); setPhase("idle"); }} disabled={!canAct} style={{ cursor: canAct ? "pointer" : "not-allowed", padding: "8px 20px", borderRadius: 9, border: `2px solid ${canAct ? "#e0b13a" : "rgba(255,255,255,.1)"}`, background: canAct ? "linear-gradient(180deg,#3a4150,#1c2230)" : "rgba(20,22,30,.7)", boxShadow: canAct ? "0 0 18px rgba(231,199,104,.3),inset 0 1px 0 rgba(255,240,190,.25)" : "none", color: canAct ? "#f3e8cc" : "#4a5060", font: `800 14px var(--font-cinzel,'Cinzel',serif)`, animation: canAct ? "pulseEndTurn 2s ease-in-out infinite" : "none" }}>
              END TURN
            </button>
          )}
        </div>
      </div>

      {/* ══════════════ PLAYER ZONE ══════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Player left: Hero */}
        <div style={{ width: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 4px 8px", gap: 8, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <HeroZone
              heroName={myState.heroName} faction={myState.heroFaction}
              hp={myState.hp} armor={myState.armor}
              heroPowerName={myState.heroPower.name} heroPowerUsed={myState.heroPowerUsed}
              hasWeapon={myState.hasWeapon} weaponAttack={myState.weaponAttack} weaponDurability={myState.weaponDurability}
              isValidTarget={phase === "select_play_target" && validPlayTargets.includes("hero_" + playerId)}
              onHeroClick={() => handleHeroClick(false)}
              onHeroPowerClick={() => { if (canAct && !myState.heroPowerUsed) sendAction({ type: "hero_power" }); }}
            />
            {/* Hero damage floaters */}
            {myFloats.filter((f) => f.entityKey === "my_hero").map((f) => (
              <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} />
            ))}
          </div>
          {myState.hasWeapon && (
            <div style={{ font: `700 11px var(--font-cinzel,'Cinzel',serif)`, color: "#e8d090", padding: "3px 8px", borderRadius: 6, background: "rgba(231,199,104,.1)", border: "1px solid rgba(231,199,104,.2)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <GameIcon name="battle" size={14} />
              {myState.weaponAttack}/{myState.weaponDurability}
            </div>
          )}
        </div>

        {/* Player center: board + hand */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "visible" }}>
          {/* Player board */}
          <div
            onClick={handleBoardBackgroundClick}
            style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 8, padding: "6px 0 0", cursor: phase !== "idle" ? "pointer" : "default" }}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const slot = myState.board[i];
              const isAttacking = slot?.instanceId === selectedAttackerId;
              const isPlayTarget = slot ? phase === "select_play_target" && validPlayTargets.includes(slot.instanceId) : false;
              return (
                <BoardSlot
                  key={i}
                  highlighted={isAttacking || isPlayTarget}
                  glowing={isAttacking}
                  dimmed={phase === "select_play_target" && !!slot && !isPlayTarget}
                  onClick={!slot && phase !== "idle" ? cancelTargeting : undefined}
                >
                  <div style={{ position: "relative" }}>
                    {slot && (
                      <MinionCard
                        slot={slot} isSelected={isAttacking} isAttacking={isAttacking} isValidTarget={isPlayTarget}
                        isLunging={lungeId === slot.instanceId}
                        isDamageFlash={damageFlashIds.has(slot.instanceId)}
                        onClick={() => handleMinionClick(slot.instanceId, false)}
                        onHover={(h) => setZoomedCard(h ? slotToCardData(slot) : null)}
                      />
                    )}
                    {myFloats.filter((f) => f.entityKey === `my_slot_${i}`).map((f) => (
                      <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} />
                    ))}
                  </div>
                </BoardSlot>
              );
            })}
          </div>

          {/* Player hand */}
          <div style={{ flex: "0 0 148px", position: "relative", overflow: "visible" }}>
            <HandZone
              hand={myState.hand as (Card & { instanceId?: string })[]}
              selectedInstanceId={selectedCardInstanceId}
              currentMana={manaAvailable}
              newCardIds={newCardIds}
              onCardClick={(id) => {
                if (!canAct) return;
                const card = myState.hand.find((c) => (c as Card & { instanceId?: string }).instanceId === id) as Card | undefined;
                if (!card) return;
                const t = getPlayCardTargets(card, myState.board, opponentState.board, "hero_" + playerId, "hero_" + opponentState.playerId);
                if (t.needsTarget && t.validIds.length > 0) {
                  selectCard(id); setPhase("select_play_target");
                } else {
                  sendAction({ type: "play_card", cardInstanceId: id });
                }
              }}
              onCardHover={(card) => setZoomedCard(card)}
            />
          </div>

          {/* Mana crystals — full row under hand */}
          <div style={{ flex: "0 0 48px", display: "flex", justifyContent: "center", alignItems: "center", paddingBottom: 8 }}>
            <ManaCrystals available={manaAvailable} total={myState.maxMana} />
          </div>
        </div>

        {/* Player right: deck + grave */}
        <div style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 4px 8px", gap: 10, flexShrink: 0 }}>
          <DeckPile count={myState.deckCount} />
          <GravePile count={myState.burnPile?.length ?? 0} onClick={() => setShowGraveyard("mine")} />
        </div>
      </div>

      </div>{/* end game-content layer */}

      {/* Settings gear — top right */}
      <button
        onClick={() => setShowSettings(true)}
        title="Settings"
        style={{
          position: "absolute", top: 12, right: 14, zIndex: 82,
          cursor: "pointer", width: 46, height: 46, borderRadius: 12,
          background: "rgba(8,11,18,.85)", border: "1px solid rgba(255,255,255,.14)",
          color: "#c4ccd8", fontSize: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,.45)",
        }}
      >⚙</button>

      {/* ══════════════ OVERLAYS ══════════════ */}

      {/* Card zoom */}
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

      {/* Urgent timer */}
      {timerUrgent && turnSecondsLeft > 0 && (
        <div style={{ position: "absolute", top: 56, left: "50%", transform: "translateX(-50%)", zIndex: 75, padding: "7px 18px", borderRadius: 20, background: "rgba(120,0,0,.9)", border: "2px solid #ff3333", color: "#ff8888", font: `900 13px var(--font-cinzel,'Cinzel',serif)`, animation: "urgentPulse 0.5s ease-in-out infinite", boxShadow: "0 0 24px rgba(255,50,50,.5)", whiteSpace: "nowrap" }}>
          ⚠️ TURN ENDS IN {turnSecondsLeft}s
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: "absolute", top: 66, right: showLog ? 224 : 68, zIndex: 72, display: "flex", flexDirection: "column", gap: 5, pointerEvents: "none", transition: "right 0.25s ease" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: "5px 12px", borderRadius: 7, background: "rgba(8,11,20,.93)", border: `1px solid ${t.color}44`, color: t.color, font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, animation: "toastIn 0.2s ease-out", boxShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Combat Log panel */}
      {showLog && (
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 210, zIndex: 71, background: "rgba(6,9,14,.94)", borderLeft: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px 6px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ font: `700 11px var(--font-cinzel,'Cinzel',serif)`, color: "#c9b48a", letterSpacing: "1px" }}>COMBAT LOG</span>
            <button onClick={() => setShowLog(false)} style={{ background: "none", border: "none", color: "#5a6478", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
            {logEntries.length === 0 && <span style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#3a4050" }}>No events yet…</span>}
            {logEntries.map((e) => (
              <div key={e.id} style={{ font: `500 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", lineHeight: 1.4, borderBottom: "1px solid rgba(255,255,255,.04)", paddingBottom: 3 }}>
                <span style={{ color: "#4a5580", marginRight: 4 }}>T{e.turn}</span>{e.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Graveyard modal */}
      {showGraveyard && (
        <div onClick={() => setShowGraveyard(null)} style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(4,6,12,.88)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxHeight: "70%", borderRadius: 16, background: "#0d1118", border: "1px solid rgba(231,199,104,.18)", boxShadow: "0 20px 60px rgba(0,0,0,.7)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ font: `700 14px var(--font-cinzel,'Cinzel',serif)`, color: "#c9b48a" }}>
                {showGraveyard === "mine" ? "MY GRAVEYARD" : "OPPONENT'S GRAVEYARD"}
              </span>
              <button onClick={() => setShowGraveyard(null)} style={{ background: "none", border: "none", color: "#5a6478", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(() => {
                const pile = showGraveyard === "mine" ? myState.burnPile : opponentState.burnPile ?? [];
                if (!pile || pile.length === 0) return <span style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#3a4050" }}>Empty graveyard</span>;
                return pile.map((card, i) => (
                  <div key={i} onMouseEnter={() => setZoomedCard(card as CardData)} onMouseLeave={() => setZoomedCard(null)}>
                    <CardComponent card={card as CardData} size="sm" />
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Settings popup */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{ position: "absolute", inset: 0, zIndex: 96, background: "rgba(4,6,12,.7)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "68px 16px 16px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 300, borderRadius: 14, background: "#0d1118", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 16px 48px rgba(0,0,0,.65)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>Settings</span>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "#5a6478", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "8px 0" }}>
              <SettingsRow
                label="Combat Log"
                description="Show event log panel on the right"
                action={
                  <ToggleSwitch checked={showLog} onChange={setShowLog} />
                }
              />
              <SettingsRow
                label="Surrender"
                description="Forfeit the current match"
                action={
                  <button
                    onClick={() => { setShowSettings(false); setShowSurrenderConfirm(true); }}
                    style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,80,80,.4)", background: "rgba(180,30,30,.25)", color: "#ff8888", font: `700 11px var(--font-cinzel,'Cinzel',serif)` }}
                  >Surrender</button>
                }
              />
              <SettingsRow
                label="Exit to Menu"
                description="Leave the match screen"
                action={
                  <button
                    onClick={() => { window.location.href = "/"; }}
                    style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "#c4ccd8", font: `700 11px var(--font-cinzel,'Cinzel',serif)` }}
                  >Exit</button>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Surrender confirm */}
      {showSurrenderConfirm && (
        <div style={{ position: "absolute", inset: 0, zIndex: 95, background: "rgba(4,6,12,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        @keyframes floatUp { 0%{opacity:0;transform:translateY(0) scale(0.8);}15%{opacity:1;transform:translateY(-4px) scale(1.1);}80%{opacity:1;transform:translateY(-26px) scale(1);}100%{opacity:0;transform:translateY(-34px) scale(0.9);} }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function FloatNumber({ amount, isHeal }: { amount: number; isHeal: boolean }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
      zIndex: 30, pointerEvents: "none",
      font: `900 18px var(--font-cinzel,'Cinzel',serif)`,
      color: isHeal ? "#55ee88" : "#ff4444",
      textShadow: `0 0 8px ${isHeal ? "#00ff88" : "#ff0000"}`,
      animation: "floatUp 0.85s ease-out forwards",
      whiteSpace: "nowrap",
    }}>
      {isHeal ? "+" : "−"}{amount}
    </div>
  );
}

// Matches player hand: CardComponent lg (260×380) at 0.50 scale
const OPP_HAND_W = 130;
const OPP_HAND_H = 190;
const OPP_HAND_SPREAD = 72;

function FaceDownHand({ count }: { count: number }) {
  const n = Math.min(count, 10);
  const mid = (n - 1) / 2;
  if (n === 0) return null;
  return (
    <div style={{ position: "relative", height: OPP_HAND_H + 16, width: Math.max(OPP_HAND_W + 40, n * OPP_HAND_SPREAD + OPP_HAND_W), flexShrink: 0 }}>
      {Array.from({ length: n }).map((_, i) => {
        const off = i - mid;
        const ang = off * 6;
        const x = off * OPP_HAND_SPREAD;
        const y = Math.abs(off) * Math.abs(off) * 4;
        return (
          <img
            key={i}
            src={CARD_BACK_DEFAULT}
            alt=""
            draggable={false}
            style={{
              position: "absolute", left: "50%",
              transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${ang}deg)`,
              transformOrigin: "top center",
              width: OPP_HAND_W, height: OPP_HAND_H,
              borderRadius: CARD_BACK_RADIUS, objectFit: "cover",
              boxShadow: "0 6px 18px rgba(0,0,0,.55)",
              zIndex: 10 + i,
            }}
          />
        );
      })}
    </div>
  );
}

function BoardSlot({ children, highlighted, glowing, dimmed, clickable, onClick }: {
  children?: React.ReactNode;
  highlighted?: boolean; glowing?: boolean; dimmed?: boolean; clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ width: 96, height: 116, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: highlighted ? (glowing ? "2px solid rgba(255,200,60,.85)" : "1.5px dashed rgba(64,224,128,.65)") : "1.5px dashed rgba(255,255,255,.22)", background: highlighted ? (glowing ? "rgba(255,200,60,.12)" : "rgba(64,224,128,.08)") : "rgba(0,0,0,.28)", boxShadow: highlighted ? undefined : "inset 0 0 12px rgba(0,0,0,.35)", opacity: dimmed ? 0.45 : 1, cursor: clickable ? "pointer" : "default", transition: "all 0.15s", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function DeckPile({ count }: { count: number }) {
  return (
    <div style={{ position: "relative", width: 44, height: 58, flexShrink: 0 }}>
      <img
        src={CARD_BACK_DEFAULT}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", borderRadius: CARD_BACK_RADIUS, objectFit: "cover", boxShadow: "2px 2px 0 rgba(0,0,0,.45), 0 4px 12px rgba(0,0,0,.35)" }}
      />
      <div style={{ position: "absolute", inset: 0, borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "rgba(0,0,0,.45)", border: "1.5px solid rgba(231,199,104,.35)" }}>
        <span style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc", textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>{count}</span>
        <span style={{ font: `600 7px var(--font-archivo,'Archivo',sans-serif)`, color: "#d8c79a", letterSpacing: 1 }}>DECK</span>
      </div>
    </div>
  );
}

function GravePile({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title="View graveyard" style={{ width: 44, height: 50, borderRadius: 7, background: "linear-gradient(150deg,#1e1410,#100c08)", border: "1.5px solid rgba(180,80,50,.35)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", flexShrink: 0, transition: "border-color 0.15s" }}>
      <span style={{ fontSize: 14 }}>💀</span>
      <span style={{ font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a6860" }}>{count}</span>
    </button>
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
  const size = 22;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 7 }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const on = i < available;
          const exists = i < total;
          return (
            <div key={i} style={{ width: size, height: size, transform: "rotate(45deg)", borderRadius: 3, background: on ? "linear-gradient(135deg,#bfe4ff,#2f8fe0)" : exists ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.02)", border: exists ? (on ? "1px solid #7cc4ff" : "1px solid rgba(255,255,255,.1)") : "1px solid rgba(255,255,255,.03)", boxShadow: on ? "0 0 8px rgba(74,160,230,.55)" : "none", transition: "all 0.2s" }} />
          );
        })}
      </div>
      <span style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7cc4ff" }}>{available}<span style={{ color: "#4a5478" }}>/{total}</span> <span style={{ font: `600 9px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478", letterSpacing: "1px" }}>GAS</span></span>
    </div>
  );
}

function SettingsRow({ label, description, action }: { label: string; description: string; action: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3" }}>{label}</div>
        <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", marginTop: 2 }}>{description}</div>
      </div>
      {action}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        cursor: "pointer", width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        border: `1px solid ${checked ? "rgba(100,160,255,.5)" : "rgba(255,255,255,.12)"}`,
        background: checked ? "rgba(74,144,230,.45)" : "rgba(255,255,255,.06)",
        position: "relative", transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: checked ? 22 : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: checked ? "#bfe4ff" : "#8a93a6",
        transition: "left 0.15s, background 0.15s",
        boxShadow: "0 1px 4px rgba(0,0,0,.4)",
      }} />
    </button>
  );
}

function slotToCardData(slot: MinionSlot): CardData {
  return { ...slot.card, attack: slot.currentAttack, health: slot.currentHealth } as CardData;
}
