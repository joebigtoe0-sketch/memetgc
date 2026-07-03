"use client";

/**
 * Client-side flag marking the current game as the guided tutorial.
 * Set when the tutorial queue is joined, survives page refreshes
 * (sessionStorage), and is cleared when a normal game starts or the
 * tutorial finishes.
 */
const TUTORIAL_FLAG = "memetgc_tutorial_game";

export function setTutorialGame(): void {
  try { sessionStorage.setItem(TUTORIAL_FLAG, "1"); } catch { /* ignore */ }
}

export function clearTutorialGame(): void {
  try { sessionStorage.removeItem(TUTORIAL_FLAG); } catch { /* ignore */ }
}

export function isTutorialGame(): boolean {
  try { return sessionStorage.getItem(TUTORIAL_FLAG) === "1"; } catch { return false; }
}
