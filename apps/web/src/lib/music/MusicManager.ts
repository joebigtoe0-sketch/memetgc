"use client";

import { Howl } from "howler";
import {
  FADE_MS,
  DEFAULT_MASTER_VOLUME,
  LOOPING_TRACKS,
  MUSIC_VOLUMES,
  ONE_SHOT_FADE_OUT_MS,
  type MusicTrack,
} from "./constants";

const STORAGE_VOLUME = "music_volume";
const STORAGE_MUTED = "music_muted";
const STORAGE_INITIALIZED = "sound_initialized";

function pickSrc(track: MusicTrack): string {
  const variant = Math.random() < 0.5 ? "" : "_1";
  return `/audio/music/${track}${variant}.mp3`;
}

function readMasterVolume(): number {
  if (typeof window === "undefined") return DEFAULT_MASTER_VOLUME;
  const stored = localStorage.getItem(STORAGE_VOLUME);
  if (stored == null) return DEFAULT_MASTER_VOLUME;
  const n = Number(stored);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : DEFAULT_MASTER_VOLUME;
}

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_MUTED) === "true";
}

class MusicManager {
  private current: Howl | null = null;
  private currentTrack: MusicTrack | null = null;
  private masterVolume = DEFAULT_MASTER_VOLUME;
  private muted = false;
  private unlocked = false;
  private pausedByTab = false;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeInTimer: ReturnType<typeof setTimeout> | null = null;
  private oneShotEndTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private returnAfterOneShot: MusicTrack | null = null;
  private lastAmbient: MusicTrack = "menu";
  private packActive = false;
  private crossfadeGeneration = 0;

