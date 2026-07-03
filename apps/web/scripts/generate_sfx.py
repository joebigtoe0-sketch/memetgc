"""
Procedural SFX generator for the trading card game.

Synthesizes a full set of polished game sound effects (WAV, 44.1kHz, 16-bit)
into apps/web/public/audio/. Everything is generated from scratch with proper
envelopes, filtering and light reverb so the results sound intentional rather
than like generic beeps.

Run:  python apps/web/scripts/generate_sfx.py
"""

import os
import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")

rng = np.random.default_rng(1234)


# ─── core helpers ─────────────────────────────────────────────────────────

def T(dur):
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def sine(freq, t, phase=0.0):
    return np.sin(2 * np.pi * freq * t + phase)


def noise(n):
    return rng.standard_normal(n)


def fade(x, fin=0.004, fout=0.03):
    y = x.astype(np.float64).copy()
    ai, ao = int(SR * fin), int(SR * fout)
    if ai > 0:
        y[:ai] *= np.linspace(0, 1, ai)
    if ao > 0:
        y[-ao:] *= np.linspace(1, 0, ao) ** 1.5
    return y


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak


def lp(x, cutoff):
    """One-pole low-pass. cutoff may be scalar or per-sample array."""
    cutoff = np.clip(cutoff, 20, SR / 2 - 100)
    if np.isscalar(cutoff):
        b, a = signal.butter(2, cutoff / (SR / 2), btype="low")
        return signal.lfilter(b, a, x)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x, dtype=np.float64)
    prev = 0.0
    for i in range(len(x)):
        prev = (1 - a[i]) * x[i] + a[i] * prev
        y[i] = prev
    return y


def hp(x, cutoff):
    b, a = signal.butter(2, cutoff / (SR / 2), btype="high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi):
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return signal.lfilter(b, a, x)


def reverb(x, mix=0.22, dur=0.5, decay=0.14, dark=4500):
    n = int(SR * dur)
    ir = noise(n) * np.exp(-np.linspace(0, dur, n) / decay)
    ir = lp(ir, dark)
    ir[0] += 1.0
    wet = signal.fftconvolve(x, ir)[: len(x)]
    wet = norm(wet, np.max(np.abs(x)) + 1e-9)
    return (1 - mix) * x + mix * wet


def place(buf, snd, start):
    i = int(SR * start)
    n = min(len(snd), len(buf) - i)
    if n > 0:
        buf[i:i + n] += snd[:n]


# ─── instrument-ish building blocks ───────────────────────────────────────

def bell(freq, dur, decay=None, detune=0.0, bright=1.0):
    t = T(dur)
    if decay is None:
        decay = dur * 0.4
    partials = [(1.0, 1.0), (2.01, 0.55 * bright), (3.01, 0.28 * bright),
                (4.3, 0.14 * bright), (5.4, 0.08 * bright)]
    x = np.zeros_like(t)
    for mult, amp in partials:
        d = decay / (mult ** 0.6)
        x += amp * np.sin(2 * np.pi * freq * mult * (1 + detune) * t) * np.exp(-t / d)
    x *= np.clip(t / 0.002, 0, 1)
    return x


def thump(f0, f1, dur, decay):
    t = T(dur)
    f = np.geomspace(max(f0, 1), max(f1, 1), len(t))
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t / decay)


def whoosh(dur, f0, f1, seed=0, swell=True):
    r = np.random.default_rng(seed)
    t = T(dur)
    n = r.standard_normal(len(t))
    cutoff = np.geomspace(f0, f1, len(t))
    y = lp(n, cutoff)
    y = hp(y, 300)
    amp = np.sin(np.pi * np.linspace(0, 1, len(t))) if swell else np.exp(-t / (dur * 0.4))
    return y * amp


def crack(dur=0.06, cut=3000, seed=0):
    r = np.random.default_rng(seed)
    t = T(dur)
    y = hp(r.standard_normal(len(t)), cut)
    return y * np.exp(-t / (dur * 0.25))


# note frequencies
N = {
    "A3": 220.00, "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23,
    "G4": 392.00, "A4": 440.00, "B4": 493.88, "C5": 523.25, "D5": 587.33,
    "E5": 659.25, "F5": 698.46, "G5": 783.99, "A5": 880.00, "C6": 1046.50,
    "E6": 1318.51, "G6": 1567.98, "D3": 146.83, "F3": 174.61, "A2": 110.00,
}


# ─── individual sound designs ─────────────────────────────────────────────

def s_click():
    t = T(0.05)
    body = sine(1800, t) * np.exp(-t / 0.012)
    tick = hp(noise(len(t)), 4000) * np.exp(-t / 0.006) * 0.6
    return norm(fade(body + tick, 0.001, 0.02), 0.75)


def s_click_empty():
    t = T(0.045)
    body = sine(700, t) * np.exp(-t / 0.014)
    tick = lp(noise(len(t)), 2200) * np.exp(-t / 0.008) * 0.4
    return norm(fade(body + tick, 0.001, 0.02), 0.5)


