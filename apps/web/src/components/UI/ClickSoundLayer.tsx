"use client";

import { useEffect } from "react";
import { preloadSounds, resolveClickSound, playSound } from "@/lib/sounds";

export default function ClickSoundLayer() {
  useEffect(() => {
    preloadSounds();

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const decision = resolveClickSound(e.target);
      if (decision === "none") return;
      playSound(decision);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
