"use client";

/**
 * Lightweight DOM particle engine for in-game combat FX.
 *
 * Particles are plain divs animated with the Web Animations API inside a
 * pointer-events:none overlay. Coordinates are mapped from client space into
 * the overlay's local space so everything stays correct under ScaleToFit's
 * CSS transform scaling.
 */

export type BurstKind =
  | "blood"      // unarmored damage — red splatter with gravity
  | "spark"      // armored hero hit — grey metallic sparks
  | "shield"     // divine shield pop — gold-white flash
  | "heal"       // green sparkles drifting up
  | "buff"       // gold glitter drifting up
  | "armor"      // steel-blue chips drifting up
  | "death"      // dark embers + ash
  | "summon"     // dust poof
  | "iceShatter" // angular frost shards
  | "emberSmoke"; // billowing post-fire smoke

interface KindSpec {
  colors: string[];
  count: number;
  size: [number, number];
  speed: [number, number];
  /** Extra downward drift in px (negative = rises). */
  gravity: number;
  dur: [number, number];
  glow?: boolean;
  /** Bias directions upward instead of a full circle. */
  up?: boolean;
  /** Particle render style — circle (default), angular shard, or blurred smoke puff. */
  shape?: "circle" | "shard" | "smoke";
}

const KINDS: Record<BurstKind, KindSpec> = {
  blood:      { colors: ["#ff4433", "#d92818", "#a01208", "#ff7a5c"], count: 36, size: [4, 11], speed: [45, 175], gravity: 110, dur: [480, 950], glow: true },
  spark:      { colors: ["#e8edf5", "#aab4c5", "#8d97a8", "#f8fbff"], count: 32, size: [3, 7], speed: [90, 230], gravity: 40, dur: [320, 700], glow: true },
  shield:     { colors: ["#fff8d8", "#ffe9a0", "#fffef5", "#ffd75e"], count: 30, size: [4, 9], speed: [70, 200], gravity: 0, dur: [380, 760], glow: true },
  heal:       { colors: ["#5ff09a", "#a8ffcf", "#2ecf74", "#d8ffe9"], count: 28, size: [4, 9], speed: [26, 90], gravity: -85, dur: [700, 1200], glow: true, up: true },
  buff:       { colors: ["#ffd75e", "#ffedb0", "#ffb42e", "#fff6d8"], count: 28, size: [4, 9], speed: [26, 92], gravity: -90, dur: [700, 1200], glow: true, up: true },
  armor:      { colors: ["#b9c6da", "#8fa3c0", "#e3eaf5", "#6e82a0"], count: 22, size: [4, 8], speed: [26, 78], gravity: -62, dur: [600, 1000], glow: true, up: true },
  death:      { colors: ["#4a4f5a", "#23272f", "#767f8e", "#963f28", "#ff7a3a", "#151920"], count: 44, size: [4, 10], speed: [45, 160], gravity: 30, dur: [550, 1150], glow: true },
  summon:     { colors: ["#c9b48a", "#8d7f5f", "#efe6cc", "#a99a76"], count: 24, size: [3, 8], speed: [38, 115], gravity: -12, dur: [420, 850] },
  iceShatter: { colors: ["#b8e8ff", "#e8f8ff", "#7ec8ff", "#ffffff"], count: 24, size: [5, 13], speed: [100, 250], gravity: 80, dur: [380, 700], glow: true, shape: "shard" },
  emberSmoke: { colors: ["#6a4a32", "#8a5a38", "#4a3222", "#c97a3a"], count: 12, size: [16, 34], speed: [10, 34], gravity: -55, dur: [1000, 1700], up: true, shape: "smoke" },
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Map a client-space point into the layer's local (unscaled) space. */
function toLocal(layer: HTMLElement, clientX: number, clientY: number): { x: number; y: number; ok: boolean } {
  const rect = layer.getBoundingClientRect();
  if (rect.width === 0 || layer.offsetWidth === 0) return { x: 0, y: 0, ok: false };
  const scale = rect.width / layer.offsetWidth;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale, ok: true };
}

