"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/store/settingsStore";
import SettingsModal from "./SettingsModal";
import SettingsButton from "./SettingsButton";

const BOTTOM_NAV_ROUTES = new Set(["/", "/collection", "/packs", "/shop", "/profile", "/market"]);

export default function GlobalSettingsLayer() {
  const pathname = usePathname();
  const open = useSettingsStore((s) => s.open);
  const closeSettings = useSettingsStore((s) => s.closeSettings);

  const inGame = /^\/game\//.test(pathname);
  const hasBottomNav = BOTTOM_NAV_ROUTES.has(pathname);
  const showFloating = !inGame && !hasBottomNav;

  return (
    <>
      {showFloating && (
        <SettingsButton
          style={{
            position: "fixed",
            top: 14,
            right: 14,
            zIndex: 90,
            background: "rgba(8,11,18,.85)",
            boxShadow: "0 4px 16px rgba(0,0,0,.45)",
          }}
        />
      )}
      {open && <SettingsModal onClose={closeSettings} />}
    </>
  );
}
