"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { musicManager } from "@/lib/music/MusicManager";
import type { MusicTrack } from "@/lib/music/constants";

const COLLECTION_ROUTES = new Set(["/collection", "/deck-builder"]);
const GAME_ROUTE = /^\/game\//;

function ambientForPath(pathname: string): MusicTrack {
  if (COLLECTION_ROUTES.has(pathname)) return "collection";
  return "menu";
}

export function useRouteMusic(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!musicManager.isUnlocked()) return;
    if (GAME_ROUTE.test(pathname)) return;

    const track = ambientForPath(pathname);
    musicManager.play(track);
  }, [pathname]);
}

export function useMusicUnlock(): void {
  useEffect(() => {
    function onFirstInteraction() {
      if (musicManager.isUnlocked()) return;
      musicManager.enable();
      const path = window.location.pathname;
      if (!GAME_ROUTE.test(path)) {
        musicManager.play(ambientForPath(path));
      }
      window.removeEventListener("pointerdown", onFirstInteraction, true);
    }

    if (!musicManager.isUnlocked()) {
      window.addEventListener("pointerdown", onFirstInteraction, true);
    }

    return () => window.removeEventListener("pointerdown", onFirstInteraction, true);
  }, []);
}
