"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useIsMobile } from "@/hooks/useViewport";
import type { AdminEconomyStats, AdminLiveGame } from "@memetgc/types";

interface LiveGamesResponse {
  games: AdminLiveGame[];
  liveTournamentCount: number;
  onlineCount: number;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

export default function AdminPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { token } = useAuthStore();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [data, setData] = useState<LiveGamesResponse | null>(null);
  const [economy, setEconomy] = useState<AdminEconomyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      api.get<LiveGamesResponse>("/api/admin/live-games"),
      api.get<AdminEconomyStats>("/api/admin/stats"),
    ])
      .then(([live, stats]) => {
        setData(live);
        setEconomy(stats);
      })
      .catch(() => {
        setData(null);
        setEconomy(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token) { setAuthorized(false); return; }
    api.get<{ isAdmin: boolean }>("/api/admin/check")
      .then((d) => {
        setAuthorized(d.isAdmin);
        if (d.isAdmin) load();
      })
      .catch(() => setAuthorized(false));
  }, [token, load]);

  useEffect(() => {
    if (!authorized) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [authorized, load]);

  if (authorized === null) {
    return <Shell isMobile={isMobile}><div style={{ color: "#6a7488", textAlign: "center", padding: 40 }}>Checking access…</div></Shell>;
  }
  if (!authorized) {
    return <Shell isMobile={isMobile}><div style={{ color: "#ff8a8a", textAlign: "center", padding: 40 }}>Restricted — admin wallet required</div></Shell>;
  }

  const games = data?.games ?? [];

  return (
    <Shell isMobile={isMobile}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Live games" value={String(games.length)} />
        <StatCard label="Live tournaments" value={String(data?.liveTournamentCount ?? 0)} />
        <StatCard label="Players online" value={String(data?.onlineCount ?? 0)} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <button onClick={() => router.push("/tournaments/admin/create")} style={goldBtn}>Create tournament</button>
        <button onClick={() => router.push("/tournaments")} style={ghostBtn}>Tournaments</button>
        <button onClick={load} style={ghostBtn}>Refresh stats</button>
      </div>

      {economy && (
        <>
          <Section title="Economy overview">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              <StatCard label="Human players" value={fmt(economy.players.humans)} />
              <StatCard label="Packs opened" value={fmt(economy.packs.opened)} />
              <StatCard label="Packs unopened" value={fmt(economy.packs.unopened)} />
              <StatCard label="Packs bought (shop)" value={fmt(economy.packs.bought)} hint="since tracking" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              <StatCard label="Frags in circulation" value={fmt(economy.fragments.inCirculation)} />
              <StatCard label="Frags from quests" value={fmt(economy.fragments.fromQuests)} />
              <StatCard label="Frags from tournaments" value={fmt(economy.fragments.fromTournaments)} />
              <StatCard label="Frags spent on packs" value={fmt(economy.packs.fragmentsSpent)} hint="since tracking" />
            </div>
          </Section>

          <div style={{ height: 14 }} />

          <Section title="Marketplace">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              <StatCard label="Total sales" value={fmt(economy.market.salesTotal)} />
              <StatCard label="Card sales" value={fmt(economy.market.salesCards)} />
              <StatCard label="Pack sales" value={fmt(economy.market.salesPacks)} />
              <StatCard label="$MEMEPOOL volume" value={fmt(Math.round(economy.market.tokenVolume))} />
              <StatCard label="Active listings" value={fmt(economy.market.activeListings)} />
            </div>
          </Section>

          <div style={{ height: 14 }} />

          <Section title="Collection">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              <StatCard label="Cards in circulation" value={fmt(economy.collection.totalCards)} />
              <StatCard label="Unique cards owned" value={fmt(economy.collection.uniqueCardIds)} />
              <StatCard label="Legendaries" value={fmt(economy.collection.legendaries)} />
              <StatCard label="Matches played" value={fmt(economy.matches.total)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {(["common", "rare", "epic", "legendary"] as const).map((r) => (
                <span key={r} style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", color: "#9aa3b2" }}>
                  {r.toUpperCase()}: {fmt(economy.collection.byRarity[r])}
                </span>
              ))}
            </div>
          </Section>

          <div style={{ height: 14 }} />
        </>
      )}

      <Section title="Live ops">
        {loading && games.length === 0 && <div style={{ color: "#6a7488", padding: 20, textAlign: "center" }}>Loading…</div>}
        {!loading && games.length === 0 && (
          <div style={{ color: "#6a7488", padding: 20, textAlign: "center" }}>No active games right now.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {games.map((g) => (
            <div key={g.gameId} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9", textTransform: "uppercase" }}>{g.mode}</span>
                  <span style={{ font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`, padding: "3px 8px", borderRadius: 5, color: g.status === "in_progress" ? "#19e08a" : "#7ad6ff", background: g.status === "in_progress" ? "rgba(25,224,138,.12)" : "rgba(122,214,255,.12)", letterSpacing: "1px" }}>
                    {g.status.replace("_", " ").toUpperCase()}
                  </span>
                  {g.tournamentTitle && (
                    <span style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7c768" }}>
                      {g.tournamentTitle} · R{g.tournamentRound}
                    </span>
                  )}
                </div>
                <div style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", marginTop: 6 }}>
                  {g.players.filter((p) => !p.isAI).map((p) => p.username).join(" vs ") || g.players.map((p) => p.username).join(" vs ")}
                </div>
                <div style={{ font: `500 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", marginTop: 4 }}>
                  Turn {g.turnNumber}{g.activePlayerName ? ` · ${g.activePlayerName}'s turn` : ""}
                </div>
              </div>
              <button onClick={() => router.push(`/game/${g.gameId}?spectate=1`)} style={spectateBtn}>SPECTATE</button>
            </div>
          ))}
        </div>
      </Section>
    </Shell>
  );
}

function Shell({ children, isMobile }: { children: React.ReactNode; isMobile?: boolean }) {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "14px 26px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <button onClick={() => router.push("/")} style={ghostBtn}>‹ Dashboard</button>
        <span style={{ font: `900 14px var(--font-cinzel,'Cinzel',serif)`, color: "#e7c768", letterSpacing: ".5px" }}>ADMIN PANEL</span>
        <span style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ff8a8a", padding: "4px 8px", border: "1px solid rgba(255,138,138,.4)", borderRadius: 6 }}>RESTRICTED</span>
      </header>
      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px 40px" : "24px 26px 40px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {children}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ font: `800 12px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px", marginBottom: 14 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px" }}>{label.toUpperCase()}</div>
      <div style={{ font: `900 24px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc", marginTop: 6 }}>{value}</div>
      {hint && <div style={{ font: `500 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const ghostBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const goldBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 16px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#ffe07a,#e0890f)", color: "#2a1a00", font: `800 12px var(--font-cinzel,'Cinzel',serif)` };
const spectateBtn: React.CSSProperties = { cursor: "pointer", padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(180deg,#5ad48a,#19e08a)", color: "#0a1a10", font: `800 12px var(--font-cinzel,'Cinzel',serif)`, boxShadow: "0 6px 18px rgba(25,224,138,.3)", whiteSpace: "nowrap" };
