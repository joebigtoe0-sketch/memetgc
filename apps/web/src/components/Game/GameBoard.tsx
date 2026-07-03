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
import { CARD_BACK_DEFAULT, CARD_BACK_RADIUS, cardBackImage } from "@/lib/cardBacks";
import GameIcon from "@/components/UI/GameIcon";
import { playSound } from "@/lib/sounds";
import { burstAtClient, burstAtElement, shockwaveAtClient, entityElement, centerOf, type BurstKind } from "./fx";
import { api } from "@/lib/api";
import { useIsMobile } from "@/hooks/useViewport";
import MusicSettings from "@/components/Music/MusicSettings";
import type { MinionSlot, Card } from "@memetgc/types";
import type { CardData } from "../Card/CardComponent";

const TURN_SECONDS = 30;
type PhaseAction = "idle" | "select_play_target" | "select_attack_target" | "select_hero_power_target";

/** Legal attack targets against an opponent (taunt minions force targeting). */
function attackTargetsFor(opponentState: { board: (MinionSlot | null)[]; playerId: string }): string[] {
  const opponentMinions = opponentState.board.filter((s): s is MinionSlot => s !== null);
  const tauntMinions = opponentMinions.filter((m) => m.hasTaunt);
  if (tauntMinions.length > 0) return tauntMinions.map((m) => m.instanceId);
  return [...opponentMinions.map((m) => m.instanceId), "hero_" + opponentState.playerId];
}

interface Toast { id: string; text: string; color: string; }
interface DamageFloat { id: string; entityKey: string; amount: number; isHeal: boolean; text?: string; color?: string; }
interface LogEntry { id: string; text: string; turn: number; }

/** Pre-state snapshot used to pick FX (armor sparks, shield pops, death spots). */
interface FxSnapshot {
  armor: Record<string, number>;
  shields: Set<string>;
  rects: Map<string, { x: number; y: number }>;
  atk: Map<string, number>;
  boardIds: Set<string>;
  init: boolean;
}

