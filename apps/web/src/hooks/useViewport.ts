"use client";

import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 768;

export interface ViewportSize {
  w: number;
  h: number;
  isPortrait: boolean;
}

function readSize(): ViewportSize {
  if (typeof window === "undefined") return { w: 1280, h: 720, isPortrait: false };
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { w, h, isPortrait: h >= w };
}

/** Live viewport size + orientation. SSR-safe (defaults to a desktop canvas). */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => readSize());

  useEffect(() => {
    const update = () => setSize(readSize());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return size;
}

/** True when the viewport is phone-sized (<= 768px wide). SSR-safe (false). */
export function useIsMobile(maxWidth = MOBILE_MAX_WIDTH): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [maxWidth]);

  return isMobile;
}
