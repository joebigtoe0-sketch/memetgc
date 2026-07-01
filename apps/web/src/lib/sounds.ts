export type SoundId =
  | "click"
  | "clickempty"
  | "winGame"
  | "loseGame"
  | "noMana"
  | "denied"
  | "cardHover"
  | "playCard"
  | "dealDamage"
  | "takingDamage"
  | "destroy";

const PATHS: Record<SoundId, string> = {
  click: "/audio/click.wav",
  clickempty: "/audio/clickempty.wav",
  winGame: "/audio/wingame.wav",
  loseGame: "/audio/losegame.wav",
  noMana: "/audio/nomana.wav",
  denied: "/audio/denied.wav",
  cardHover: "/audio/cardhover.mp3",
  playCard: "/audio/Playcard.mp3",
  dealDamage: "/audio/dealdamage.wav",
  takingDamage: "/audio/takingdamage.wav",
  destroy: "/audio/destroy.wav",
};

const pool = new Map<SoundId, HTMLAudioElement>();
let enabled = true;
let masterVolume = 0.65;

function baseAudio(id: SoundId): HTMLAudioElement {
  let audio = pool.get(id);
  if (!audio) {
    audio = new Audio(PATHS[id]);
    audio.preload = "auto";
    pool.set(id, audio);
  }
  return audio;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function setMasterVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol));
}

export function preloadSounds(): void {
  if (typeof window === "undefined") return;
  (Object.keys(PATHS) as SoundId[]).forEach((id) => {
    try {
      baseAudio(id).load();
    } catch {
      /* ignore */
    }
  });
}

export function playSound(id: SoundId, volume = 1): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    const src = baseAudio(id);
    const clip = src.cloneNode(true) as HTMLAudioElement;
    clip.volume = masterVolume * volume;
    void clip.play().catch(() => {});
  } catch {
    /* autoplay policy / missing file */
  }
}

/** True for buttons, links, menus, and explicitly marked click targets. */
export function isUiClickTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.closest("[data-sound-hand-card]")) return false;
  return !!el.closest(
    'button, a[href], input, select, textarea, label, [role="button"], [role="tab"], [role="menuitem"], [data-sound-click]'
  );
}
