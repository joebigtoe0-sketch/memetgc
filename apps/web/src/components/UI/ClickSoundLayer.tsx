"use client";

import { useEffect } from "react";
import { isUiClickTarget, playSound, preloadSounds } from "@/lib/sounds";

export default function ClickSoundLayer() {
  useEffect(() => {
    preloadSounds();

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      playSound(isUiClickTarget(e.target) ? "click" : "clickempty");
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