  constructor() {
    if (typeof window === "undefined") return;
    this.masterVolume = readMasterVolume();
    this.muted = readMuted();
    this.unlocked = localStorage.getItem(STORAGE_INITIALIZED) === "true";

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pauseForTab();
      else this.resumeFromTab();
    });
  }

  getVolume(): number {
    return this.masterVolume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  getLastAmbient(): MusicTrack {
    return this.lastAmbient;
  }

  enable(): void {
    this.unlocked = true;
    localStorage.setItem(STORAGE_INITIALIZED, "true");
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem(STORAGE_VOLUME, String(Math.round(this.masterVolume * 100)));
    if (this.current && this.currentTrack) {
      this.current.volume(this.effectiveVolume(this.currentTrack));
    }
  }

  mute(): void {
    this.muted = true;
    localStorage.setItem(STORAGE_MUTED, "true");
    if (this.current) this.current.volume(0);
  }

  unmute(): void {
    this.muted = false;
    localStorage.setItem(STORAGE_MUTED, "false");
    if (this.current && this.currentTrack) {
      this.current.volume(this.effectiveVolume(this.currentTrack));
    }
  }

  toggleMute(): boolean {
    if (this.muted) this.unmute();
    else this.mute();
    return this.muted;
  }

  private effectiveVolume(track: MusicTrack): number {
    if (this.muted) return 0;
    return MUSIC_VOLUMES[track] * this.masterVolume;
  }

  private cancelPending(): void {
    this.crossfadeGeneration += 1;
    if (this.fadeOutTimer) clearTimeout(this.fadeOutTimer);
    if (this.fadeInTimer) clearTimeout(this.fadeInTimer);
    if (this.oneShotEndTimer) clearTimeout(this.oneShotEndTimer);
    if (this.pendingStopTimer) clearTimeout(this.pendingStopTimer);
    this.fadeOutTimer = null;
    this.fadeInTimer = null;
    this.oneShotEndTimer = null;
    this.pendingStopTimer = null;
  }

  private rememberAmbient(track: MusicTrack): void {
    if (LOOPING_TRACKS.has(track)) this.lastAmbient = track;
  }

  play(track: MusicTrack): void {
    if (!this.unlocked) return;
    if (this.currentTrack === track && this.current?.playing()) return;
    this.crossfade(track);
  }

  stop(): void {
    if (!this.current) return;
    this.cancelPending();
    const howl = this.current;
    const vol = howl.volume();
    howl.fade(vol, 0, FADE_MS);
    this.pendingStopTimer = setTimeout(() => {
      howl.stop();
      if (this.current === howl) {
        this.current = null;
        this.currentTrack = null;
      }
    }, FADE_MS);
  }

  crossfade(track: MusicTrack): void {
    if (!this.unlocked) return;
    this.cancelPending();
    const generation = this.crossfadeGeneration;

    const targetVol = this.effectiveVolume(track);
    const loop = LOOPING_TRACKS.has(track);
    const prev = this.current;

    if (prev) {
      const prevVol = prev.volume();
      prev.fade(prevVol, 0, FADE_MS);
      this.fadeOutTimer = setTimeout(() => {
        prev.stop();
      }, FADE_MS);
    }

    const howl = new Howl({
      src: [pickSrc(track)],
      loop,
      volume: 0,
      html5: true,
      onend: () => {
        if (!loop && this.current === howl) {
          this.handleOneShotEnded();
        }
      },
    });

    howl.play();
    howl.fade(0, targetVol, FADE_MS);

    this.current = howl;
    this.currentTrack = track;
    this.packActive = track === "pack_opening" || track === "pack_opening_genesis";
    this.rememberAmbient(track);

    this.fadeInTimer = setTimeout(() => {
      if (generation !== this.crossfadeGeneration) return;
    }, FADE_MS);
  }

  private handleOneShotEnded(): void {
    const ret = this.returnAfterOneShot ?? this.lastAmbient;
    this.returnAfterOneShot = null;
    this.packActive = false;
    this.current = null;
    this.currentTrack = null;
    this.crossfade(ret);
  }

  playOneShot(track: MusicTrack, returnTo?: MusicTrack, fadeOutAfterMs = ONE_SHOT_FADE_OUT_MS): void {
    if (!this.unlocked) return;
    this.returnAfterOneShot = returnTo ?? this.lastAmbient;
    this.crossfade(track);

    if (fadeOutAfterMs > 0) {
      this.oneShotEndTimer = setTimeout(() => {
        if (this.currentTrack === track) this.fadeOutOneShot();
      }, fadeOutAfterMs);
    }
  }

  private fadeOutOneShot(): void {
    if (!this.current || !this.currentTrack) return;
    if (LOOPING_TRACKS.has(this.currentTrack)) return;

    const howl = this.current;
    const track = this.currentTrack;
    const vol = howl.volume();
    howl.fade(vol, 0, FADE_MS);
    this.pendingStopTimer = setTimeout(() => {
      howl.stop();
      if (this.currentTrack === track) {
        this.current = null;
        this.currentTrack = null;
        const ret = this.returnAfterOneShot ?? this.lastAmbient;
        this.returnAfterOneShot = null;
        this.packActive = false;
        this.crossfade(ret);
      }
    }, FADE_MS);
  }

  playPackOpening(genesis: boolean, returnTo?: MusicTrack): void {
    const track: MusicTrack = genesis ? "pack_opening_genesis" : "pack_opening";
    this.playOneShot(track, returnTo ?? this.lastAmbient, 0);
  }

  interruptPackOpening(returnTo?: MusicTrack): void {
    if (!this.packActive) return;
    this.returnAfterOneShot = returnTo ?? this.lastAmbient;
    this.fadeOutOneShot();
  }

  playVictory(): void {
    this.playOneShot("victory", "menu", ONE_SHOT_FADE_OUT_MS);
  }

  playDefeat(): void {
    this.playOneShot("defeat", "menu", ONE_SHOT_FADE_OUT_MS);
  }

  private pauseForTab(): void {
    if (!this.current?.playing()) return;
    this.pausedByTab = true;
    this.current.pause();
  }

  private resumeFromTab(): void {
    if (!this.pausedByTab || !this.current) return;
    this.pausedByTab = false;
    if (this.unlocked) this.current.play();
  }

  /** Fade out when leaving a screen mid-track (navigation). */
  leaveScreen(): void {
    if (this.packActive) {
      this.interruptPackOpening();
      return;
    }
    if (this.current && this.currentTrack && LOOPING_TRACKS.has(this.currentTrack)) {
      this.stop();
    }
  }
}

export const musicManager = new MusicManager();
