"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function AuthModal() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { username, password } : { username, password, email };
      const res = await api.post<{ token: string; userId: string; username: string }>(endpoint, body);
      setAuth(res.token, res.userId, res.username);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #060810 0%, #0a0d1a 100%)" }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{
          background: "rgba(10,13,26,0.9)",
          border: "1px solid #1a2040",
          boxShadow: "0 0 40px rgba(247,147,26,0.15)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black mb-1" style={{ color: "#f7931a" }}>DEGEN TCG</h1>
          <p className="text-xs" style={{ color: "#4060a0" }}>The Crypto Trading Card Game</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden mb-6" style={{ border: "1px solid #1a2040" }}>
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 text-sm font-bold transition-all"
              style={{
                background: mode === m ? "rgba(247,147,26,0.15)" : "transparent",
                color: mode === m ? "#f7931a" : "#4060a0",
                border: "none",
                cursor: "pointer",
              }}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          {mode === "register" && (
            <input
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
              placeholder="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          )}
          <input
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "#0d1020", border: "1px solid #2a3560", color: "#c8d0e0" }}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <p className="text-xs" style={{ color: "#ff4444" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2.5 rounded-lg font-black text-sm transition-all"
            style={{
              background: "linear-gradient(135deg, #f7931a, #c46800)",
              border: "none",
              color: "#fff",
              cursor: loading || !username || !password ? "not-allowed" : "pointer",
              opacity: loading || !username || !password ? 0.6 : 1,
              boxShadow: "0 0 15px rgba(247,147,26,0.3)",
            }}
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-xs text-center mt-4" style={{ color: "#304060" }}>
          New players get 3 starter decks + 5 booster packs!
        </p>
      </div>
    </div>
  );
}
