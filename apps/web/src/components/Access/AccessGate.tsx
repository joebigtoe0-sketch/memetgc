"use client";

import React, { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import GateScreen from "./GateScreen";
import AssetPreloadGate from "@/components/Loading/AssetPreloadGate";

/**
 * Wraps the whole app. Once a user is authenticated we verify they hold the
 * minimum $MEMPOOL on every app load / login. Under threshold -> the entire app
 * is locked behind the pump.fun gate screen.
 */
export default function AccessGate({ children }: { children: React.ReactNode }) {
  const { token, hasUsername, hasAccess, checkAccess } = useAuthStore();
  const authed = Boolean(token && hasUsername);

  // Re-check on login and on every app load (mount) while authenticated.
  useEffect(() => {
    if (authed) void checkAccess();
  }, [authed, token, checkAccess]);

  // Not signed in yet: let the normal auth flow render.
  if (!authed) return <>{children}</>;

  // Authenticated but not yet verified: brief loading state to avoid flashing
  // the app before the gate decision is made.
  if (hasAccess === null) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#06080d", color: "#6a7488", font: "600 13px var(--font-archivo,'Archivo',sans-serif)" }}>
        Checking wallet…
      </div>
    );
  }

  if (!hasAccess) return <GateScreen />;

  return <AssetPreloadGate>{children}</AssetPreloadGate>;
}