def s_hover():
    t = T(0.07)
    air = bp(noise(len(t)), 2500, 7000) * np.exp(-t / 0.02)
    tone = sine(2600, t) * np.exp(-t / 0.03) * 0.25
    return norm(fade(air * 0.5 + tone, 0.002, 0.03), 0.4)


def s_play_card():
    # airy swish that settles with a soft landing
    sw = whoosh(0.34, 7000, 1200, seed=11)
    land = thump(160, 90, 0.12, 0.05) * 0.5
    buf = np.zeros(int(SR * 0.40))
    place(buf, sw, 0.0)
    place(buf, land, 0.24)
    return norm(fade(buf, 0.003, 0.05), 0.85)


def s_draw_card():
    sw = whoosh(0.22, 9000, 2600, seed=7)
    tick = crack(0.03, 5000, seed=3) * 0.3
    buf = np.zeros(int(SR * 0.24))
    place(buf, sw, 0.0)
    place(buf, tick, 0.16)
    return norm(fade(buf, 0.003, 0.04), 0.7)


def s_summon():
    sw = whoosh(0.30, 6000, 1400, seed=21) * 0.8
    # warm appearing chord (perfect fifth + octave)
    dur = 0.5
    t = T(dur)
    swell = np.clip(t / 0.08, 0, 1) * np.exp(-t / 0.4)
    chord = (sine(N["C4"], t) + 0.7 * sine(N["G4"], t) + 0.5 * sine(N["C5"], t)) * swell
    chord = lp(chord, 3200)
    buf = np.zeros(int(SR * 0.55))
    place(buf, sw, 0.0)
    place(buf, chord * 0.5, 0.06)
    return norm(fade(reverb(buf, 0.15, 0.35), 0.004, 0.06), 0.85)


def s_attack():
    # quick aggressive swing + metallic clash
    sw = whoosh(0.16, 9000, 2000, seed=42, swell=False)
    t = T(0.18)
    clash = np.zeros_like(t)
    for f, a in [(2400, 1.0), (3170, 0.7), (4300, 0.5), (5600, 0.3)]:
        clash += a * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.05)
    clash = clash * np.clip(t / 0.001, 0, 1)
    imp = thump(220, 110, 0.10, 0.04)
    buf = np.zeros(int(SR * 0.30))
    place(buf, sw * 0.7, 0.0)
    place(buf, clash * 0.6, 0.09)
    place(buf, imp * 0.6, 0.10)
    return norm(fade(buf, 0.002, 0.05), 0.85)


def s_deal_damage():
    imp = thump(180, 95, 0.16, 0.06)
    cr = crack(0.05, 2500, seed=5) * 0.6
    buf = np.zeros(int(SR * 0.22))
    place(buf, imp, 0.0)
    place(buf, cr, 0.0)
    return norm(fade(buf, 0.001, 0.05), 0.9)


def s_take_damage():
    imp = thump(130, 70, 0.22, 0.09)
    cr = bp(noise(int(SR * 0.12)), 400, 2000) * np.exp(-T(0.12) / 0.05) * 0.6
    low = thump(90, 55, 0.18, 0.1) * 0.5
    buf = np.zeros(int(SR * 0.26))
    place(buf, imp, 0.0)
    place(buf, low, 0.0)
    place(buf, cr, 0.0)
    return norm(fade(buf, 0.001, 0.06), 0.92)


def s_destroy():
    # impact then crumbling debris
    imp = thump(160, 60, 0.14, 0.06)
    dur = 0.55
    buf = np.zeros(int(SR * dur))
    place(buf, imp, 0.0)
    body = bp(noise(int(SR * 0.4)), 300, 4000) * np.exp(-T(0.4) / 0.16)
    place(buf, body * 0.5, 0.02)
    for k in range(7):
        st = 0.06 + k * 0.05 + rng.random() * 0.02
        place(buf, crack(0.04, 3000 + rng.random() * 3000, seed=100 + k) * (0.35 * (1 - k / 8)), st)
    desc = thump(400, 120, 0.3, 0.12) * 0.3
    place(buf, desc, 0.03)
    return norm(fade(reverb(buf, 0.18, 0.4), 0.002, 0.08), 0.88)


def s_heal():
    dur = 0.75
    buf = np.zeros(int(SR * dur))
    for i, nm in enumerate(["C5", "E5", "G5"]):
        place(buf, bell(N[nm], 0.6, decay=0.32, bright=0.8), i * 0.07)
    shimmer = bell(N["C6"], 0.6, decay=0.3, bright=1.0) * 0.35
    place(buf, shimmer, 0.16)
    return norm(fade(reverb(buf, 0.28, 0.5, 0.18), 0.004, 0.1), 0.75)


def s_coin():
    dur = 0.4
    t = T(dur)
    x = np.zeros_like(t)
    for f, a in [(3800, 1.0), (5250, 0.6), (6900, 0.4), (9100, 0.2)]:
        x += a * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.14)
    trem = 1 + 0.15 * np.sin(2 * np.pi * 42 * t)  # spin flutter
    x *= trem * np.clip(t / 0.001, 0, 1)
    return norm(fade(reverb(x, 0.15, 0.25), 0.001, 0.05), 0.7)


