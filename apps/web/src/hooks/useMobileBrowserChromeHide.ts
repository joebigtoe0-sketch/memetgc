"use client";

import { useEffect } from "react";

/**
 * On mobile browsers, a tiny scrollable shell lets downward swipes collapse
 * the address bar without requiring the native Fullscreen API.
 */
export function useMobileBrowserChromeHide(shellId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const shell = document.getElementById(shellId);
    if (!shell) return;

    const kick = () => {
      shell.scrollTop = 1;
    };
    kick();
    requestAnimationFrame(kick);

    let lastY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      const dy = lastY - y;
      if (dy > 8 && shell.scrollTop < 3) {
        shell.scrollTop = Math.min(3, shell.scrollTop + dy * 0.35);
      }
      lastY = y;
    };

    shell.addEventListener("touchstart", onTouchStart, { passive: true });
    shell.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    return () => {
      shell.removeEventListener("touchstart", onTouchStart);
      shell.removeEventListener("touchmove", onTouchMove, true);
      shell.scrollTop = 0;
    };
  }, [shellId, enabled]);
}
