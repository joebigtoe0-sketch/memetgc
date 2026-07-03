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
