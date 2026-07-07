"use client";

/**
 * Procedurally synthesized elemental combat stingers via the Web Audio API.
 * No dedicated per-element .wav assets exist, so these are generated at
 * runtime (oscillators + filtered noise) and layered on top of the base
 * hit/heal/destroy sounds in sounds.ts. Respects the same mute + volume
 * settings as sounds.ts.
 */

import { getMasterVolume, isSoundEnabled } from "./sounds";

export type SynthKind =
  | "zap"
  | "whoosh"
  | "fireImpact"
  | "iceShatter"
  | "arcaneChime"
  | "natureChime"
  | "holyShimmer"
  | "shadowHit"
  | "steelClang";

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call on the first user gesture so playback isn't blocked by autoplay policy. */
export function primeSynthAudio(): void {
  const c = getContext();
  if (c && c.state === "suspended") {
    void c.resume().catch(() => {});
  }
}

function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const len = c.sampleRate * 1.5;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function noiseSource(c: AudioContext): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer(c);
  src.loop = true;
  return src;
}

/** Linear-attack, exponential-decay envelope applied to a gain node. */
function envelope(g: GainNode, t0: number, attack: number, decay: number, peak: number): void {
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function makeMaster(c: AudioContext, volume: number): GainNode {
  const g = c.createGain();
  g.gain.value = Math.max(0, Math.min(1, getMasterVolume() * volume));
  g.connect(c.destination);
  return g;
}

function zap(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  // Bright downward pitch sweep — the "crack".
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(1900, t0);
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.14);
  const g = c.createGain();
  envelope(g, t0, 0.002, 0.14, 0.7);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.16);

  // Filtered noise burst for texture.
  const n = noiseSource(c);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2200;
  const ng = c.createGain();
  envelope(ng, t0, 0.001, 0.09, 0.5);
  n.connect(hp).connect(ng).connect(out);
  n.start(t0);
  n.stop(t0 + 0.1);

  // Staccato crackle ticks.
  for (let i = 0; i < 3; i++) {
    const dt = t0 + 0.02 + Math.random() * 0.12;
    const t = noiseSource(c);
    const tg = c.createGain();
    envelope(tg, dt, 0.001, 0.02, 0.35);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2500 + Math.random() * 2000;
    t.connect(bp).connect(tg).connect(out);
    t.start(dt);
    t.stop(dt + 0.03);
  }
}

function whoosh(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const n = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(280, t0);
  bp.frequency.linearRampToValueAtTime(1300, t0 + 0.16);
  bp.frequency.linearRampToValueAtTime(350, t0 + 0.36);
  const g = c.createGain();
  envelope(g, t0, 0.05, 0.32, 0.55);
  n.connect(bp).connect(g).connect(out);
  n.start(t0);
  n.stop(t0 + 0.4);

  const rumble = c.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = 60;
  const rg = c.createGain();
  envelope(rg, t0, 0.06, 0.3, 0.3);
  rumble.connect(rg).connect(out);
  rumble.start(t0);
  rumble.stop(t0 + 0.36);
}

function fireImpact(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const n = noiseSource(c);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = c.createGain();
  envelope(g, t0, 0.002, 0.16, 0.75);
  n.connect(lp).connect(g).connect(out);
  n.start(t0);
  n.stop(t0 + 0.18);

  const thump = c.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(100, t0);
  thump.frequency.exponentialRampToValueAtTime(48, t0 + 0.2);
  const tg = c.createGain();
  envelope(tg, t0, 0.002, 0.22, 0.8);
  thump.connect(tg).connect(out);
  thump.start(t0);
  thump.stop(t0 + 0.24);
}

function iceShatter(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const pitches = [1900, 1550, 1280, 1020];
  pitches.forEach((freq, i) => {
    const dt = t0 + i * 0.035;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq + (Math.random() * 40 - 20);
    const g = c.createGain();
    envelope(g, dt, 0.001, 0.09, 0.4);
    osc.connect(g).connect(out);
    osc.start(dt);
    osc.stop(dt + 0.11);
  });

  const n = noiseSource(c);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 4000;
  const ng = c.createGain();
  envelope(ng, t0, 0.001, 0.12, 0.25);
  n.connect(hp).connect(ng).connect(out);
  n.start(t0);
  n.stop(t0 + 0.14);
}

/** Cheap shimmer tail via a short feedback delay. */
function attachShimmer(c: AudioContext, input: AudioNode, out: GainNode, mix = 0.3): void {
  const delay = c.createDelay();
  delay.delayTime.value = 0.14;
  const feedback = c.createGain();
  feedback.gain.value = 0.32;
  const wet = c.createGain();
  wet.gain.value = mix;
  input.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(out);
}

function arcaneChime(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const carrier = c.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = 660;
  const mod = c.createOscillator();
  mod.type = "sine";
  mod.frequency.value = 5;
  const modGain = c.createGain();
  modGain.gain.value = 8;
  mod.connect(modGain).connect(carrier.frequency);

  const g = c.createGain();
  envelope(g, t0, 0.01, 0.45, 0.5);
  carrier.connect(g).connect(out);
  attachShimmer(c, g, out, 0.25);

  carrier.start(t0);
  mod.start(t0);
  carrier.stop(t0 + 0.5);
  mod.stop(t0 + 0.5);
}

function natureChime(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const notes = [440, 554, 659];
  notes.forEach((freq, i) => {
    const dt = t0 + i * 0.07;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = c.createGain();
    envelope(g, dt, 0.02, 0.22, 0.4);
    osc.connect(g).connect(out);
    osc.start(dt);
    osc.stop(dt + 0.26);
  });
}

function holyShimmer(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const notes = [330, 415, 494];
  notes.forEach((freq) => {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = c.createGain();
    envelope(g, t0, 0.14, 0.5, 0.28);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.65);
  });
}

function shadowHit(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(190, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.3);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 500;
  const g = c.createGain();
  envelope(g, t0, 0.005, 0.32, 0.65);
  osc.connect(lp).connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.34);
}

function steelClang(c: AudioContext, out: GainNode): void {
  const t0 = c.currentTime;
  [1180, 1206].forEach((freq) => {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 8;
    const g = c.createGain();
    envelope(g, t0, 0.001, 0.22, 0.35);
    osc.connect(bp).connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  });
}

const BUILDERS: Record<SynthKind, (c: AudioContext, out: GainNode) => void> = {
  zap,
  whoosh,
  fireImpact,
  iceShatter,
  arcaneChime,
  natureChime,
  holyShimmer,
  shadowHit,
  steelClang,
};

export function playSynth(kind: SynthKind, volume = 1): void {
  if (!isSoundEnabled()) return;
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().catch(() => {});
  }
  try {
    const out = makeMaster(c, volume);
    BUILDERS[kind](c, out);
  } catch {
    /* ignore synth failures — never block gameplay on audio */
  }
}