def s_shuffle():
    dur = 0.5
    buf = np.zeros(int(SR * dur))
    for k in range(7):
        st = k * 0.06 + rng.random() * 0.015
        rip = bp(noise(int(SR * 0.05)), 1200 + rng.random() * 1500, 6000) * np.exp(-T(0.05) / 0.02)
        place(buf, rip * (0.5 + rng.random() * 0.3), st)
    return norm(fade(buf, 0.003, 0.05), 0.6)


def s_hero_power():
    dur = 0.85
    buf = np.zeros(int(SR * dur))
    t = T(dur)
    # low arcane drone with vibrato
    vib = 1 + 0.01 * np.sin(2 * np.pi * 6 * t)
    drone = (sine(N["C4"] * vib, t) + 0.5 * sine(N["G4"] * vib, t)) * np.exp(-t / 0.5)
    buf += lp(drone, 2500) * 0.4
    # rising sparkle arpeggio
    for i, nm in enumerate(["C5", "E5", "G5", "C6", "E6"]):
        place(buf, bell(N[nm], 0.5, decay=0.22, bright=1.1) * (0.55 - i * 0.05), 0.05 + i * 0.06)
    return norm(fade(reverb(buf, 0.3, 0.55, 0.2), 0.005, 0.12), 0.8)


def s_turn_start():
    dur = 0.7
    buf = np.zeros(int(SR * dur))
    place(buf, bell(N["G4"], 0.5, decay=0.3, bright=0.7), 0.0)
    place(buf, bell(N["C5"], 0.6, decay=0.36, bright=0.8), 0.12)
    place(buf, bell(N["E5"], 0.5, decay=0.3, bright=0.6) * 0.5, 0.12)
    return norm(fade(reverb(buf, 0.25, 0.45, 0.16), 0.004, 0.1), 0.62)


def s_no_mana():
    dur = 0.28
    t = T(dur)
    tone = sine(180, t) * np.exp(-t / 0.1)
    tone += sine(140, t) * np.exp(-t / 0.12) * 0.6
    tone = lp(tone, 900)
    return norm(fade(tone, 0.004, 0.06), 0.55)


def s_denied():
    dur = 0.32
    t = T(dur)
    f = np.geomspace(320, 150, len(t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = signal.sawtooth(ph) * np.exp(-t / 0.14)
    saw = lp(saw, 1600)
    return norm(fade(saw * 0.8, 0.003, 0.06), 0.6)


def s_win():
    dur = 1.7
    buf = np.zeros(int(SR * dur))
    seq = [("C5", 0.0), ("E5", 0.14), ("G5", 0.28), ("C6", 0.42)]
    for nm, st in seq:
        place(buf, bell(N[nm], 0.9, decay=0.5, bright=1.0), st)
    # sustained triumphant chord
    for nm in ["C5", "E5", "G5", "C6"]:
        place(buf, bell(N[nm], 1.1, decay=0.6, bright=0.7) * 0.5, 0.55)
    place(buf, bell(N["G6"], 0.8, decay=0.4, bright=1.2) * 0.3, 0.6)
    return norm(fade(reverb(buf, 0.3, 0.7, 0.22), 0.005, 0.2), 0.9)


def s_lose():
    dur = 1.7
    buf = np.zeros(int(SR * dur))
    seq = [("A4", 0.0), ("F4", 0.24), ("D4", 0.48), ("A3", 0.72)]
    for nm, st in seq:
        place(buf, bell(N[nm], 1.0, decay=0.55, bright=0.5), st)
    # low somber bed
    for nm in ["D3", "A3", "F3"]:
        place(buf, bell(N[nm], 1.2, decay=0.7, bright=0.35) * 0.4, 0.75)
    return norm(fade(reverb(buf, 0.32, 0.8, 0.28, dark=2500), 0.006, 0.25), 0.85)


SOUNDS = {
    "click": s_click,
    "click_empty": s_click_empty,
    "hover": s_hover,
    "play_card": s_play_card,
    "draw_card": s_draw_card,
    "summon": s_summon,
    "attack": s_attack,
    "deal_damage": s_deal_damage,
    "take_damage": s_take_damage,
    "destroy": s_destroy,
    "heal": s_heal,
    "coin": s_coin,
    "shuffle": s_shuffle,
    "hero_power": s_hero_power,
    "turn_start": s_turn_start,
    "no_mana": s_no_mana,
    "denied": s_denied,
    "win": s_win,
    "lose": s_lose,
}


def write_wav(path, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767).astype(np.int16)
    from wave import open as wopen
    with wopen(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SOUNDS.items():
        x = fn()
        path = os.path.abspath(os.path.join(OUT, f"{name}.wav"))
        write_wav(path, x)
        print(f"  {name:14s} {len(x)/SR:5.2f}s  ->  {path}")
    print(f"\nGenerated {len(SOUNDS)} sounds into {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