export default function GameBoard() {
  const { gameState, isMyTurn, selectedCardInstanceId, selectedAttackerId, lastActionError, playerId, pendingAnimations, matchReward, rankUpdate, opponentDisconnected } = useGameStore();
  const { selectCard, selectAttacker, setActionError, clearAnimations } = useGameStore();
  const [phase, setPhase] = useState<PhaseAction>("idle");
  const [zoomedCard, setZoomedCard] = useState<CardData | null>(null);
  // On mobile a card is inspected via tap; the zoom overlay becomes tap-to-close.
  const [inspectMode, setInspectMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frameTiers, setFrameTiers] = useState<Map<string, "default" | "silver" | "gold">>(new Map());
  const [myCardBack, setMyCardBack] = useState<string>(CARD_BACK_DEFAULT);
  const isMobile = useIsMobile();

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const active = document.fullscreenElement ?? doc.webkitFullscreenElement;
    if (active) {
      (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(!!(document.fullscreenElement ?? doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(TURN_SECONDS);
  const [showNewTurn, setShowNewTurn] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState<"mine" | "opponent" | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  // Combat animations
  const [damageFlashIds, setDamageFlashIds] = useState<Set<string>>(new Set());
  const [damageFloats, setDamageFloats] = useState<DamageFloat[]>([]);
  // Attack move: attacker physically travels to its target and back
  const [attackMove, setAttackMove] = useState<{ entityId: string; dx: number; dy: number; returning: boolean } | null>(null);
  const attackMoveSeq = useRef(0);
  const [buffPulseIds, setBuffPulseIds] = useState<Set<string>>(new Set());
  const fxLayerRef = useRef<HTMLDivElement | null>(null);
  const fxSnapshotRef = useRef<FxSnapshot>({ armor: {}, shields: new Set(), rects: new Map(), atk: new Map(), boardIds: new Set(), init: false });
  const [boardBg, setBoardBg] = useState<string>(getDefaultBoardBackground);
  // Draw animation
  const [newCardIds, setNewCardIds] = useState<string[]>([]);
  const [attackDrag, setAttackDrag] = useState<{ attackerId: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const attackDragRef = useRef<{ attackerId: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const [coinFlip, setCoinFlip] = useState<{ result: "heads" | "tails"; id: string; mine: boolean } | null>(null);
  const [shuffleAnim, setShuffleAnim] = useState<string | null>(null);
  const [spellCast, setSpellCast] = useState<{ card: CardData; mine: boolean; id: string } | null>(null);
  const prevHandIds = useRef<string[]>([]);
  const prevMinionHp = useRef<Record<string, number>>({});
  const prevHeroHp = useRef<Record<string, number>>({});
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTurnKey = useRef("");
  const autoEndTurnRef = useRef("");
  const turnStartRef = useRef<number>(Date.now());
  const isMyTurnRef = useRef(isMyTurn);
  const gameStatusRef = useRef(gameState?.status);
  const activePlayerRef = useRef(gameState?.activePlayerId);
  const turnNumberRef = useRef(gameState?.turnNumber);
  const gameStateRef = useRef(gameState);
  isMyTurnRef.current = isMyTurn;
  gameStatusRef.current = gameState?.status;
  activePlayerRef.current = gameState?.activePlayerId;
  turnNumberRef.current = gameState?.turnNumber;
  gameStateRef.current = gameState;
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const endSoundPlayed = useRef(false);

  const requestAutoEndTurn = useCallback(() => {
    if (gameStatusRef.current !== "in_progress" || !isMyTurnRef.current) return;
    const turnKey = `${activePlayerRef.current}:${turnNumberRef.current}`;
    const now = Date.now();
    const last = autoEndTurnRef.current;
    // Allow one immediate fire, then retry every 2s if the server hasn't advanced the turn.
    if (last.startsWith(`${turnKey}:`)) {
      const lastAt = Number(last.split(":")[2] ?? 0);
      if (now - lastAt < 2000) return;
    }
    autoEndTurnRef.current = `${turnKey}:${now}`;
    sendAction({ type: "end_turn" });
  }, []);

  // Minion drag-to-attack — global pointer tracking while a drag is active.
  // Declared here (before any early return) so hook order stays stable, and it
  // reads live game state via refs so it works regardless of render branch.
  useEffect(() => {
    if (!attackDrag) return;
    const onMove = (e: PointerEvent) => {
      setAttackDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    };
    const finish = (e: PointerEvent) => {
      const drag = attackDragRef.current;
      if (!drag) return;
      attackDragRef.current = null;
      setAttackDrag(null);
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const moved = Math.abs(dx) > 10 || Math.abs(dy) > 10;
      const opp = gameStateRef.current?.opponentState;
      if (!opp) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const targetEl = el?.closest("[data-attack-target]") as HTMLElement | null;
      const targetId = targetEl?.dataset.attackTarget;
      const valid = attackTargetsFor(opp);
      if (targetId && valid.includes(targetId)) {
        sendAction({ type: "attack", attackerInstanceId: drag.attackerId, defenderInstanceId: targetId });
        selectAttacker(null);
        setPhase("idle");
      } else if (!moved) {
        selectAttacker(drag.attackerId);
        setPhase("select_attack_target");
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [attackDrag, selectAttacker]);

  // Turn timer — a purely LOCAL countdown that restarts only when the turn
  // actually changes (activePlayer / turnNumber). We count down from the moment
  // this client first sees a new turn rather than diffing an absolute server
  // timestamp against the local clock — that avoids clock-skew artifacts (e.g.
  // showing "32s") and mid-turn resets. The server remains the authority that
  // actually ends the turn; the client just displays + sends a backup at 0.
  useEffect(() => {
    const inProgress = gameState?.status === "in_progress";
    const turnKey = inProgress ? `${gameState?.activePlayerId}:${gameState?.turnNumber}` : "";

    if (inProgress && turnKey !== prevTurnKey.current) {
      turnStartRef.current = Date.now();
      autoEndTurnRef.current = "";
      setTurnSecondsLeft(TURN_SECONDS);
      if (isMyTurn) {
        setShowNewTurn(true);
        playSound("turnStart", 0.6);
        setTimeout(() => setShowNewTurn(false), 1800);
      }
    }
    prevTurnKey.current = turnKey;

    if (!inProgress) {
      if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null; }
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - turnStartRef.current) / 1000;
      const left = Math.max(0, Math.min(TURN_SECONDS, Math.ceil(TURN_SECONDS - elapsed)));
      setTurnSecondsLeft(left);
      if (left === 0) requestAutoEndTurn();
    };
    tick();
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    turnTimerRef.current = setInterval(tick, 250);
    return () => { if (turnTimerRef.current) clearInterval(turnTimerRef.current); };
  }, [isMyTurn, gameState?.status, gameState?.activePlayerId, gameState?.turnNumber, requestAutoEndTurn]);

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

  useEffect(() => {
    api.get<{ cardId: string; displayFrameTier?: "default" | "silver" | "gold" }[]>("/api/collection")
      .then((entries) => setFrameTiers(new Map(entries.map((e) => [e.cardId, e.displayFrameTier ?? "default"]))))
      .catch(() => {});
  }, []);

  // Equipped card back — applied to the local player's deck / face-down cards.
  useEffect(() => {
    api.get<{ equippedCardBack?: string | null }>("/api/economy/profile")
      .then((p) => setMyCardBack(cardBackImage(p.equippedCardBack)))
      .catch(() => {});
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

  const addFloat = useCallback((entityKey: string, amount: number, isHeal: boolean, extra?: { text?: string; color?: string }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setDamageFloats((prev) => [...prev, { id, entityKey, amount, isHeal, text: extra?.text, color: extra?.color }]);
    setTimeout(() => setDamageFloats((prev) => prev.filter((f) => f.id !== id)), 900);
  }, []);

  const triggerBuffPulse = useCallback((instanceId: string) => {
    setBuffPulseIds((prev) => new Set(prev).add(instanceId));
    setTimeout(() => setBuffPulseIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    }), 750);
  }, []);

  /**
   * Full attack sequence: attacker element travels to the defender, impact
   * particles fly (grey sparks when armor/shield absorbed, red otherwise),
   * then the attacker returns. Falls back to particles-only when the
   * attacker has already left the board.
   */
  const runAttackFx = useCallback((data: { attackerId?: string; defenderId?: string; attackerDamage?: number; defenderDamage?: number; damage?: number }, delayMs: number) => {
    const { attackerId, defenderId } = data;
    if (!attackerId || !defenderId) return;
    setTimeout(() => {
      const layer = fxLayerRef.current;
      if (!layer) return;
      const snap = fxSnapshotRef.current;

      // Pick the defender's impact particles from the pre-attack snapshot:
      // armored hero / divine-shield minion → grey-metallic, otherwise red.
      let kind: BurstKind = "blood";
      if (defenderId.startsWith("hero_")) {
        if ((snap.armor[defenderId.slice(5)] ?? 0) > 0) kind = "spark";
      } else if (snap.shields.has(defenderId)) {
        kind = "shield";
      }
      const defDmg = data.defenderDamage ?? data.damage ?? 0;
      const atkDmg = data.attackerDamage ?? 0;
      const intensity = Math.min(1.6, 0.8 + defDmg * 0.08);
      const ringColor = kind === "blood" ? "rgba(255,80,60,.65)" : "rgba(235,242,255,.75)";

      const attackerEl = entityElement(attackerId);
      const defenderEl = entityElement(defenderId);
      const defPos = defenderEl ? centerOf(defenderEl) : snap.rects.get(defenderId);
      if (!defPos) return;

      const impact = (atkPos?: { x: number; y: number }) => {
        playSound("attack", 0.75);
        burstAtClient(layer, defPos.x, defPos.y, kind, intensity);
        shockwaveAtClient(layer, defPos.x, defPos.y, ringColor);
        // Retaliation damage sprays at the attacker's (moved) position
        if (atkDmg > 0 && atkPos) burstAtClient(layer, atkPos.x, atkPos.y, "blood", 0.7);
      };

      if (!attackerEl) {
        impact();
        return;
      }

      // Travel most of the way to the target (local/unscaled coords for the transform)
      const rect = layer.getBoundingClientRect();
      const scale = layer.offsetWidth > 0 ? rect.width / layer.offsetWidth : 1;
      const a = centerOf(attackerEl);
      const dx = ((defPos.x - a.x) * 0.86) / scale;
      const dy = ((defPos.y - a.y) * 0.86) / scale;
      const moveId = ++attackMoveSeq.current;
      setAttackMove({ entityId: attackerId, dx, dy, returning: false });

      setTimeout(() => {
        impact({ x: a.x + (defPos.x - a.x) * 0.86, y: a.y + (defPos.y - a.y) * 0.86 });
        if (attackMoveSeq.current === moveId) setAttackMove({ entityId: attackerId, dx, dy, returning: true });
        setTimeout(() => {
          if (attackMoveSeq.current === moveId) setAttackMove(null);
        }, 380);
      }, 270);
    }, delayMs);
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
          playSound(side === "my" ? "takingDamage" : "dealDamage", 0.75);
        } else if (delta < 0) {
          addFloat(`${side}_slot_${idx}`, Math.abs(delta), true);
          const el = entityElement(slot.instanceId);
          if (fxLayerRef.current && el) burstAtElement(fxLayerRef.current, el, "heal");
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
      playSound("takingDamage", 0.75);
    } else if (prevMyHp !== undefined && myHp > prevMyHp) {
      addFloat("my_hero", myHp - prevMyHp, true);
      const el = entityElement("hero_" + gameState.myState.playerId);
      if (fxLayerRef.current && el) burstAtElement(fxLayerRef.current, el, "heal");
    }
    if (prevOppHp !== undefined && oppHp < prevOppHp) {
      flashIds.push("hero_opp");
      addFloat("opp_hero", prevOppHp - oppHp, false);
      addLog(`${gameState.opponentState.heroName} took ${prevOppHp - oppHp} damage`, gameState.turnNumber);
      playSound("dealDamage", 0.75);
    } else if (prevOppHp !== undefined && oppHp > prevOppHp) {
      addFloat("opp_hero", oppHp - prevOppHp, true);
      const el = entityElement("hero_" + gameState.opponentState.playerId);
      if (fxLayerRef.current && el) burstAtElement(fxLayerRef.current, el, "heal");
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
    let attackIdx = 0;
    for (const anim of pendingAnimations) {
      if (anim.type === "draw") {
        const d = anim.data as { overdraw?: boolean; fatigue?: number; playerId?: string; memeBonus?: string };
        if (d.playerId === playerId && !d.overdraw && !d.fatigue) playSound("drawCard", 0.7);
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
        const d = anim.data as { memeBonus?: string; playerId?: string; card?: CardData; cardId?: string };
        if (d.memeBonus === "free_hero_power") {
          if (d.playerId === playerId) { addToast("🎲 Meme Bonus: free Hero Power!", "#ff5fae"); addLog("Meme bonus: free hero power this turn", gameState?.turnNumber ?? 0); }
          else addLog("Opponent's Meme bonus: free hero power", gameState?.turnNumber ?? 0);
        }
        // Spell impact particles on the struck target
        const spell = anim.data as { targetId?: string; damage?: number };
        if (spell.targetId && (spell.damage ?? 0) > 0 && fxLayerRef.current) {
          const el = entityElement(spell.targetId);
          if (el) {
            const snap = fxSnapshotRef.current;
            const armored = spell.targetId.startsWith("hero_")
              ? (snap.armor[spell.targetId.slice(5)] ?? 0) > 0
              : snap.shields.has(spell.targetId);
            burstAtElement(fxLayerRef.current, el, armored ? "spark" : "blood", Math.min(1.5, 0.8 + (spell.damage ?? 0) * 0.08));
          }
        }
        // Show the spell card on the table briefly before it heads to the burn pile.
        if (d.card && d.cardId !== "coin") {
          const mine = d.playerId === playerId;
          const id = `${Date.now()}-${Math.random()}`;
          setSpellCast({ card: d.card, mine, id });
          playSound("playCard", 0.85);
          addLog(`${mine ? "You cast" : "Opponent cast"} ${d.card.name}`, gameState?.turnNumber ?? 0);
          setTimeout(() => setSpellCast((s) => (s && s.id === id ? null : s)), 1600);
        }
      } else if (anim.type === "attack") {
        const d = anim.data as { attackerId?: string; defenderId?: string; attackerDamage?: number; defenderDamage?: number; damage?: number };
        // Stagger so multi-attack batches (AI turns) play out one at a time
        runAttackFx(d, attackIdx * 620);
        attackIdx++;
      } else if (anim.type === "death") {
        const d = anim.data as { cardId?: string; instanceId?: string };
        playSound("destroy", 0.8);
        const spot = d.instanceId ? fxSnapshotRef.current.rects.get(d.instanceId) : undefined;
        if (fxLayerRef.current && spot) {
          burstAtClient(fxLayerRef.current, spot.x, spot.y, "death", 1.2);
          shockwaveAtClient(fxLayerRef.current, spot.x, spot.y, "rgba(130,130,150,.5)", 44);
        }
        addToast("💀 Minion destroyed", "#ff8888");
        addLog(`Minion destroyed (${d.cardId ?? "?"})`, gameState?.turnNumber ?? 0);
      } else if (anim.type === "heal") {
        playSound("heal", 0.7);
        addToast("💚 Healed", "#66ee88");
      } else if (anim.type === "peek") {
        const d = anim.data as { cardName?: string; playerId?: string; from?: string };
        if (d.playerId === playerId) {
          const src = d.from === "burn_pile" ? "burn pile" : "deck";
          addToast(`👁 Top of ${src}: ${d.cardName ?? "?"}`, "#c9b48a");
          addLog(`Peeked ${src}: ${d.cardName ?? "?"}`, gameState?.turnNumber ?? 0);
        }
      } else if (anim.type === "coin_flip") {
        const d = anim.data as { result?: "heads" | "tails"; playerId?: string };
        const result = d.result === "tails" ? "tails" : "heads";
        const id = `${Date.now()}-${Math.random()}`;
        setCoinFlip({ result, id, mine: d.playerId === playerId });
        playSound("coin", 0.7);
        addLog(`Coin flip: ${result.toUpperCase()}`, gameState?.turnNumber ?? 0);
        setTimeout(() => setCoinFlip((c) => (c && c.id === id ? null : c)), 1300);
      } else if (anim.type === "shuffle_to_deck") {
        const d = anim.data as { playerId?: string };
        if (d.playerId === playerId) {
          const id = `${Date.now()}-${Math.random()}`;
          setShuffleAnim(id);
          playSound("shuffle", 0.6);
          addLog(`Shuffled a card back into your deck`, gameState?.turnNumber ?? 0);
          setTimeout(() => setShuffleAnim((s) => (s === id ? null : s)), 850);
        }
      } else if (anim.type === "play_card") {
        const d = anim.data as { cardId?: string };
        playSound("summon", 0.85);
        addLog(`Card played: ${d.cardId ?? "?"}`, gameState?.turnNumber ?? 0);
      } else if (anim.type === "game_over") {
        const d = anim.data as { winner?: string };
        addLog(`Game over — winner: ${d.winner}`, gameState?.turnNumber ?? 0);
      }
    }
    clearAnimations();
  }, [pendingAnimations, playerId, addToast, addLog, clearAnimations, gameState?.turnNumber, runAttackFx]);

  // FX snapshot + state-diff visuals. Runs AFTER the animation effect so the
  // handlers above still see the pre-update snapshot (armor, shields, board
  // positions). Also detects attack buffs, armor gains and fresh summons.
  useEffect(() => {
    if (!gameState) return;
    const snap = fxSnapshotRef.current;
    const layer = fxLayerRef.current;
    const sides = [
      { st: gameState.myState as { playerId: string; armor: number; board: (MinionSlot | null)[] }, prefix: "my" },
      { st: gameState.opponentState as { playerId: string; armor: number; board: (MinionSlot | null)[] }, prefix: "opp" },
    ];

    if (snap.init && layer) {
      for (const { st, prefix } of sides) {
        st.board.forEach((slot, idx) => {
          if (!slot) return;
          const atkNow = (slot.currentAttack ?? 0) + (slot.tempAttackBoost ?? 0);
          const el = entityElement(slot.instanceId);
          if (!snap.boardIds.has(slot.instanceId)) {
            // Fresh summon — dust poof
            if (el) burstAtElement(layer, el, "summon");
            return;
          }
          const prevAtk = snap.atk.get(slot.instanceId);
          if (prevAtk !== undefined && atkNow > prevAtk) {
            // Pumped! Gold glitter + pulse + "+X ATK" floater
            if (el) burstAtElement(layer, el, "buff");
            addFloat(`${prefix}_slot_${idx}`, atkNow - prevAtk, true, { text: `+${atkNow - prevAtk} ATK`, color: "#ffd75e" });
            triggerBuffPulse(slot.instanceId);
          }
        });
        const prevArmor = snap.armor[st.playerId] ?? 0;
        if (st.armor > prevArmor) {
          const el = entityElement("hero_" + st.playerId);
          if (el) burstAtElement(layer, el, "armor");
          addFloat(`${prefix}_hero`, st.armor - prevArmor, true, { text: `+${st.armor - prevArmor} armor`, color: "#b9c6da" });
        }
      }
    }

    // Rebuild the snapshot from the new state
    const armor: Record<string, number> = {};
    const shields = new Set<string>();
    const atk = new Map<string, number>();
    const boardIds = new Set<string>();
    const rects = new Map<string, { x: number; y: number }>();
    for (const { st } of sides) {
      armor[st.playerId] = st.armor;
      for (const slot of st.board) {
        if (!slot) continue;
        boardIds.add(slot.instanceId);
        if (slot.hasDivineShield) shields.add(slot.instanceId);
        atk.set(slot.instanceId, (slot.currentAttack ?? 0) + (slot.tempAttackBoost ?? 0));
        const el = entityElement(slot.instanceId);
        if (el) rects.set(slot.instanceId, centerOf(el));
      }
      const hel = entityElement("hero_" + st.playerId);
      if (hel) rects.set("hero_" + st.playerId, centerOf(hel));
    }
    fxSnapshotRef.current = { armor, shields, rects, atk, boardIds, init: true };
  }, [gameState, addFloat, triggerBuffPulse]);

  useEffect(() => {
    if (gameState?.status !== "finished") {
      endSoundPlayed.current = false;
      return;
    }
    if (endSoundPlayed.current) return;
    endSoundPlayed.current = true;
    playSound(gameState.winner === playerId ? "winGame" : "loseGame");
  }, [gameState?.status, gameState?.winner, playerId]);

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
        {matchReward !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", borderRadius: 12, background: matchReward > 0 ? "rgba(124,196,255,.12)" : "rgba(138,147,166,.1)", border: `1px solid ${matchReward > 0 ? "rgba(124,196,255,.35)" : "rgba(138,147,166,.25)"}` }}>
            <GameIcon name="fragment" size={24} />
            <span style={{ font: `800 18px var(--font-cinzel,'Cinzel',serif)`, color: matchReward > 0 ? "#7cc4ff" : "#8a93a6" }}>
              {matchReward > 0 ? `+${matchReward} Fragments` : "No Fragments earned"}
            </span>
          </div>
        )}
        {rankUpdate && (() => {
          const TIER_COLOR: Record<string, string> = { bronze: "#c8843c", silver: "#cfd6e0", gold: "#e7c768", platinum: "#7ad6ff", diamond: "#b58bff", degen: "#ff5fae" };
          const ROMAN = ["", "I", "II", "III", "IV", "V"];
          const tc = TIER_COLOR[rankUpdate.tier] ?? "#e7c768";
          const up = rankUpdate.delta >= 0;
          const streakBonus = rankUpdate.streakBonus ?? 0;
          const streak = rankUpdate.streak ?? 0;
          return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 22px", borderRadius: 12, background: `color-mix(in srgb,${tc} 12%,transparent)`, border: `1px solid color-mix(in srgb,${tc} 40%,transparent)` }}>
                <span style={{ font: `900 16px var(--font-cinzel,'Cinzel',serif)`, color: tc, textTransform: "uppercase", letterSpacing: ".5px" }}>
                  {rankUpdate.tier} {ROMAN[Math.max(1, 5 - rankUpdate.stars)] ?? ""}
                </span>
                <span style={{ font: `800 18px var(--font-mono,'JetBrains Mono',monospace)`, color: up ? "#19e08a" : "#ff6b6b" }}>
                  {up ? "+" : ""}{rankUpdate.delta} LP
                </span>
                <span style={{ font: `600 12px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>
                  {rankUpdate.points.toLocaleString()} pts
                </span>
              </div>
              {streakBonus > 0 && (
                <span style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a" }}>
                  🔥 {streak}-win streak · +{streakBonus} LP bonus
                </span>
              )}
            </div>
          );
        })()}
        <button onClick={() => { window.location.href = "/"; }} style={{ cursor: "pointer", border: "none", padding: "15px 44px", borderRadius: 12, font: `800 16px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 24px rgba(224,137,15,.4)" }}>
          Back to Menu
        </button>
      </div>
    );
  }

  const { myState, opponentState } = gameState;
  const canAct = isMyTurn && gameState.phase === "main" && gameState.status === "in_progress";
  const timerUrgent = isMyTurn && turnSecondsLeft <= 5;
  const opponentCardBack = cardBackImage(opponentState.cardBack);

  function getValidAttackTargets(attackerId: string | null | undefined): string[] {
    if (!attackerId) return [];
    return attackTargetsFor(opponentState);
  }

  function canMinionAttack(slot: MinionSlot): boolean {
    return !slot.hasAttacked && (!slot.summoningSickness || slot.hasCharge);
  }

  const activeAttackerId = attackDrag?.attackerId ?? selectedAttackerId;
  const validTargets = getValidAttackTargets(activeAttackerId);
  const opponentHeroTargetId = "hero_" + opponentState.playerId;
  const opponentHeroIsAttackTarget = validTargets.includes(opponentHeroTargetId);

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

  // Some hero powers (e.g. Charge Forward / Turbo) need the player to pick a
  // minion. Detect that from the hero power's effect params.
  function heroPowerTargeting(): { needs: boolean; side: "friendly" | "enemy" } {
    const tgt = String((myState.heroPower.effect_params?.target as string) ?? "");
    return { needs: tgt.includes("chosen"), side: tgt.includes("enemy") ? "enemy" : "friendly" };
  }
  function getValidHeroPowerTargets(): string[] {
    if (phase !== "select_hero_power_target") return [];
    const board = heroPowerTargeting().side === "enemy" ? opponentState.board : myState.board;
    return board.filter((s): s is MinionSlot => s !== null).map((m) => m.instanceId);
  }
  const validHeroPowerTargets = getValidHeroPowerTargets();

  function activateHeroPower() {
    if (!canAct || myState.heroPowerUsed) return;
    if (myState.mana + myState.tempMana < myState.heroPower.cost) return;
    const { needs, side } = heroPowerTargeting();
    if (needs) {
      const board = side === "enemy" ? opponentState.board : myState.board;
      if (!board.some((s) => s !== null)) { setActionError("No valid minion to target"); return; }
      selectCard(null); selectAttacker(null); setPhase("select_hero_power_target");
    } else {
      playSound("heroPower", 0.8);
      sendAction({ type: "hero_power" });
    }
  }

  function doAttack(attacker: string, defender: string) {
    sendAction({ type: "attack", attackerInstanceId: attacker, defenderInstanceId: defender });
    selectAttacker(null); setPhase("idle");
    attackDragRef.current = null;
    setAttackDrag(null);
  }

  function beginAttackDrag(attackerId: string, e: React.PointerEvent) {
    if (!canAct || phase !== "idle") return;
    const slot = myState.board.find((s): s is MinionSlot => s !== null && s.instanceId === attackerId);
    if (!slot || !canMinionAttack(slot)) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const next = { attackerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY };
    attackDragRef.current = next;
    setAttackDrag(next);
  }

  function cancelTargeting() {
    selectCard(null); selectAttacker(null); setPhase("idle"); setActionError(null);
    attackDragRef.current = null;
    setAttackDrag(null);
  }

  function handleMinionClick(instanceId: string, isEnemy: boolean) {
    if (!canAct) return;
    if (phase === "select_attack_target") {
      if (!isEnemy && instanceId === selectedAttackerId) return;
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
    if (phase === "select_hero_power_target") {
      if (validHeroPowerTargets.includes(instanceId)) {
        playSound("heroPower", 0.8);
        sendAction({ type: "hero_power", targetInstanceId: instanceId });
        setPhase("idle");
      } else {
        cancelTargeting();
      }
      return;
    }
    if (!isEnemy) {
      const slot = myState.board.find((s): s is MinionSlot => s !== null && s.instanceId === instanceId);
      if (slot && canMinionAttack(slot)) {
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
  const turnBarColor = !isMyTurn
    ? (turnTimeRatio > 0.25 ? "#ff8a5c" : "#ff4444")
    : turnTimeRatio > 0.5 ? "#2ee88a" : turnTimeRatio > 0.25 ? "#f0c040" : "#ff4444";

  const myFloats = damageFloats.filter((f) => f.entityKey.startsWith("my_"));
  const oppFloats = damageFloats.filter((f) => f.entityKey.startsWith("opp_"));

  /** Transform applied to an entity's wrapper while it performs an attack move. */
  const moveStyle = (entityId: string | undefined): React.CSSProperties => {
    if (!entityId) return {};
    if (attackMove?.entityId === entityId) {
      return {
        transform: attackMove.returning ? "translate(0,0) scale(1)" : `translate(${attackMove.dx}px,${attackMove.dy}px) scale(1.12)`,
        transition: attackMove.returning ? "transform .36s cubic-bezier(.25,.6,.35,1)" : "transform .27s cubic-bezier(.5,.05,.7,.9)",
        zIndex: 60,
      };
    }
    if (buffPulseIds.has(entityId)) {
      return { animation: "fxBuffPulse .7s ease" };
    }
    return {};
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <BoardBackground url={boardBg} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* ══════════════ OPPONENT ZONE ══════════════ */}
      <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Opponent left: hero */}
        <div style={{ width: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "8px 4px 4px", gap: 8, flexShrink: 0 }}>
          <div data-entity-id={"hero_" + opponentState.playerId} style={{ position: "relative", ...moveStyle("hero_" + opponentState.playerId) }}>
            <HeroZone
              heroName={opponentState.heroName} playerName={opponentState.playerName} faction={opponentState.heroFaction} heroId={opponentState.heroId}
              hp={opponentState.hp} armor={opponentState.armor} isEnemy
              attackTargetId={opponentHeroIsAttackTarget ? opponentHeroTargetId : undefined}
              isValidTarget={(phase === "select_attack_target" && validTargets.includes(opponentHeroTargetId)) || (phase === "select_play_target" && validPlayTargets.includes(opponentHeroTargetId))}
              onHeroClick={() => handleHeroClick(true)}
              secretCount={opponentState.secretCount}
              hasWeapon={opponentState.hasWeapon} weaponAttack={opponentState.weaponAttack} weaponDurability={opponentState.weaponDurability}
            />
            {/* Hero damage floaters */}
            {oppFloats.filter((f) => f.entityKey === "opp_hero").map((f) => (
              <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} text={f.text} color={f.color} />
            ))}
          </div>
          {(opponentState.locations ?? []).map((slot, li) => {
            const loc = slot.card;
            const total = loc.durability ?? slot.durability;
            const left = slot.durability;
            return (
              <div
                key={li}
                onMouseEnter={() => setZoomedCard(loc as unknown as CardData)}
                onMouseLeave={() => setZoomedCard(null)}
                title={loc.text ?? ""}
                style={{ width: 96, borderRadius: 9, overflow: "hidden", position: "relative", background: "#0b1120", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <div style={{ height: 54, backgroundImage: `url(/card-art/${loc.id}.jpg)`, backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.7 }} />
                <div style={{ padding: "3px 5px 4px" }}>
                  <div style={{ font: `700 8px var(--font-cinzel,'Cinzel',serif)`, color: "#cfe8d6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>{loc.name}</div>
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 3 }}>
                    {Array.from({ length: total }).map((_, i) => (
                      <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < left ? "#5ee08c" : "rgba(255,255,255,.15)" }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Opponent center: face-down hand (top) + board (bottom) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Face-down opponent hand at top */}
          <div style={{ flex: "0 0 200px", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8px 0 0", overflow: "visible" }}>
            <FaceDownHand count={opponentState.handCount} backSrc={opponentCardBack} />
          </div>

          {/* Opponent board — slots at bottom */}
          <div
            data-sound-skip-click
            onClick={handleBoardBackgroundClick}
            style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: "0 8px 4px", cursor: phase !== "idle" ? "pointer" : "default", position: "relative" }}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const slot = opponentState.board[i];
              const isValidTarget = slot
                ? (phase === "select_attack_target" && validTargets.includes(slot.instanceId)) ||
                  (attackDrag && validTargets.includes(slot.instanceId)) ||
                  (phase === "select_play_target" && validPlayTargets.includes(slot.instanceId)) ||
                  (phase === "select_hero_power_target" && validHeroPowerTargets.includes(slot.instanceId))
                : false;
              return (
                <BoardSlot key={i} highlighted={isValidTarget} dimmed={(phase === "select_attack_target" || phase === "select_play_target" || phase === "select_hero_power_target" || !!attackDrag) && !isValidTarget && !!slot}
                  onClick={!slot && phase !== "idle" ? cancelTargeting : undefined}>
                  <div data-entity-id={slot?.instanceId} style={{ position: "relative", ...moveStyle(slot?.instanceId) }}>
                    {slot && (
                      <MinionCard slot={slot} isEnemy isValidTarget={isValidTarget}
                        attackTargetId={isValidTarget ? slot.instanceId : undefined}
                        isDamageFlash={damageFlashIds.has(slot.instanceId)}
                        onClick={() => handleMinionClick(slot.instanceId, true)}
                        onHover={(h) => setZoomedCard(h ? slotToCardData(slot) : null)}
                      />
                    )}
                    {/* Slot damage floaters */}
                    {oppFloats.filter((f) => f.entityKey === `opp_slot_${i}`).map((f) => (
                      <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} text={f.text} color={f.color} />
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
          <DeckPile count={opponentState.deckCount} backSrc={opponentCardBack} />
          <GravePile count={opponentState.burnPile?.length ?? 0} onClick={() => setShowGraveyard("opponent")} />
        </div>
      </div>

      {/* ══════════════ CENTER BAR ══════════════ */}
      <div style={{ flex: "0 0 50px", position: "relative", display: "flex", alignItems: "center" }}>
        {/* Timer bar — fills from left, drains toward right (End Turn side) */}
        <div style={{ position: "absolute", left: 140, right: 140, top: "50%", transform: "translateY(-50%)", height: 6, borderRadius: 4, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            height: "100%", width: `${turnTimeRatio * 100}%`,
            borderRadius: 3, background: turnBarColor,
            boxShadow: `0 0 10px ${turnBarColor}88`,
            marginLeft: "auto",  /* right-aligned — drains toward right/End Turn */
            transition: "width 1s linear, background 0.4s ease, box-shadow 0.4s ease",
          }} />
        </div>

        {/* Turn badge */}
        <div style={{ position: "absolute", left: 16, zIndex: 10, padding: "6px 14px", borderRadius: 9, background: isMyTurn ? "rgba(25,224,138,.1)" : "rgba(255,255,255,.04)", border: `1px solid ${isMyTurn ? "rgba(25,224,138,.35)" : "rgba(255,255,255,.1)"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <span style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: isMyTurn ? "#7fe8bd" : "#c4ccd8" }}>{isMyTurn ? "YOUR TURN" : "ENEMY TURN"}</span>
          <span style={{ font: `900 13px var(--font-mono,'JetBrains Mono',monospace)`, color: turnSecondsLeft <= 5 ? "#ff4444" : isMyTurn ? "#7fe8bd" : "#c4ccd8", animation: turnSecondsLeft <= 5 ? "urgentPulse 0.5s ease-in-out infinite" : "none" }}>{turnSecondsLeft}s</span>
        </div>

        {/* Phase instruction */}
        {phase !== "idle" && (
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 20, padding: "6px 16px", borderRadius: 20, background: "rgba(60,50,0,.95)", border: "1px solid #e0c040", color: "#ffe060", font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", whiteSpace: "nowrap", boxShadow: "0 0 16px rgba(224,192,64,.3)" }}>
            {phase === "select_play_target" && "→ SELECT TARGET FOR SPELL"}
            {phase === "select_attack_target" && "→ SELECT ATTACK TARGET"}
            {phase === "select_hero_power_target" && "→ SELECT MINION FOR HERO POWER"}
          </div>
        )}
        {attackDrag && phase === "idle" && (
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 20, padding: "6px 16px", borderRadius: 20, background: "rgba(60,50,0,.95)", border: "1px solid #e0c040", color: "#ffe060", font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", whiteSpace: "nowrap", boxShadow: "0 0 16px rgba(224,192,64,.3)" }}>
            → DRAG TO ATTACK TARGET
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
          <div data-entity-id={"hero_" + playerId} style={{ position: "relative", ...moveStyle("hero_" + playerId) }}>
            <HeroZone
              heroName={myState.heroName} playerName={myState.playerName} faction={myState.heroFaction} heroId={myState.heroId}
              hp={myState.hp} armor={myState.armor}
              heroPowerName={myState.heroPower.name}
              heroPowerDescription={myState.heroPower.description}
              heroPowerCost={myState.heroPower.cost}
              heroPowerUsed={myState.heroPowerUsed}
              hasWeapon={myState.hasWeapon} weaponAttack={myState.weaponAttack} weaponDurability={myState.weaponDurability}
              isValidTarget={phase === "select_play_target" && validPlayTargets.includes("hero_" + playerId)}
              onHeroClick={() => handleHeroClick(false)}
              onHeroPowerClick={activateHeroPower}
            />
            {/* Hero damage floaters */}
            {myFloats.filter((f) => f.entityKey === "my_hero").map((f) => (
              <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} text={f.text} color={f.color} />
            ))}
          </div>
          {myState.hasWeapon && (
            <div style={{ font: `700 11px var(--font-cinzel,'Cinzel',serif)`, color: "#e8d090", padding: "3px 8px", borderRadius: 6, background: "rgba(231,199,104,.1)", border: "1px solid rgba(231,199,104,.2)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <GameIcon name="battle" size={14} />
              {myState.weaponAttack}/{myState.weaponDurability}
            </div>
          )}
          {(myState.locations ?? []).map((slot, li) => {
            const loc = slot.card;
            const total = loc.durability ?? slot.durability;
            const left = slot.durability;
            const usable = canAct && !slot.usedThisTurn && left > 0;
            return (
              <div
                key={li}
                onClick={() => { if (usable) { playSound("click", 0.6); sendAction({ type: "tap_location", index: li }); } }}
                onMouseEnter={() => setZoomedCard(loc as unknown as CardData)}
                onMouseLeave={() => setZoomedCard(null)}
                title={loc.text ?? ""}
                style={{
                  width: 96, borderRadius: 9, overflow: "hidden", position: "relative", marginTop: 2,
                  cursor: usable ? "pointer" : "default", background: "#0b1120",
                  border: usable ? "1px solid rgba(120,230,150,.75)" : "1px solid rgba(255,255,255,.12)",
                  boxShadow: usable ? "0 0 12px rgba(90,220,140,.5)" : "none",
                }}
              >
                <div style={{ height: 54, backgroundImage: `url(/card-art/${loc.id}.jpg)`, backgroundSize: "cover", backgroundPosition: "center top", opacity: usable ? 1 : 0.55 }} />
                <div style={{ padding: "3px 5px 4px" }}>
                  <div style={{ font: `700 8px var(--font-cinzel,'Cinzel',serif)`, color: "#cfe8d6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>{loc.name}</div>
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 3 }}>
                    {Array.from({ length: total }).map((_, i) => (
                      <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < left ? "#5ee08c" : "rgba(255,255,255,.15)", boxShadow: i < left ? "0 0 5px rgba(90,220,140,.8)" : "none" }} />
                    ))}
                  </div>
                </div>
                <div style={{ position: "absolute", top: 3, left: 4, font: `700 7px var(--font-mono,'JetBrains Mono',monospace)`, color: usable ? "#9df0b8" : "#9aa3b5", letterSpacing: 1, textShadow: "0 1px 3px #000" }}>
                  {usable ? "TAP" : slot.usedThisTurn ? "USED" : ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* Player center: board + hand */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "visible" }}>
          {/* Player board */}
          <div
            data-sound-skip-click
            onClick={handleBoardBackgroundClick}
            style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 8, padding: "6px 0 0", cursor: phase !== "idle" ? "pointer" : "default" }}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const slot = myState.board[i];
              const isAttacking = slot?.instanceId === selectedAttackerId;
              const isPlayTarget = slot ? phase === "select_play_target" && validPlayTargets.includes(slot.instanceId) : false;
              const isHpTarget = slot ? phase === "select_hero_power_target" && validHeroPowerTargets.includes(slot.instanceId) : false;
              return (
                <BoardSlot
                  key={i}
                  highlighted={isAttacking || isPlayTarget || isHpTarget}
                  glowing={isAttacking}
                  dimmed={((phase === "select_play_target" || phase === "select_hero_power_target") && !!slot && !isPlayTarget && !isHpTarget)}
                  onClick={!slot && phase !== "idle" ? cancelTargeting : undefined}
                >
                  <div data-entity-id={slot?.instanceId} style={{ position: "relative", ...moveStyle(slot?.instanceId) }}>
                    {slot && (
                      <MinionCard
                        slot={slot}
                        frameTier={frameTiers.get(slot.card.id)}
                        isSelected={isAttacking} isAttacking={isAttacking || attackDrag?.attackerId === slot.instanceId} isValidTarget={isPlayTarget || isHpTarget}
                        isDamageFlash={damageFlashIds.has(slot.instanceId)}
                        onAttackPointerDown={(e) => beginAttackDrag(slot.instanceId, e)}
                        onClick={() => handleMinionClick(slot.instanceId, false)}
                        onHover={(h) => setZoomedCard(h ? slotToCardData(slot) : null)}
                      />
                    )}
                    {myFloats.filter((f) => f.entityKey === `my_slot_${i}`).map((f) => (
                      <FloatNumber key={f.id} amount={f.amount} isHeal={f.isHeal} text={f.text} color={f.color} />
                    ))}
                  </div>
                </BoardSlot>
              );
            })}
          </div>

          {/* Player hand — container is at least as tall as a hand card (190px)
              so the fanned cards sit fully inside this zone instead of spilling
              up over the board. */}
          <div style={{ flex: "0 0 196px", position: "relative", overflow: "visible" }}>
            <HandZone
              hand={myState.hand as (Card & { instanceId?: string })[]}
              selectedInstanceId={selectedCardInstanceId}
              currentMana={manaAvailable}
              actionsEnabled={canAct}
              newCardIds={newCardIds}
              isMobile={isMobile}
              onCardInspect={(card) => { setZoomedCard(card); setInspectMode(true); }}
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
        <div style={{ width: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 4px 8px", gap: 10, flexShrink: 0, position: "relative" }}>
          {shuffleAnim && (
            <img
              key={shuffleAnim}
              src={myCardBack}
              alt=""
              draggable={false}
              style={{ position: "absolute", top: "50%", left: "50%", width: 40, height: 54, borderRadius: CARD_BACK_RADIUS, objectFit: "cover", zIndex: 5, pointerEvents: "none", boxShadow: "0 4px 14px rgba(0,0,0,.5)", animation: "shuffleToDeck 0.8s ease-in-out forwards" }}
            />
          )}
          <DeckPile count={myState.deckCount} backSrc={myCardBack} />
          {myState.topDeckRevealed && myState.deckPile?.[0] && (
            <div
              onMouseEnter={() => setZoomedCard(myState.deckPile[0] as unknown as CardData)}
              onMouseLeave={() => setZoomedCard(null)}
              title="Top of your deck — this is your next draw"
              style={{ position: "relative", transform: "scale(0.66)", transformOrigin: "center top", marginTop: -8, marginBottom: -34, cursor: "help" }}
            >
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", zIndex: 3, font: `800 8px var(--font-mono,'JetBrains Mono',monospace)`, color: "#7fe0a0", letterSpacing: 1, whiteSpace: "nowrap", textShadow: "0 1px 3px #000" }}>NEXT DRAW</div>
              <CardComponent card={myState.deckPile[0] as unknown as CardData} size="sm" glowing />
            </div>
          )}
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

      {/* Fullscreen toggle — mobile only, reclaims space from browser chrome */}
      {isMobile && (
        <button
          onClick={toggleFullscreen}
          title="Fullscreen"
          style={{
            position: "absolute", top: 12, right: 68, zIndex: 82,
            cursor: "pointer", width: 46, height: 46, borderRadius: 12,
            background: "rgba(8,11,18,.85)", border: "1px solid rgba(255,255,255,.14)",
            color: "#c4ccd8", fontSize: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,.45)",
          }}
        >{isFullscreen ? "⤢" : "⛶"}</button>
      )}

      {/* ══════════════ OVERLAYS ══════════════ */}

      {/* Card zoom — on mobile (inspect mode) it's tap-to-close */}
      {zoomedCard && (
        <div
          onClick={inspectMode ? () => { setZoomedCard(null); setInspectMode(false); } : undefined}
          style={{ position: "absolute", inset: 0, zIndex: showGraveyard ? 95 : 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, pointerEvents: inspectMode ? "auto" : "none", background: "rgba(4,6,12,.55)", backdropFilter: "blur(4px)" }}
        >
          <div style={{ animation: "cardZoomIn 0.18s ease-out", filter: "drop-shadow(0 0 40px rgba(0,0,0,.9))" }}>
            <CardComponent card={zoomedCard} size="lg" glowing />
          </div>
          {inspectMode && (
            <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: "#9aa3b4", background: "rgba(8,11,20,.85)", border: "1px solid rgba(255,255,255,.12)", padding: "7px 16px", borderRadius: 999 }}>
              TAP TO CLOSE · DRAG A CARD UP TO PLAY
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {lastActionError && (
        <div onClick={() => setActionError(null)} style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 80, padding: "8px 18px", borderRadius: 10, background: "rgba(100,0,0,.95)", border: "1px solid #ff3333", color: "#ff8888", cursor: "pointer", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, whiteSpace: "nowrap" }}>
          {lastActionError} ✕
        </div>
      )}

      {/* Opponent disconnected notice */}
      {opponentDisconnected && gameState.status === "in_progress" && (
        <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 80, padding: "8px 18px", borderRadius: 10, background: "rgba(90,60,0,.95)", border: "1px solid #e0b13a", color: "#ffdd88", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, whiteSpace: "nowrap", boxShadow: "0 4px 18px rgba(0,0,0,.4)" }}>
          Opponent disconnected — they forfeit soon if they don&apos;t return. Play on!
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

      {/* Coin flip reveal */}
      {spellCast && (
        <div key={spellCast.id} style={{ position: "absolute", left: "50%", top: spellCast.mine ? "57%" : "41%", zIndex: 82, pointerEvents: "none", animation: "spellCastPop 1.6s ease-out forwards", filter: "drop-shadow(0 14px 34px rgba(0,0,0,.65))" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", padding: "3px 12px", borderRadius: 20, background: "rgba(6,8,13,.85)", border: `1px solid ${spellCast.mine ? "rgba(127,232,189,.5)" : "rgba(255,154,138,.5)"}`, font: `800 9px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1.5px", color: spellCast.mine ? "#7fe8bd" : "#ff9a8a", whiteSpace: "nowrap" }}>
              {spellCast.mine ? "YOU CAST" : "OPPONENT CASTS"}
            </div>
            <CardComponent card={spellCast.card} size="md" />
          </div>
        </div>
      )}

      {coinFlip && (
        <div style={{ position: "absolute", inset: 0, zIndex: 96, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(4,6,12,.55), rgba(4,6,12,0) 60%)" }}>
          <div style={{ perspective: 800 }}>
            <div
              key={coinFlip.id}
              style={{
                position: "relative",
                width: 132,
                height: 132,
                transformStyle: "preserve-3d",
                animation: `${coinFlip.result === "tails" ? "coinSpinTails" : "coinSpinHeads"} 1.05s cubic-bezier(0.25,0.9,0.3,1) forwards`,
              }}
            >
              {/* Heads face */}
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 35% 30%, #f6e3a1, #d9a83a 55%, #9c6f1e)", boxShadow: "0 0 26px rgba(231,199,104,.7), inset 0 0 0 5px rgba(255,255,255,.25)", color: "#5a3d0a", font: `900 22px var(--font-cinzel,'Cinzel',serif)`, letterSpacing: 1 }}>
                ₿
              </div>
              {/* Tails face */}
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", transform: "rotateY(180deg)", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 35% 30%, #d7deea, #93a2bd 55%, #5a688a)", boxShadow: "0 0 26px rgba(160,190,230,.7), inset 0 0 0 5px rgba(255,255,255,.25)", color: "#2b3550", font: `900 30px var(--font-cinzel,'Cinzel',serif)` }}>
                ✦
              </div>
            </div>
          </div>
          <div style={{ font: `900 24px var(--font-cinzel,'Cinzel',serif)`, color: coinFlip.result === "tails" ? "#bcd0f0" : "#f3d98a", textShadow: "0 2px 18px rgba(0,0,0,.8)", opacity: 0, animation: "coinLabelIn .3s ease .8s forwards", letterSpacing: 3 }}>
            {coinFlip.result.toUpperCase()}
          </div>
          <style>{`
            @keyframes coinSpinHeads { 0%{transform:rotateY(0deg) scale(.55);opacity:0} 18%{opacity:1} 100%{transform:rotateY(1440deg) scale(1);opacity:1} }
            @keyframes coinSpinTails { 0%{transform:rotateY(0deg) scale(.55);opacity:0} 18%{opacity:1} 100%{transform:rotateY(1620deg) scale(1);opacity:1} }
            @keyframes coinLabelIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          `}</style>
        </div>
      )}

      {/* Discover / resurrect picker */}
      {gameState.pendingDiscover && gameState.pendingDiscover.playerId === playerId && (
        <div style={{ position: "absolute", inset: 0, zIndex: 94, background: "rgba(4,6,12,.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, maxWidth: "100%" }}>
            <div style={{ font: `800 18px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", textAlign: "center", textShadow: "0 0 20px rgba(231,199,104,.4)" }}>
              {gameState.pendingDiscover.prompt ?? "Choose a card"}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 900, maxHeight: "70vh", overflowY: "auto", padding: 8 }}>
              {gameState.pendingDiscover.options.map((card, i) => (
                <div
                  key={`${card.id}-${i}`}
                  onClick={() => { playSound("playCard", 0.7); sendAction({ type: "discover_choice", cardId: card.id }); }}
                  onMouseEnter={() => playSound("cardHover", 0.4)}
                  style={{ cursor: "pointer", transition: "transform 0.15s ease", transform: "scale(1)" }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                  onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <CardComponent card={card as CardData} size="md" glowing />
                </div>
              ))}
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
              <MusicSettings />
              <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "4px 0" }} />
              <SettingsRow
                label="Combat Log"
                description="Show event log panel on the right"
                action={
                  <ToggleSwitch checked={showLog} onChange={setShowLog} />
                }
              />
              <SettingsRow
                label="Surrender"
                description="Forfeit the current match — the only way to leave a game"
                action={
                  <button
                    onClick={() => { setShowSettings(false); setShowSurrenderConfirm(true); }}
                    style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,80,80,.4)", background: "rgba(180,30,30,.25)", color: "#ff8888", font: `700 11px var(--font-cinzel,'Cinzel',serif)` }}
                  >Surrender</button>
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
        @keyframes shuffleToDeck { 0%{opacity:0;transform:translate(-50%,44px) scale(.8) rotate(-8deg);}20%{opacity:1;}70%{opacity:1;transform:translate(-50%,-40px) scale(1) rotate(6deg);}100%{opacity:0;transform:translate(-50%,-58px) scale(.7) rotate(0deg);} }
        @keyframes spellCastPop { 0%{opacity:0;transform:translate(-50%,-50%) scale(.5) rotate(-6deg);}12%{opacity:1;transform:translate(-50%,-50%) scale(1.06) rotate(0deg);}20%{transform:translate(-50%,-50%) scale(1) rotate(0deg);}75%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(0deg);}100%{opacity:0;transform:translate(-50%,-18%) scale(.72) rotate(3deg);} }
        @keyframes fxBuffPulse { 0%,100%{transform:scale(1);filter:none;}35%{transform:scale(1.14);filter:brightness(1.6) drop-shadow(0 0 14px rgba(255,215,94,.9));}70%{transform:scale(1.05);filter:brightness(1.25) drop-shadow(0 0 8px rgba(255,215,94,.6));} }
      `}</style>

      {/* Particle / FX overlay — always on top, never intercepts input */}
      <div ref={fxLayerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 90, overflow: "hidden" }} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function FloatNumber({ amount, isHeal, text, color }: { amount: number; isHeal: boolean; text?: string; color?: string }) {
  const col = color ?? (isHeal ? "#55ee88" : "#ff4444");
  return (
    <div style={{
      position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
      zIndex: 30, pointerEvents: "none",
      font: `900 ${text ? 14 : 18}px var(--font-cinzel,'Cinzel',serif)`,
      color: col,
      textShadow: `0 0 8px ${col}`,
      animation: "floatUp 0.85s ease-out forwards",
      whiteSpace: "nowrap",
    }}>
      {text ?? `${isHeal ? "+" : "−"}${amount}`}
    </div>
  );
}

// Matches player hand: CardComponent lg (260×380) at 0.50 scale
const OPP_HAND_W = 130;
const OPP_HAND_H = 190;
const OPP_HAND_SPREAD = 72;

function FaceDownHand({ count, backSrc = CARD_BACK_DEFAULT }: { count: number; backSrc?: string }) {
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
            src={backSrc}
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
    <div data-sound-skip-click={onClick ? "" : undefined} onClick={onClick} style={{ width: 96, height: 116, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: highlighted ? (glowing ? "2px solid rgba(255,200,60,.85)" : "1.5px dashed rgba(64,224,128,.65)") : "1.5px dashed rgba(255,255,255,.22)", background: highlighted ? (glowing ? "rgba(255,200,60,.12)" : "rgba(64,224,128,.08)") : "rgba(0,0,0,.28)", boxShadow: highlighted ? undefined : "inset 0 0 12px rgba(0,0,0,.35)", opacity: dimmed ? 0.45 : 1, cursor: clickable ? "pointer" : "default", transition: "all 0.15s", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function DeckPile({ count, backSrc = CARD_BACK_DEFAULT }: { count: number; backSrc?: string }) {
  return (
    <div style={{ position: "relative", width: 44, height: 58, flexShrink: 0 }}>
      <img
        src={backSrc}
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
  return { ...slot.card, attack: slot.currentAttack + (slot.tempAttackBoost ?? 0), health: slot.currentHealth } as CardData;
}
