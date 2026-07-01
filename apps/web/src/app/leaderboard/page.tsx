"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Logo from "@/components/Brand/Logo";
import { BRAND, formatRankTier } from "@/lib/brand";
import { useIsMobile } from "@/hooks/useViewport";

interface Row {
  position: number;
  username: string;
  rankTier: string;
  rankStars: number;
  rankPoints: number;
  seasonWins: number;
  seasonLosses: number;
  isMemepool: boolean;
}
interface LeaderboardResponse {
  season: { number: number; name: string } | null;
  players: Row[];
}

const TIER_COLOR: Record<string, string> = {
  bronze: "#c8843c", silver: "#cfd6e0", gold: "#e7c768",
  platinum: "#7ad6ff", diamond: "#b58bff", degen: "#ff5fae",
};
const ROMAN = ["", "I", "II", "III", "IV", "V"];

export default function LeaderboardPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { username } = useAuthStore();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const gridCols = isMobile ? "40px 1fr 66px 58px" : "56px 1fr 150px 90px 90px";
  const rowPad = isMobile ? "10px 12px" : "11px 16px";

  useEffect(() => {
    api.get<LeaderboardResponse>("/api/leaderboard")
      .then(setData)
      .catch(() => setData({ season: null, players: [] }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 85% -10%,rgba(247,147,26,.06),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.06),transparent 55%)", pointerEvents: "none" }} />

      <header style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: isMobile ? "12px 14px" : "14px 72px 14px 22px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(8,11,18,.55)", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={34} />
          <div>
            <div style={{ font: `900 16px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>LEADERBOARD</div>
            <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a", letterSpacing: "1.5px", marginTop: 3 }}>
              {data?.season ? `SEASON ${data.season.number} · ${data.season.name.toUpperCase()}` : "RANKED LADDER"}
            </div>
          </div>
        </div>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back to game</button>
      </header>

      <main style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "28px clamp(16px, 5vw, 60px) 80px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6", marginBottom: 14 }}>
            TOP 100 · MEMEPOOL RANK = LIVE TOP 100 ABOVE DIAMOND
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6a7488", font: `600 13px var(--font-archivo,'Archivo',sans-serif)` }}>Loading ladder…</div>
          ) : !data || data.players.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6a7488", font: `600 13px var(--font-archivo,'Archivo',sans-serif)` }}>
              No ranked players yet. Be the first to climb — play a Ranked match.
            </div>
          ) : (
            <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: rowPad, background: "rgba(255,255,255,.03)", borderBottom: "1px solid rgba(255,255,255,.08)", font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", color: "#8a93a6", textTransform: "uppercase" }}>
                <div>Rank</div><div>Player</div>{!isMobile && <div>Tier</div>}<div style={{ textAlign: "right" }}>Points</div><div style={{ textAlign: "right" }}>W / L</div>
              </div>
              {data.players.map((r) => {
                const tc = TIER_COLOR[r.rankTier] ?? "#e7c768";
                const isSelf = username && r.username === username;
                const label = r.isMemepool ? formatRankTier("degen") : `${formatRankTier(r.rankTier)} ${ROMAN[Math.max(1, 5 - r.rankStars)] ?? ""}`;
                return (
                  <div key={r.position} style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: rowPad, borderBottom: "1px solid rgba(255,255,255,.04)", background: isSelf ? "rgba(247,147,26,.1)" : r.isMemepool ? "rgba(255,95,174,.06)" : "transparent" }}>
                    <div style={{ font: `800 14px var(--font-mono,'JetBrains Mono',monospace)`, color: r.position <= 3 ? "#e7c768" : "#c2cbdb" }}>#{r.position}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#f1f4f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.username}</span>
                      {r.isMemepool && <span style={{ font: `800 8px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", padding: "2px 6px", borderRadius: 5, color: "#ff5fae", background: "rgba(255,95,174,.14)", border: "1px solid rgba(255,95,174,.4)", flexShrink: 0 }}>{isMobile ? "MP" : "MEMEPOOL"}</span>}
                      {isSelf && <span style={{ font: `800 8px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: ".5px", padding: "2px 6px", borderRadius: 5, color: "#f7931a", background: "rgba(247,147,26,.14)", border: "1px solid rgba(247,147,26,.4)", flexShrink: 0 }}>YOU</span>}
                    </div>
                    {!isMobile && <div style={{ font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: tc }}>{label}</div>}
                    <div style={{ textAlign: "right", font: `800 13px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc" }}>{r.rankPoints.toLocaleString()}</div>
                    <div style={{ textAlign: "right", font: `600 12px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>{r.seasonWins} / {r.seasonLosses}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 22, font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488" }}>
            {BRAND.fullName} — ranked ladder. Climb by winning Ranked matches; points scale with opponent rating.
          </div>
        </div>
      </main>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  cursor: "pointer", padding: "8px 14px", borderRadius: 10,
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
  color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)`,
};