/** Spawn a particle burst at a client-space position. */
export function burstAtClient(layer: HTMLElement, clientX: number, clientY: number, kind: BurstKind, intensity = 1): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  const spec = KINDS[kind];
  const n = Math.round(spec.count * intensity);
  const shape = spec.shape ?? "circle";

  for (let i = 0; i < n; i++) {
    const size = rand(spec.size[0], spec.size[1]);
    const speed = rand(spec.speed[0], spec.speed[1]);
    // Full circle normally; a ~140° upward cone for rising kinds.
    const ang = spec.up
      ? -Math.PI / 2 + rand(-1.2, 1.2)
      : rand(0, Math.PI * 2);
    const dx = Math.cos(ang) * speed;
    const dy = Math.sin(ang) * speed + spec.gravity;
    const dur = rand(spec.dur[0], spec.dur[1]);
    const color = spec.colors[Math.floor(Math.random() * spec.colors.length)]!;
    const rot = shape === "shard" ? rand(0, 360) : 0;
    const rotSuffix = shape === "shard" ? ` rotate(${rot}deg)` : "";

    const p = document.createElement("div");
    const base = `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;background:${color};pointer-events:none;will-change:transform,opacity;`;
    p.style.cssText =
      shape === "smoke" ? `${base}border-radius:50%;filter:blur(3px);opacity:.55;`
      : shape === "shard" ? `${base}${spec.glow ? `box-shadow:0 0 ${size * 2}px ${color};` : ""}`
      : `${base}border-radius:50%;${spec.glow ? `box-shadow:0 0 ${size * 2}px ${color};` : ""}`;
    layer.appendChild(p);

    const startOpacity = shape === "smoke" ? 0.55 : 1;
    const midScale = shape === "smoke" ? 1.4 : 0.9;
    const endScale = shape === "smoke" ? rand(1.8, 2.6) : 0.3;
    const anim = p.animate(
      [
        { transform: `translate(0,0) scale(1)${rotSuffix}`, opacity: startOpacity },
        { transform: `translate(${dx * 0.65}px,${(dy - spec.gravity * 0.55) * 0.65}px) scale(${midScale})${rotSuffix}`, opacity: shape === "smoke" ? 0.4 : 0.95, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(${endScale})${rotSuffix}`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.6,.5,1)", fill: "forwards" },
    );
    anim.onfinish = () => p.remove();
    // Safety net in case onfinish never fires (tab hidden etc.)
    setTimeout(() => p.remove(), dur + 500);
  }
}

/** Spawn a burst at the center of a DOM element. */
export function burstAtElement(layer: HTMLElement, el: Element, kind: BurstKind, intensity = 1): void {
  const r = el.getBoundingClientRect();
  burstAtClient(layer, r.left + r.width / 2, r.top + r.height / 2, kind, intensity);
}

/** Expanding ring shockwave (impacts, deaths). */
export function shockwaveAtClient(layer: HTMLElement, clientX: number, clientY: number, color = "rgba(255,255,255,.7)", maxRadius = 60): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  const ring = document.createElement("div");
  ring.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:4px solid ${color};box-shadow:0 0 14px ${color},inset 0 0 10px ${color};pointer-events:none;will-change:transform,opacity;`;
  layer.appendChild(ring);
  const anim = ring.animate(
    [
      { transform: "scale(1)", opacity: 1 },
      { transform: `scale(${maxRadius / 6})`, opacity: 0 },
    ],
    { duration: 460, easing: "cubic-bezier(.15,.6,.4,1)", fill: "forwards" },
  );
  anim.onfinish = () => ring.remove();
  setTimeout(() => ring.remove(), 900);
}

/** Bright radial flash right at the impact point — the "pop" that sells a hit. */
export function flareAtClient(layer: HTMLElement, clientX: number, clientY: number, color = "rgba(255,255,255,.9)", size = 90): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  const flare = document.createElement("div");
  flare.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px;border-radius:50%;background:radial-gradient(circle,#ffffff 0%,${color} 30%,transparent 70%);pointer-events:none;will-change:transform,opacity;mix-blend-mode:screen;`;
  layer.appendChild(flare);
  flare.animate(
    [
      { transform: "scale(0.2)", opacity: 0 },
      { transform: "scale(1.15)", opacity: 1, offset: 0.2 },
      { transform: "scale(1.45)", opacity: 0 },
    ],
    { duration: 340, easing: "cubic-bezier(.15,.7,.35,1)", fill: "forwards" },
  ).onfinish = () => flare.remove();
  setTimeout(() => flare.remove(), 550);

  // Crossed anamorphic light streaks through the flare center.
  for (const ang of [0, 90]) {
    const streak = document.createElement("div");
    const w = size * 1.7;
    streak.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:3px;margin:-1.5px 0 0 -${w / 2}px;transform:rotate(${ang}deg);background:linear-gradient(90deg,transparent,#ffffff,transparent);pointer-events:none;opacity:0;mix-blend-mode:screen;`;
    layer.appendChild(streak);
    streak.animate(
      [
        { transform: `rotate(${ang}deg) scaleX(0.1)`, opacity: 0 },
        { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 0.95, offset: 0.25 },
        { transform: `rotate(${ang}deg) scaleX(1.2)`, opacity: 0 },
      ],
      { duration: 320, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => streak.remove();
    setTimeout(() => streak.remove(), 520);
  }
}

/** Physical scale-punch on the struck entity — squashes in, springs back. */
export function punchEntity(entityId: string, strength = 1): void {
  const el = entityElement(entityId);
  if (!el) return;
  const squash = Math.min(0.22, 0.08 + strength * 0.07);
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: `scale(${1 - squash}) rotate(${(Math.random() * 2 - 1) * 3}deg)`, offset: 0.25 },
      { transform: `scale(${1 + squash * 0.5})`, offset: 0.6 },
      { transform: "scale(1)" },
    ],
    { duration: 300, easing: "cubic-bezier(.3,.7,.4,1.4)" },
  );
}

/** Bright weapon-clash streak at a melee impact point. */
export function slashAtClient(layer: HTMLElement, clientX: number, clientY: number, color = "#fff8e0"): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  const len = rand(46, 74);
  const ang = rand(-35, 35);
  const slash = document.createElement("div");
  slash.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${len}px;height:5px;margin:-2.5px 0 0 -${len / 2}px;transform-origin:50% 50%;border-radius:3px;background:linear-gradient(90deg,transparent,${color},#ffffff,${color},transparent);box-shadow:0 0 16px ${color};pointer-events:none;opacity:0;`;
  layer.appendChild(slash);
  slash.animate(
    [
      { transform: `rotate(${ang}deg) scaleX(0)`, opacity: 0 },
      { transform: `rotate(${ang}deg) scaleX(1.1)`, opacity: 1, offset: 0.3 },
      { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 0 },
    ],
    { duration: 260, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => slash.remove();
  setTimeout(() => slash.remove(), 400);
}

/**
 * Floating combat number anchored to a client-space point (works even when the
 * underlying minion is about to be removed from the board).
 */
export function floatTextAtClient(layer: HTMLElement, clientX: number, clientY: number, text: string, color = "#ff6a5c", sizePx = 26): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font:900 ${sizePx}px/1 'Cinzel',serif;color:${color};text-shadow:0 2px 4px rgba(0,0,0,.9),0 0 14px ${color},0 0 26px ${color};pointer-events:none;white-space:nowrap;z-index:95;`;
  layer.appendChild(el);
  el.animate(
    [
      { transform: "translate(-50%,-50%) scale(.5)", opacity: 0 },
      { transform: "translate(-50%,-90%) scale(1.35)", opacity: 1, offset: 0.22 },
      { transform: "translate(-50%,-120%) scale(1.05)", opacity: 1, offset: 0.42 },
      { transform: "translate(-50%,-165%) scale(1)", opacity: 1, offset: 0.72 },
      { transform: "translate(-50%,-225%) scale(.85)", opacity: 0 },
    ],
    { duration: 950, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" },
  ).onfinish = () => el.remove();
  setTimeout(() => el.remove(), 1250);
}

/** Find the board element for a game entity (minion instanceId or "hero_<playerId>"). */
export function entityElement(entityId: string): HTMLElement | null {
  try {
    return document.querySelector(`[data-entity-id="${CSS.escape(entityId)}"]`);
  } catch {
    return null;
  }
}

/** Soft glowing ring pulse around an entity — localized heal/buff feedback. */
export function pulseRingAtEntity(layer: HTMLElement, entityId: string, color: string, pulses = 2): void {
  const el = entityElement(entityId);
  const pos = el ? centerOf(el) : centerFromSnapshot(entityId);
  if (!pos) return;
  const baseR = el ? Math.max(el.getBoundingClientRect().width, el.getBoundingClientRect().height) / 2 : 30;
  for (let i = 0; i < pulses; i++) {
    setTimeout(() => {
      const { x, y, ok } = toLocal(layer, pos.x, pos.y);
      if (!ok) return;
      const r0 = baseR * 0.75;
      const ring = document.createElement("div");
      ring.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${r0 * 2}px;height:${r0 * 2}px;margin:-${r0}px 0 0 -${r0}px;border-radius:50%;border:2px solid ${color};box-shadow:0 0 16px ${color};pointer-events:none;opacity:0;`;
      layer.appendChild(ring);
      ring.animate(
        [
          { transform: "scale(0.6)", opacity: 0 },
          { transform: "scale(1)", opacity: 0.9, offset: 0.35 },
          { transform: "scale(1.5)", opacity: 0 },
        ],
        { duration: 700, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      ).onfinish = () => ring.remove();
      setTimeout(() => ring.remove(), 900);
    }, i * 180);
  }
}

/** Client-space center of an element. */
export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Travel styles for skill projectiles and energy beams. */
export type TravelKind =
  | "fire"       // arcing fireball
  | "lightning"  // jagged bolt
  | "arcane"     // purple spell orb
  | "nature"     // green healing energy
  | "holy"       // warm gold rays
  | "frost"      // icy shard
  | "shadow"     // dark bolt
  | "steel";     // armor / metal shards

interface TravelSpec {
  core: string;
  glow: string;
  trail: string[];
  mode: "projectile" | "beam";
  dur: number;
  size: number;
  impact: BurstKind;
  ring: string;
}

const TRAVEL: Record<TravelKind, TravelSpec> = {
  fire:      { core: "#ff6a28", glow: "rgba(255,120,40,.85)",  trail: ["#ff9a44", "#ff4a12", "#ffd080"], mode: "projectile", dur: 460, size: 26, impact: "blood",  ring: "rgba(255,90,40,.7)" },
  lightning: { core: "#d8f0ff", glow: "rgba(140,210,255,.95)", trail: ["#ffffff", "#7ec8ff", "#b8e8ff"], mode: "beam",      dur: 300, size: 19, impact: "spark",  ring: "rgba(180,230,255,.8)" },
  arcane:    { core: "#c88cff", glow: "rgba(170,110,255,.9)",  trail: ["#e8c8ff", "#9b5dff", "#f0d8ff"], mode: "projectile", dur: 420, size: 22, impact: "spark",  ring: "rgba(180,120,255,.75)" },
  nature:    { core: "#5ff09a", glow: "rgba(80,240,150,.9)",   trail: ["#a8ffcf", "#2ecf74", "#d8ffe9"], mode: "beam",      dur: 560, size: 19, impact: "heal",   ring: "rgba(90,255,160,.7)" },
  holy:      { core: "#ffe9a0", glow: "rgba(255,230,150,.9)",  trail: ["#fff8d8", "#ffd75e", "#fffef5"], mode: "beam",      dur: 520, size: 19, impact: "buff",   ring: "rgba(255,220,120,.75)" },
  frost:     { core: "#b8e8ff", glow: "rgba(160,220,255,.9)",  trail: ["#e8f8ff", "#7ec8ff", "#ffffff"], mode: "projectile", dur: 400, size: 21, impact: "iceShatter", ring: "rgba(180,230,255,.7)" },
  steel:     { core: "#c5d4ea", glow: "rgba(150,175,210,.9)",  trail: ["#e3eaf5", "#8fa3c0", "#b9c6da"], mode: "beam",      dur: 480, size: 18, impact: "armor",  ring: "rgba(170,195,230,.75)" },
  shadow:    { core: "#8a5fd8", glow: "rgba(120,70,200,.85)",  trail: ["#b08cff", "#4a2878", "#d8b8ff"], mode: "projectile", dur: 440, size: 22, impact: "death",  ring: "rgba(120,70,200,.65)" },
};

function posFromEntity(layer: HTMLElement, entityId: string): { x: number; y: number } | null {
  const el = entityElement(entityId);
  if (!el) {
    const snap = centerFromSnapshot(entityId);
    return snap;
  }
  return centerOf(el);
}

/** Optional fallback when DOM nodes are gone (death, etc.). */
let snapshotCenters: Map<string, { x: number; y: number }> = new Map();
export function setFxSnapshotCenters(rects: Map<string, { x: number; y: number }>): void {
  snapshotCenters = rects;
}
function centerFromSnapshot(entityId: string): { x: number; y: number } | null {
  return snapshotCenters.get(entityId) ?? null;
}

function spawnTrailParticle(layer: HTMLElement, x: number, y: number, color: string, size = 4): void {
  const p = document.createElement("div");
  p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px;border-radius:50%;background:${color};pointer-events:none;box-shadow:0 0 ${size * 2}px ${color};opacity:.9;`;
  layer.appendChild(p);
  const dur = rand(180, 320);
  p.animate(
    [{ transform: "scale(1)", opacity: 0.9 }, { transform: "scale(0.2)", opacity: 0 }],
    { duration: dur, fill: "forwards" },
  ).onfinish = () => p.remove();
  setTimeout(() => p.remove(), dur + 200);
}

/** Flying projectile from one client point to another. */
export function projectileAtClient(
  layer: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  kind: TravelKind,
  onImpact?: () => void,
): void {
  const from = toLocal(layer, fromX, fromY);
  const to = toLocal(layer, toX, toY);
  if (!from.ok || !to.ok) return;
  const spec = TRAVEL[kind];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const arc = Math.min(90, Math.hypot(dx, dy) * 0.18) * (dy < 0 ? -1 : 1);

  // Soft blurred halo riding just behind the core for a bigger, more magical glow.
  const halo = document.createElement("div");
  const haloSize = spec.size * 3;
  halo.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${haloSize}px;height:${haloSize}px;margin:-${haloSize / 2}px 0 0 -${haloSize / 2}px;border-radius:50%;background:radial-gradient(circle,${spec.glow},transparent 70%);filter:blur(2px);pointer-events:none;z-index:1;`;
  layer.appendChild(halo);

  const orb = document.createElement("div");
  orb.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${spec.size}px;height:${spec.size}px;margin:-${spec.size / 2}px 0 0 -${spec.size / 2}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${spec.core},${spec.trail[1]});box-shadow:0 0 18px ${spec.glow},0 0 34px ${spec.glow};pointer-events:none;z-index:2;`;
  layer.appendChild(orb);

  const midX = dx * 0.5;
  const midY = dy * 0.5 + arc;
  const keyframes = [
    { transform: "translate(0,0) scale(0.6)", opacity: 0.2 },
    { transform: `translate(${midX * 0.55}px,${midY * 0.55}px) scale(1.2)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px,${dy}px) scale(0.9)`, opacity: 0.95 },
  ];
  const anim = orb.animate(keyframes, { duration: spec.dur, easing: "cubic-bezier(.25,.1,.2,1)", fill: "forwards" });
  halo.animate(keyframes, { duration: spec.dur, easing: "cubic-bezier(.25,.1,.2,1)", fill: "forwards" }).onfinish = () => halo.remove();
  setTimeout(() => halo.remove(), spec.dur + 300);

  const trailCount = 22;
  for (let i = 1; i <= trailCount; i++) {
    setTimeout(() => {
      const t = i / trailCount;
      const jitter = rand(-4, 4);
      const tx = from.x + dx * t + (arc * Math.sin(t * Math.PI)) * 0.15 + jitter;
      const ty = from.y + dy * t - arc * Math.sin(t * Math.PI) + jitter;
      spawnTrailParticle(layer, tx, ty, spec.trail[i % spec.trail.length]!, rand(5, 11));
    }, (spec.dur / trailCount) * i * 0.85);
  }

  anim.onfinish = () => {
    orb.remove();
    onImpact?.();
  };
  setTimeout(() => orb.remove(), spec.dur + 300);
}

/** Instant energy beam / lightning between two points. */
export function beamAtClient(
  layer: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  kind: TravelKind,
  onImpact?: () => void,
): void {
  const from = toLocal(layer, fromX, fromY);
  const to = toLocal(layer, toX, toY);
  if (!from.ok || !to.ok) return;
  const spec = TRAVEL[kind];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) * (180 / Math.PI);

  // Wide soft outer glow beam sits under the bright core beam for extra depth.
  const glowBeam = document.createElement("div");
  glowBeam.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${len}px;height:22px;margin:-11px 0 0 0;transform-origin:0 50%;transform:rotate(${ang}deg);background:linear-gradient(90deg,transparent,${spec.glow},transparent);filter:blur(4px);border-radius:12px;pointer-events:none;opacity:0;`;
  layer.appendChild(glowBeam);
  glowBeam.animate(
    [{ opacity: 0, transform: `rotate(${ang}deg) scaleX(0.1)` }, { opacity: 0.6, transform: `rotate(${ang}deg) scaleX(1)`, offset: 0.25 }, { opacity: 0.4, transform: `rotate(${ang}deg) scaleX(1)`, offset: 0.7 }, { opacity: 0, transform: `rotate(${ang}deg) scaleX(1.05)` }],
    { duration: spec.dur, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => glowBeam.remove();
  setTimeout(() => glowBeam.remove(), spec.dur + 200);

  const beam = document.createElement("div");
  beam.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${len}px;height:8px;margin:-4px 0 0 0;transform-origin:0 50%;transform:rotate(${ang}deg);background:linear-gradient(90deg,transparent,${spec.glow},${spec.core},${spec.glow},transparent);box-shadow:0 0 22px ${spec.glow};border-radius:5px;pointer-events:none;opacity:0;`;
  layer.appendChild(beam);

  beam.animate(
    [{ opacity: 0, transform: `rotate(${ang}deg) scaleX(0.1)` }, { opacity: 1, transform: `rotate(${ang}deg) scaleX(1)`, offset: 0.25 }, { opacity: 0.85, transform: `rotate(${ang}deg) scaleX(1)`, offset: 0.7 }, { opacity: 0, transform: `rotate(${ang}deg) scaleX(1.05)` }],
    { duration: spec.dur, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => beam.remove();

  if (kind === "lightning") {
    // Main jagged bolt plus 2 thinner forked branches peeling off partway through.
    const branches = [
      { offset: 0, segs: 6, width: 5, alpha: 1 },
      { offset: rand(0.2, 0.4), segs: 3, width: 3, alpha: 0.8 },
      { offset: rand(0.4, 0.6), segs: 3, width: 3, alpha: 0.8 },
      { offset: rand(0.55, 0.75), segs: 2, width: 2, alpha: 0.65 },
    ];
    for (const branch of branches) {
      const segs = branch.segs;
      let bx = from.x + dx * branch.offset;
      let by = from.y + dy * branch.offset;
      for (let i = 0; i < segs; i++) {
        const t1 = branch.offset + (1 - branch.offset) * ((i + 1) / segs);
        const x1 = from.x + dx * t1 + rand(-10, 10);
        const y1 = from.y + dy * t1 + rand(-10, 10);
        const segDx = x1 - bx;
        const segDy = y1 - by;
        const segLen = Math.hypot(segDx, segDy);
        const segAng = Math.atan2(segDy, segDx) * (180 / Math.PI);
        const seg = document.createElement("div");
        seg.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${segLen}px;height:${branch.width}px;transform-origin:0 50%;transform:rotate(${segAng}deg);background:${spec.core};box-shadow:0 0 10px ${spec.glow};pointer-events:none;opacity:0;`;
        layer.appendChild(seg);
        seg.animate([{ opacity: 0 }, { opacity: branch.alpha, offset: 0.2 }, { opacity: 0 }], { duration: spec.dur * 0.9, fill: "forwards" }).onfinish = () => seg.remove();
        setTimeout(() => seg.remove(), spec.dur + 200);
        bx = x1;
        by = y1;
      }
    }
  }

  const sparkN = kind === "nature" || kind === "holy" ? 16 : 12;
  for (let i = 0; i < sparkN; i++) {
    const t = rand(0.08, 0.92);
    setTimeout(() => {
      spawnTrailParticle(layer, from.x + dx * t, from.y + dy * t, spec.trail[i % spec.trail.length]!, rand(3, 7));
    }, rand(0, spec.dur * 0.6));
  }

  setTimeout(() => onImpact?.(), spec.dur * 0.72);
  setTimeout(() => beam.remove(), spec.dur + 200);
}

