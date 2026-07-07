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
  | "blood"    // unarmored damage — red splatter with gravity
  | "spark"    // armored hero hit — grey metallic sparks
  | "shield"   // divine shield pop — gold-white flash
  | "heal"     // green sparkles drifting up
  | "buff"     // gold glitter drifting up
  | "armor"    // steel-blue chips drifting up
  | "death"    // dark embers + ash
  | "summon";  // dust poof

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
}

const KINDS: Record<BurstKind, KindSpec> = {
  blood:  { colors: ["#ff4433", "#d92818", "#a01208", "#ff7a5c"], count: 16, size: [3, 7], speed: [30, 110], gravity: 90, dur: [450, 800] },
  spark:  { colors: ["#e8edf5", "#aab4c5", "#8d97a8", "#f8fbff"], count: 14, size: [2, 4], speed: [60, 150], gravity: 35, dur: [300, 600], glow: true },
  shield: { colors: ["#fff8d8", "#ffe9a0", "#fffef5", "#ffd75e"], count: 14, size: [3, 6], speed: [50, 130], gravity: 0, dur: [350, 650], glow: true },
  heal:   { colors: ["#5ff09a", "#a8ffcf", "#2ecf74", "#d8ffe9"], count: 12, size: [3, 6], speed: [20, 60], gravity: -70, dur: [600, 1000], glow: true, up: true },
  buff:   { colors: ["#ffd75e", "#ffedb0", "#ffb42e", "#fff6d8"], count: 12, size: [3, 6], speed: [20, 65], gravity: -75, dur: [600, 1000], glow: true, up: true },
  armor:  { colors: ["#b9c6da", "#8fa3c0", "#e3eaf5", "#6e82a0"], count: 10, size: [3, 5], speed: [20, 55], gravity: -55, dur: [550, 900], up: true },
  death:  { colors: ["#4a4f5a", "#23272f", "#767f8e", "#963f28", "#151920"], count: 20, size: [3, 7], speed: [30, 100], gravity: 25, dur: [500, 950] },
  summon: { colors: ["#c9b48a", "#8d7f5f", "#efe6cc", "#a99a76"], count: 12, size: [2, 5], speed: [30, 80], gravity: -10, dur: [400, 750] },
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

    const p = document.createElement("div");
    p.style.cssText = `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};pointer-events:none;will-change:transform,opacity;${spec.glow ? `box-shadow:0 0 ${size * 2}px ${color};` : ""}`;
    layer.appendChild(p);

    const anim = p.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.65}px,${(dy - spec.gravity * 0.55) * 0.65}px) scale(0.9)`, opacity: 0.95, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(0.3)`, opacity: 0 },
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
  ring.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:3px solid ${color};pointer-events:none;will-change:transform,opacity;`;
  layer.appendChild(ring);
  const anim = ring.animate(
    [
      { transform: "scale(1)", opacity: 1 },
      { transform: `scale(${maxRadius / 6})`, opacity: 0 },
    ],
    { duration: 420, easing: "cubic-bezier(.15,.6,.4,1)", fill: "forwards" },
  );
  anim.onfinish = () => ring.remove();
  setTimeout(() => ring.remove(), 900);
}

/** Find the board element for a game entity (minion instanceId or "hero_<playerId>"). */
export function entityElement(entityId: string): HTMLElement | null {
  try {
    return document.querySelector(`[data-entity-id="${CSS.escape(entityId)}"]`);
  } catch {
    return null;
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
  fire:      { core: "#ff6a28", glow: "rgba(255,120,40,.85)",  trail: ["#ff9a44", "#ff4a12", "#ffd080"], mode: "projectile", dur: 420, size: 14, impact: "blood",  ring: "rgba(255,90,40,.7)" },
  lightning: { core: "#d8f0ff", glow: "rgba(140,210,255,.95)", trail: ["#ffffff", "#7ec8ff", "#b8e8ff"], mode: "beam",      dur: 260, size: 10, impact: "spark",  ring: "rgba(180,230,255,.8)" },
  arcane:    { core: "#c88cff", glow: "rgba(170,110,255,.9)",  trail: ["#e8c8ff", "#9b5dff", "#f0d8ff"], mode: "projectile", dur: 380, size: 12, impact: "spark",  ring: "rgba(180,120,255,.75)" },
  nature:    { core: "#5ff09a", glow: "rgba(80,240,150,.9)",   trail: ["#a8ffcf", "#2ecf74", "#d8ffe9"], mode: "beam",      dur: 520, size: 11, impact: "heal",   ring: "rgba(90,255,160,.7)" },
  holy:      { core: "#ffe9a0", glow: "rgba(255,230,150,.9)",  trail: ["#fff8d8", "#ffd75e", "#fffef5"], mode: "beam",      dur: 480, size: 11, impact: "buff",   ring: "rgba(255,220,120,.75)" },
  frost:     { core: "#b8e8ff", glow: "rgba(160,220,255,.9)",  trail: ["#e8f8ff", "#7ec8ff", "#ffffff"], mode: "projectile", dur: 360, size: 11, impact: "spark",  ring: "rgba(180,230,255,.7)" },
  steel:     { core: "#c5d4ea", glow: "rgba(150,175,210,.9)",  trail: ["#e3eaf5", "#8fa3c0", "#b9c6da"], mode: "beam",      dur: 440, size: 10, impact: "armor",  ring: "rgba(170,195,230,.75)" },
  shadow:    { core: "#8a5fd8", glow: "rgba(120,70,200,.85)",  trail: ["#b08cff", "#4a2878", "#d8b8ff"], mode: "projectile", dur: 400, size: 12, impact: "death",  ring: "rgba(120,70,200,.65)" },
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

  const orb = document.createElement("div");
  orb.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${spec.size}px;height:${spec.size}px;margin:-${spec.size / 2}px 0 0 -${spec.size / 2}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${spec.core},${spec.trail[1]});box-shadow:0 0 16px ${spec.glow},0 0 28px ${spec.glow};pointer-events:none;z-index:2;`;
  layer.appendChild(orb);

  const midX = dx * 0.5;
  const midY = dy * 0.5 + arc;
  const anim = orb.animate(
    [
      { transform: "translate(0,0) scale(0.6)", opacity: 0.2 },
      { transform: `translate(${midX * 0.55}px,${midY * 0.55}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px,${dy}px) scale(0.85)`, opacity: 0.95 },
    ],
    { duration: spec.dur, easing: "cubic-bezier(.25,.1,.2,1)", fill: "forwards" },
  );

  const trailCount = 8;
  for (let i = 1; i <= trailCount; i++) {
    setTimeout(() => {
      const t = i / trailCount;
      const tx = from.x + dx * t + (arc * Math.sin(t * Math.PI)) * 0.15;
      const ty = from.y + dy * t - arc * Math.sin(t * Math.PI);
      spawnTrailParticle(layer, tx, ty, spec.trail[i % spec.trail.length]!, rand(3, 6));
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

  const beam = document.createElement("div");
  beam.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${len}px;height:4px;transform-origin:0 50%;transform:rotate(${ang}deg);background:linear-gradient(90deg,transparent,${spec.glow},${spec.core},${spec.glow},transparent);box-shadow:0 0 12px ${spec.glow};border-radius:4px;pointer-events:none;opacity:0;`;
  layer.appendChild(beam);

  beam.animate(
    [{ opacity: 0, transform: `rotate(${ang}deg) scaleX(0.1)` }, { opacity: 1, transform: `rotate(${ang}deg) scaleX(1)`, offset: 0.25 }, { opacity: 0.85, transform: `rotate(${ang}deg) scaleX(1)`, offset: 0.7 }, { opacity: 0, transform: `rotate(${ang}deg) scaleX(1.05)` }],
    { duration: spec.dur, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => beam.remove();

  if (kind === "lightning") {
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = from.x + dx * t0 + rand(-8, 8);
      const y0 = from.y + dy * t0 + rand(-8, 8);
      const x1 = from.x + dx * t1 + rand(-8, 8);
      const y1 = from.y + dy * t1 + rand(-8, 8);
      const segDx = x1 - x0;
      const segDy = y1 - y0;
      const segLen = Math.hypot(segDx, segDy);
      const segAng = Math.atan2(segDy, segDx) * (180 / Math.PI);
      const seg = document.createElement("div");
      seg.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${segLen}px;height:3px;transform-origin:0 50%;transform:rotate(${segAng}deg);background:${spec.core};box-shadow:0 0 10px ${spec.glow};pointer-events:none;opacity:0;`;
      layer.appendChild(seg);
      seg.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: spec.dur * 0.9, fill: "forwards" }).onfinish = () => seg.remove();
    }
  }

  const sparkN = kind === "nature" || kind === "holy" ? 10 : 6;
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

export function runTravelImpact(layer: HTMLElement, targetId: string, kind: TravelKind, intensity = 1): void {
  const spec = TRAVEL[kind];
  const el = entityElement(targetId);
  if (el) {
    burstAtElement(layer, el, spec.impact, intensity);
    const c = centerOf(el);
    shockwaveAtClient(layer, c.x, c.y, spec.ring, 48);
    return;
  }
  const pos = centerFromSnapshot(targetId);
  if (pos) {
    burstAtClient(layer, pos.x, pos.y, spec.impact, intensity);
    shockwaveAtClient(layer, pos.x, pos.y, spec.ring, 48);
  }
}
