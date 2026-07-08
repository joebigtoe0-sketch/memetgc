"use client";

/**
 * Screen-level combat feedback: shake + full-bleed color flash.
 * Both respect prefers-reduced-motion by softening/skipping automatically.
 */

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

let shakeSeq = 0;

/**
 * Brief capped screen shake on the board root. Intensity roughly 0-1.6 (matches
 * the burst intensity scale already used across fx.ts); actual pixel amplitude
 * is capped so even a lethal hit stays readable.
 */
export function shakeElement(el: HTMLElement | null, intensity = 1): void {
  if (!el) return;
  const reduced = prefersReducedMotion();
  const amp = Math.min(20, 4 + intensity * 9) * (reduced ? 0.35 : 1);
  if (amp < 0.5) return;
  const dur = reduced ? 180 : 380;
  const id = ++shakeSeq;
  const frames: Keyframe[] = [{ transform: "translate(0,0)" }];
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const decay = 1 - i / steps;
    frames.push({
      transform: `translate(${(Math.random() * 2 - 1) * amp * decay}px, ${(Math.random() * 2 - 1) * amp * decay}px)`,
    });
  }
  frames.push({ transform: "translate(0,0)" });
  const anim = el.animate(frames, { duration: dur, easing: "ease-out" });
  anim.onfinish = () => {
    if (shakeSeq === id) el.style.transform = "";
  };
}

/** Brief full-bleed color flash overlay (own layer, similar sizing to the fx particle layer). */
export function flashScreen(layer: HTMLElement | null, color: string, opacity = 0.35, duration = 260): void {
  if (!layer) return;
  if (prefersReducedMotion()) opacity *= 0.4;
  const flash = document.createElement("div");
  flash.style.cssText = `position:absolute;inset:0;background:${color};pointer-events:none;opacity:0;`;
  layer.appendChild(flash);
  flash.animate(
    [{ opacity: 0 }, { opacity, offset: 0.25 }, { opacity: 0 }],
    { duration, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => flash.remove();
  setTimeout(() => flash.remove(), duration + 200);
}
