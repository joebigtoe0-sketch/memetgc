"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Logo from "@/components/Brand/Logo";
import { BRAND, clearAuthTokens, isAutoUsername } from "@/lib/brand";

type Step = "connect" | "sign" | "username";

export default function AuthModal() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { setAuth, setWallet, setHasUsername, token, hasUsername } = useAuthStore();

  const [step, setStep] = useState<Step>("connect");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [username, setUsernameInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const wallet = publicKey?.toBase58() ?? null;

  // If we already hold a token but never picked a username, jump to that step.
  useEffect(() => {
    if (token && !hasUsername) setStep("username");
  }, [token, hasUsername]);

  // Once a wallet connects, move to the sign step.
  useEffect(() => {
    if (connected && wallet && step === "connect" && !token) setStep("sign");
  }, [connected, wallet, step, token]);

  const signIn = useCallback(async () => {
    if (!wallet || !signMessage) {
      setError("Your wallet doesn't support message signing.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { message } = await api.post<{ message: string }>("/api/auth/nonce", { walletAddress: wallet });
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);
      const res = await api.post<{ token: string; userId: string; username: string; hasUsername: boolean }>(
        "/api/auth/verify",
        { walletAddress: wallet, signature }
      );
      setWallet(wallet);
      if (res.hasUsername) {
        setHasUsername(true);
        setAuth(res.token, res.userId, res.username);
      } else {
        // Persist token for the /username call, but don't enter the app yet.
        if (typeof window !== "undefined") {
          localStorage.setItem(BRAND.authTokenKey, res.token);
          for (const key of BRAND.legacyAuthTokenKeys) {
            localStorage.removeItem(key);
          }
        }
        setPendingToken(res.token);
        setPendingUserId(res.userId);
        setUsernameInput(isAutoUsername(res.username) ? "" : res.username);
        setStep("username");
      }
    } catch (e) {
      setError((e as Error).message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [wallet, signMessage, setAuth, setWallet, setHasUsername]);

  async function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; username: string }>("/api/auth/username", { username });
      const uid = pendingUserId ?? useAuthStore.getState().userId ?? "";
      setHasUsername(true);
      setAuth(res.token, uid, res.username);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't set username");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setError("");
    setPendingToken(null);
    clearAuthTokens();
    disconnect().catch(() => {});
    setStep("connect");
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)",
        fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 85% -10%,rgba(247,147,26,.08),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.08),transparent 55%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 400, padding: 34, borderRadius: 20, background: "linear-gradient(150deg,rgba(255,255,255,.05),rgba(14,18,28,.85))", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Logo size={56} />
          </div>
          <h1 style={{ font: `900 26px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>{BRAND.fullName}</h1>
          <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", letterSpacing: ".3px", marginTop: 8, fontStyle: "italic" }}>{BRAND.tagline}</p>
        </div>

        {step === "username" ? (
          <form onSubmit={submitUsername}>
            <p style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>
              Wallet connected. Choose a username to finish setting up your account.
            </p>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Pick a username"
              maxLength={20}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", color: "#f1f4f9", font: `600 14px var(--font-archivo,'Archivo',sans-serif)`, outline: "none" }}
            />
            <p style={{ font: `500 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", marginTop: 8 }}>3–20 chars · letters, numbers, underscore</p>
            {error && <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff6b6b", marginTop: 10 }}>{error}</p>}
            <button type="submit" disabled={loading || username.length < 3} style={primaryBtn(loading || username.length < 3)}>
              {loading ? "Saving…" : `Enter ${BRAND.shortName}`}
            </button>
          </form>
        ) : step === "sign" ? (
          <>
            <p style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", textAlign: "center", marginBottom: 8, lineHeight: 1.5 }}>
              Connected as
            </p>
            <div style={{ textAlign: "center", font: `700 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#19e08a", marginBottom: 18 }}>
              {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-6)}` : ""}
            </div>
            <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", textAlign: "center", marginBottom: 18, lineHeight: 1.5 }}>
              Sign a quick message to prove you own this wallet. This is free and won&apos;t cost any gas.
            </p>
            {error && <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff6b6b", marginBottom: 10, textAlign: "center" }}>{error}</p>}
            <button onClick={signIn} disabled={loading} style={primaryBtn(loading)}>
              {loading ? "Waiting for signature…" : "Sign message & enter"}
            </button>
            <button onClick={reset} style={ghostBtn}>Use a different wallet</button>
          </>
        ) : (
          <>
            <p style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              Connect your Solana wallet to play. Your wallet is your account — no email or password needed.
            </p>
            <button onClick={() => setVisible(true)} style={primaryBtn(false)}>
              Connect Wallet
            </button>
            <p style={{ font: `500 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478", textAlign: "center", marginTop: 16 }}>
              New players get 3 starter decks + 5 booster packs.
            </p>
            <a href="/docs" style={{ display: "block", textAlign: "center", marginTop: 14, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#9aa3b4", textDecoration: "none" }}>
              New to the game? Read the guide →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 11, border: "none",
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
