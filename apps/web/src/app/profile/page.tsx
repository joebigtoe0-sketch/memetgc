"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";

interface Profile {
  fragments: number; rankTier: string; rankStars: number; rankPoints: number;
  seasonWins: number; seasonLosses: number; winStreak?: number;
}
const TIER_COLOR: Record<string, string> = { bronze: "#c8843c", silver: "#cfd6e0", gold: "#e7c768", platinum: "#7ad6ff", diamond: "#b58bff", degen: "#ff5fae" };

export default function ProfilePage() {
  const { token, username, logout } = useAuthStore();
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => { if (token) api.get<Profile>("/api/economy/profile").then(setP).catch(() => {}); }, [token]);
  if (!token) return <AuthModal />;

  const wins = p?.seasonWins ?? 0, losses = p?.seasonLosses ?? 0, games = wins + losses;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const tier = p?.rankTier ?? "bronze";
  const tc = TIER_COLOR[tier] ?? "#e7c768";

  const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div style={{ borderRadius: 14, padding: 20, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ font: `900 28px var(--font-mono,'JetBrains Mono',monospace)`, color: color ?? "#f3e8cc" }}>{value}</div>
      <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px", marginTop: 8 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px" }}>
        <button onClick={() => router.push("/")} style={{ cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>‹ Back</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Profile</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 26px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: 22, borderRadius: 16, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: `1px solid ${tc}44`, maxWidth: 720 }}>
          <div style={{ width: 70, height: 70, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,#243042,#12161f)", border: `2px solid ${tc}`, font: `900 30px var(--font-cinzel,'Cinzel',serif)`, color: tc }}>{(username ?? "?")[0]?.toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#fff" }}>{username}</div>
            <div style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: tc, marginTop: 4, textTransform: "uppercase" }}>{tier} · {p?.rankPoints ?? 0} pts</div>
          </div>
          <button onClick={logout} style={{ cursor: "pointer", padding: "10px 18px", borderRadius: 10, background: "rgba(255,90,90,.08)", border: "1px solid rgba(255,90,90,.3)", color: "#ff8a8a", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>Logout</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, marginTop: 16, maxWidth: 720 }}>
          <Stat label="WIN RATE" value={`${winrate}%`} color="#19e08a" />
          <Stat label="WIN STREAK" value={p?.winStreak ?? 0} />
          <Stat label="WINS" value={wins} color="#7ad6ff" />
          <Stat label="LOSSES" value={losses} color="#ff8f7e" />
          <Stat label="GAMES" value={games} />
          <Stat label="FRAGMENTS" value={(p?.fragments ?? 0).toLocaleString()} color="#7b8cf4" />
        </div>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