export function travelBetweenEntities(
  layer: HTMLElement,
  sourceId: string,
  targetId: string,
  kind: TravelKind,
  onImpact?: () => void,
): boolean {
  const from = posFromEntity(layer, sourceId);
  const to = posFromEntity(layer, targetId);
  if (!from || !to) return false;
  const spec = TRAVEL[kind];
  if (spec.mode === "beam") beamAtClient(layer, from.x, from.y, to.x, to.y, kind, onImpact);
  else projectileAtClient(layer, from.x, from.y, to.x, to.y, kind, onImpact);
  return true;
}

/** Pick a travel style from spell damage, faction, or effect kind. */
export function travelKindForDamage(damage: number, faction?: string): TravelKind {
  if (damage >= 5) return "lightning";
  if (faction === "ethereum") return "arcane";
  if (faction === "solana") return "fire";
  if (faction === "meme") return "shadow";
  if (faction === "stable") return "frost";
  return damage >= 3 ? "fire" : "arcane";
}

export function travelKindForBuff(kind?: string): TravelKind {
  if (kind === "buff_health") return "holy";
  return "holy";
}

/** Short forked electric arcs crawling outward from a point — lightning/shadow impacts. */
function crawlArcsAtClient(layer: HTMLElement, clientX: number, clientY: number, color: string, count = 3, maxLen = 46): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  for (let i = 0; i < count; i++) {
    const segs = 3;
    let cx = x;
    let cy = y;
    const baseAng = rand(0, Math.PI * 2);
    for (let s = 0; s < segs; s++) {
      const len = rand(maxLen * 0.25, maxLen * 0.45);
      const ang = baseAng + rand(-0.6, 0.6) * (s + 1);
      const nx = cx + Math.cos(ang) * len;
      const ny = cy + Math.sin(ang) * len;
      const segLen = Math.hypot(nx - cx, ny - cy);
      const segAng = Math.atan2(ny - cy, nx - cx) * (180 / Math.PI);
      const seg = document.createElement("div");
      seg.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${segLen}px;height:3px;transform-origin:0 50%;transform:rotate(${segAng}deg);background:${color};box-shadow:0 0 12px ${color};pointer-events:none;opacity:0;`;
      layer.appendChild(seg);
      const delay = s * 30;
      setTimeout(() => {
        seg.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 260, fill: "forwards" }).onfinish = () => seg.remove();
      }, delay);
      setTimeout(() => seg.remove(), delay + 400);
      cx = nx;
      cy = ny;
    }
  }
}

/** Radiant light rays bursting outward from a point — holy/nature impacts. */
function raysAtClient(layer: HTMLElement, clientX: number, clientY: number, color: string, count = 8, len = 50): void {
  const { x, y, ok } = toLocal(layer, clientX, clientY);
  if (!ok) return;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * 360 + rand(-8, 8);
    const ray = document.createElement("div");
    ray.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:5px;height:${len}px;margin:-${len}px -2.5px 0 -2.5px;transform-origin:50% 100%;transform:rotate(${ang}deg) scaleY(0);background:linear-gradient(180deg,${color},transparent);box-shadow:0 0 10px ${color};pointer-events:none;opacity:0;`;
    layer.appendChild(ray);
    ray.animate(
      [
        { transform: `rotate(${ang}deg) scaleY(0)`, opacity: 0 },
        { transform: `rotate(${ang}deg) scaleY(1)`, opacity: 0.9, offset: 0.35 },
        { transform: `rotate(${ang}deg) scaleY(1.15)`, opacity: 0 },
      ],
      { duration: 480, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    ).onfinish = () => ray.remove();
    setTimeout(() => ray.remove(), 650);
  }
}

export function runTravelImpact(layer: HTMLElement, targetId: string, kind: TravelKind, intensity = 1): void {
  const spec = TRAVEL[kind];
  const el = entityElement(targetId);
  const pos = el ? centerOf(el) : centerFromSnapshot(targetId);
  if (!pos) return;

  flareAtClient(layer, pos.x, pos.y, spec.glow, 70 + intensity * 30);
  burstAtClient(layer, pos.x, pos.y, spec.impact, intensity);
  shockwaveAtClient(layer, pos.x, pos.y, spec.ring, 52 + intensity * 12);
  setTimeout(() => shockwaveAtClient(layer, pos.x, pos.y, spec.ring, 38 + intensity * 8), 90);
  // Damage elements slam the target; heals/buffs (nature, holy, steel) glow instead of recoiling.
  if (kind !== "nature" && kind !== "holy" && kind !== "steel") punchEntity(targetId, intensity);

  switch (kind) {
    case "fire":
      setTimeout(() => burstAtClient(layer, pos.x, pos.y, "emberSmoke", Math.max(0.7, intensity)), 90);
      break;
    case "lightning":
      crawlArcsAtClient(layer, pos.x, pos.y, spec.core, 5, 58);
      break;
    case "frost":
      shockwaveAtClient(layer, pos.x, pos.y, "rgba(255,255,255,.85)", 36);
      break;
    case "shadow":
      crawlArcsAtClient(layer, pos.x, pos.y, spec.core, 3, 44);
      break;
    case "holy":
    case "nature":
      raysAtClient(layer, pos.x, pos.y, spec.glow, 12, 62);
      break;
  }
}
