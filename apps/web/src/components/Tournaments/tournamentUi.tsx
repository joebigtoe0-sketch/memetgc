"use client";

import React from "react";
import type { TournamentMatchDto } from "@memetgc/types";

const STATUS_COLOR: Record<string, string> = {
  upcoming: "#7ad6ff",
  live: "#19e08a",
  finished: "#8a93a6",
  cancelled: "#ff8a8a",
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#8a93a6";
  return (
    <span style={{ font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", padding: "3px 8px", borderRadius: 5, color: c, background: `${c}18`, border: `1px solid ${c}44`, textTransform: "uppercase" }}>
      {status}
    </span>
  );
}

export function TournamentBracket({ matches, totalRounds, championName }: { matches: TournamentMatchDto[]; totalRounds: number; championName?: string | null }) {
  if (matches.length === 0) return null;

  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6" }}>BRACKET</span>
        {championName && (
          <span style={{ font: `800 11px var(--font-cinzel,'Cinzel',serif)`, color: "#e7c768", letterSpacing: ".5px" }}>
            CHAMPION: {championName.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {rounds.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          const label = round === totalRounds ? "FINAL" : round === totalRounds - 1 ? "SEMIFINALS" : `ROUND ${round}`;
          return (
            <div key={round} style={{ minWidth: 140, flex: "0 0 auto" }}>
              <div style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488", letterSpacing: "1px", marginBottom: 8 }}>{label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {roundMatches.map((m) => (
                  <MatchCard key={m.id} match={m} highlight={m.isUserMatch} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({ match, highlight }: { match: TournamentMatchDto; highlight?: boolean }) {
  const live = match.status === "live" || match.status === "awaiting_join";
  const p1Win = match.winnerId === match.player1Id;
  const p2Win = match.winnerId === match.player2Id;

  return (
    <div style={{
      padding: "8px 10px",
      borderRadius: 10,
      background: highlight ? "rgba(25,224,138,.08)" : "rgba(0,0,0,.25)",
      border: `1px solid ${highlight ? "rgba(25,224,138,.35)" : "rgba(255,255,255,.08)"}`,
      minWidth: 130,
    }}>
      <PlayerLine name={match.player1Name ?? "TBD"} score={match.player1Score} win={p1Win} />
      <PlayerLine name={match.player2Name ?? "TBD"} score={match.player2Score} win={p2Win} />
      {live && (
        <div style={{ marginTop: 6, font: `700 8px var(--font-mono,'JetBrains Mono',monospace)`, color: "#19e08a", letterSpacing: ".5px" }}>LIVE</div>
      )}
    </div>
  );
}

function PlayerLine({ name, score, win }: { name: string; score: number; win: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, font: `700 11px var(--font-archivo,'Archivo',sans-serif)`, color: win ? "#e7c768" : "#cdd4df", marginBottom: 2 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      {score > 0 && <span style={{ fontFamily: "var(--font-mono,'JetBrains Mono',monospace)", color: "#8a93a6" }}>{score}</span>}
    </div>
  );
}

export function PrizeBreakdown({ tiers }: { tiers: { rankLabel: string; amount: number | null; currency: string; customLabel?: string | null }[] }) {
  return (
    <div>
      <div style={{ font: `800 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6", marginBottom: 10 }}>PRIZE POOL BREAKDOWN</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tiers.map((t) => (
          <div key={t.rankLabel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
            <span style={{ font: `700 12px var(--font-cinzel,'Cinzel',serif)`, color: "#e7ecf3" }}>{t.rankLabel}</span>
            <span style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: t.amount ? "#e7c768" : "#6a7488" }}>
              {!t.amount ? "No prize" : t.currency === "custom" ? `${t.amount.toLocaleString()} ${t.customLabel ?? ""}` : `${t.amount.toLocaleString()} frags`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function formatCountdown(deadlineIso: string): string {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}
