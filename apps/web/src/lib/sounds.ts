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

/** All SFX file paths (for bulk preloading). */
export const SOUND_PATHS: Record<SoundId, string> = PATHS;

const pool = new Map<SoundId, HTMLAudioElement>();
let enabled = true;

const STORAGE_SFX_VOLUME = "sfx_volume";
const DEFAULT_SFX_VOLUME = 0.65;

function readSfxVolume(): number {
  if (typeof window === "undefined") return DEFAULT_SFX_VOLUME;
  const stored = localStorage.getItem(STORAGE_SFX_VOLUME);
  if (stored == null) return DEFAULT_SFX_VOLUME;
  const n = Number(stored);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : DEFAULT_SFX_VOLUME;
}

let masterVolume = typeof window !== "undefined" ? readSfxVolume() : DEFAULT_SFX_VOLUME;

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

export function getMasterVolume(): number {
  return masterVolume;
}

export function setMasterVolume(vol: number): void {
  masterVolume = Math.max(0, Math.min(1, vol));
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_SFX_VOLUME, String(Math.round(masterVolume * 100)));
  }
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

/** Preload all SFX and wait until each clip is ready to play. */
export function preloadSoundsAsync(onEach?: () => void): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const ids = Object.keys(PATHS) as SoundId[];
  return Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve) => {
          try {
            const audio = baseAudio(id);
            const finish = () => {
              onEach?.();
              resolve();
            };
            if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
              finish();
              return;
            }
            audio.addEventListener("canplaythrough", finish, { once: true });
            audio.addEventListener("error", finish, { once: true });
            audio.load();
          } catch {
            onEach?.();
            resolve();
          }
        }),
    ),
  ).then(() => undefined);
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

export type ClickSoundDecision = "click" | "clickempty" | "none";

const SKIP_CLICK_SELECTOR =
  "[data-sound-skip-click], [data-sound-hand-card], [data-sound-action]";
const UI_CLICK_SELECTOR =
  "button, a[href], input, select, textarea, [role='button'], [role='tab'], [role='menuitem']";

function isDisabledControl(el: HTMLElement): boolean {
  const control = el.closest("button, input, select, textarea") as
    | HTMLButtonElement
    | HTMLInputElement
    | null;
  return !!control?.disabled;
}

/** Decide which global pointer-down click sound to play, if any. */
export function resolveClickSound(target: EventTarget | null): ClickSoundDecision {
  const el = target as HTMLElement | null;
  if (!el) return "clickempty";

  if (el.closest(SKIP_CLICK_SELECTOR)) return "none";

  const ui = el.closest(UI_CLICK_SELECTOR);
  if (ui) {
    if (isDisabledControl(el)) return "none";
    return "click";
  }

  if (el.closest("label")) return "click";

  return "clickempty";
}

/** @deprecated Use resolveClickSound instead. */
export function isUiClickTarget(target: EventTarget | null): boolean {
  return resolveClickSound(target) === "click";
}
