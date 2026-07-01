"use client";

import React from "react";
import Logo from "@/components/Brand/Logo";
import { BRAND } from "@/lib/brand";
import { useAuthStore } from "@/store/authStore";

const PUMPFUN_URL =
  process.env.NEXT_PUBLIC_PUMPFUN_URL ??
  "https://pump.fun/coin/4Su8CfXFssGtgNmhhXr9cU4BeQ6oBo5akVG8SHRXpump";

export default function GateScreen() {
  const { tokenBalance, accessRequired, checkAccess, accessChecking, logout } = useAuthStore();
  const missing = Math.max(0, accessRequired - tokenBalance);

  return (
    <div
      style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)",
        fontFamily: "var(--font-archivo,'Archivo',sans-serif)", zIndex: 9999,
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 85% -10%,rgba(247,147,26,.08),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.08),transparent 55%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 430, padding: 34, borderRadius: 20, background: "linear-gradient(150deg,rgba(255,255,255,.05),rgba(14,18,28,.85))", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Logo size={56} />
          </div>
          <h1 style={{ font: `900 24px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>
            Hold {accessRequired.toLocaleString()} {BRAND.ticker} to play
          </h1>
          <p style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 10, lineHeight: 1.5 }}>
            {BRAND.fullName} is token-gated. Your wallet needs at least{" "}
            <strong style={{ color: "#ffe07a" }}>{accessRequired.toLocaleString()} {BRAND.ticker}</strong> to enter.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <StatBox label="Your balance" value={tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} accent="#7cc4ff" />
          <StatBox label="Still needed" value={missing.toLocaleString(undefined, { maximumFractionDigits: 2 })} accent="#ff9a6b" />
        </div>

        <a href={PUMPFUN_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <button style={primaryBtn(false)}>Buy {BRAND.ticker} on pump.fun</button>
        </a>

        <button onClick={() => void checkAccess()} disabled={accessChecking} style={ghostBtn}>
          {accessChecking ? "Checking balance…" : "I've bought — re-check balance"}
        </button>

        <button onClick={logout} style={{ ...ghostBtn, marginTop: 8, borderColor: "transparent", color: "#6a7488" }}>
          Disconnect wallet
        </button>

        <a href="/docs" style={{ display: "block", textAlign: "center", marginTop: 14, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#9aa3b4", textDecoration: "none" }}>
          Read the game guide →
        </a>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ flex: 1, padding: "12px 14px", borderRadius: 12, background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.08)", textAlign: "center" }}>
      <div style={{ font: `500 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ font: `800 18px var(--font-mono,'JetBrains Mono',monospace)`, color: accent, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
    font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00",
    background: "linear-gradient(180deg,#ffe07a,#e0890f)",
    boxShadow: "0 8px 20px rgba(224,137,15,.35), inset 0 1px 0 rgba(255,255,255,.5)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}

const ghostBtn: React.CSSProperties = {
  width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10,
  background: "transparent", border: "1px solid rgba(255,255,255,.12)",
  color: "#8a93a6", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, cursor: "pointer",
};
