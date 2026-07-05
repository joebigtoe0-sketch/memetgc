"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Logo from "@/components/Brand/Logo";
import GameIcon from "@/components/UI/GameIcon";
import { useIsMobile } from "@/hooks/useViewport";
import { useAuthStore } from "@/store/authStore";
import type { TournamentDetail, TournamentListItem, TournamentPrizeTierDto } from "@memetgc/types";
import { StatusBadge, TournamentBracket, PrizeBreakdown, formatCountdown } from "@/components/Tournaments/tournamentUi";

function formatStartsInDisplay(label: string | null | undefined): string {
  const v = label ?? "soon";
  if (v === "starting now") return "starting now";
  return `starts in ${v}`;
}

interface ListResponse {
  tournaments: TournamentListItem[];
  liveCount: number;
}

export default function TournamentsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { token } = useAuthStore();
  const [list, setList] = useState<TournamentListItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, TournamentDetail>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [, tick] = useState(0);

  const loadList = useCallback(() => {
    api.get<ListResponse>("/api/tournaments")
      .then((d) => setList(d.tournaments))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (!token) return;
    api.get<{ isAdmin: boolean }>("/api/tournaments/admin/check").then((d) => setIsAdmin(d.isAdmin)).catch(() => {});
  }, [token]);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function expand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      const d = await api.get<TournamentDetail>(`/api/tournaments/${id}`).catch(() => null);
      if (d) setDetails((prev) => ({ ...prev, [id]: d }));
    }
  }

  async function register(id: string) {
    setActionLoading(id);
    try {
      await api.post(`/api/tournaments/${id}/register`, {});
      const d = await api.get<TournamentDetail>(`/api/tournaments/${id}`);
      setDetails((prev) => ({ ...prev, [id]: d }));
      loadList();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function withdraw(id: string) {
    setActionLoading(id);
    try {
      await api.delete(`/api/tournaments/${id}/register`);
      const d = await api.get<TournamentDetail>(`/api/tournaments/${id}`);
      setDetails((prev) => ({ ...prev, [id]: d }));
      loadList();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function claimReward(id: string) {
    setActionLoading(id);
    try {
      await api.post(`/api/tournaments/${id}/claim-reward`, {});
      const d = await api.get<TournamentDetail>(`/api/tournaments/${id}`);
      setDetails((prev) => ({ ...prev, [id]: d }));
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  function joinMatch(matchId: string) {
    router.push(`/play?mode=tournament&matchId=${matchId}`);
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: isMobile ? "12px 14px" : "14px 26px", borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(8,11,18,.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/")} style={backBtn}>‹ Back</button>
          <Logo size={32} />
          <span style={{ font: `900 16px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>P2E TOURNAMENTS</span>
        </div>
        {isAdmin && (
          <button onClick={() => router.push("/tournaments/admin/create")} style={adminBtn}>Admin</button>
        )}
      </header>

      <div style={{ padding: "10px 16px", background: "rgba(25,224,138,.06)", borderBottom: "1px solid rgba(25,224,138,.15)", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#19e08a", fontWeight: 800 }}>FREE ENTRY</span>
          <span>Register before start · Single-elimination bracket · Bots fill to keep pairs even (min 4)</span>
        </div>
        <span style={{ color: "#ff8a8a" }}>Miss your 5-min join window and you forfeit the match.</span>
      </div>

      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px 80px" : "24px clamp(16px,5vw,60px) 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <div style={{ textAlign: "center", color: "#6a7488", padding: 40 }}>Loading tournaments…</div>}
          {!loading && list.length === 0 && (
            <div style={{ textAlign: "center", color: "#6a7488", padding: 40 }}>No tournaments yet. Check back soon.</div>
          )}
          {list.map((t) => {
            const open = expandedId === t.id;
            const detail = details[t.id];
            return (
              <div key={t.id} style={{ borderRadius: 14, border: `1px solid ${open ? "rgba(231,199,104,.35)" : "rgba(255,255,255,.08)"}`, background: "linear-gradient(150deg,rgba(255,255,255,.04),rgba(18,23,35,.65))", overflow: "hidden" }}>
                <button type="button" onClick={() => expand(t.id)} style={{ width: "100%", cursor: "pointer", border: "none", background: "transparent", padding: isMobile ? "14px 12px" : "16px 18px", textAlign: "left", color: "inherit" }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "auto 1fr auto auto auto auto", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {t.imagePath ? <img src={t.imagePath} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <GameIcon name="fragment" size={20} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ font: `800 15px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{t.title}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", marginTop: 4, lineHeight: 1.4 }}>{t.description}</div>
                    </div>
                    {!isMobile && (
                      <>
                        <div style={{ textAlign: "right", font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#cdd4df", minWidth: 90 }}>
                          {t.status === "live" ? `LIVE round ${t.currentRound} of ${t.totalRounds}` : t.status === "finished" ? new Date(t.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " finished" : formatStartsInDisplay(t.startsInLabel)}
                        </div>
                        <div style={{ textAlign: "right", font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7c768", minWidth: 90, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <GameIcon name="fragment" size={14} />
                          {t.totalPrizeSummary}
                        </div>
                        <div style={{ textAlign: "right", font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", minWidth: 80 }}>
                          {t.registeredCount}/{t.maxSlots} players
                        </div>
                      </>
                    )}
                    <span style={{ color: "#6a7488", fontSize: 18 }}>{open ? "▴" : "▾"}</span>
                  </div>
                </button>

                {open && detail && (
                  <div style={{ padding: isMobile ? "0 12px 16px" : "0 18px 18px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                    <ExpandedPanel
                      detail={detail}
                      actionLoading={actionLoading === t.id}
                      isMobile={isMobile}
                      onRegister={() => register(t.id)}
                      onWithdraw={() => withdraw(t.id)}
                      onJoin={joinMatch}
                      onClaimReward={() => claimReward(t.id)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function ExpandedPanel({
  detail,
  actionLoading,
  onRegister,
  onWithdraw,
  onJoin,
  onClaimReward,
  isMobile,
}: {
  detail: TournamentDetail;
  actionLoading: boolean;
  onRegister: () => void;
  onWithdraw: () => void;
  onJoin: (matchId: string) => void;
  onClaimReward: () => void;
  isMobile?: boolean;
}) {
  const pct = detail.maxSlots > 0 ? Math.round((detail.registeredCount / detail.maxSlots) * 100) : 0;
  const tiers = detail.prizeTiers as TournamentPrizeTierDto[];
  const canRegister = detail.status === "upcoming" && !detail.userRegistered;
  const canWithdraw = detail.status === "upcoming" && detail.userRegistered;
  const active = detail.userActiveMatch;
  const canClaim = detail.status === "finished" && detail.userPayout?.status === "pending_claim" && detail.userPayout.currencyLabel === "fragments";
  const claimed = detail.status === "finished" && detail.userPayout?.status === "claimed";

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginTop: 16 }}>
      <PrizeBreakdown tiers={tiers} />

      <div>
        {detail.status === "upcoming" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginBottom: 6 }}>
              <span>{detail.registeredCount} / {detail.maxSlots} slots</span><span>{pct}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,.06)", overflow: "hidden", marginBottom: 14 }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#7b8cf4,#7ad6ff)" }} />
            </div>
            <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginBottom: 12 }}>
              Starts {new Date(detail.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </div>
            {canRegister && (
              <button disabled={actionLoading} onClick={onRegister} style={registerBtn}>REGISTER — FREE</button>
            )}
            {canWithdraw && (
              <button disabled={actionLoading} onClick={onWithdraw} style={withdrawBtn}>REGISTERED · WITHDRAW</button>
            )}
            <div style={{ marginTop: 10, font: `500 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488" }}>Free entry · Register before the tournament starts</div>
          </>
        )}

        {(detail.status === "live" || detail.status === "finished") && active && (
          <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: "rgba(25,224,138,.08)", border: "1px solid rgba(25,224,138,.35)" }}>
            <div style={{ font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#19e08a", letterSpacing: "1.5px" }}>JOIN YOUR MATCH</div>
            <div style={{ font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3", marginTop: 8 }}>vs {active.opponentName}</div>
            <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 4 }}>{formatCountdown(active.joinDeadline)} to join</div>
            <button onClick={() => onJoin(active.matchId)} style={{ ...registerBtn, marginTop: 12 }}>JOIN</button>
          </div>
        )}

        {(detail.status === "live" || detail.status === "finished") && (
          <TournamentBracket matches={detail.matches} totalRounds={detail.totalRounds} championName={detail.winnerName} />
        )}

        {canClaim && detail.userPayout && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "rgba(231,199,104,.08)", border: "1px solid rgba(231,199,104,.35)" }}>
            <div style={{ font: `800 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7c768", letterSpacing: "1.5px" }}>PRIZE READY</div>
            <div style={{ font: `700 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#e7ecf3", marginTop: 8 }}>
              Rank #{detail.userPayout.rank} · {detail.userPayout.amount.toLocaleString()} fragments
            </div>
            <button disabled={actionLoading} onClick={onClaimReward} style={{ ...registerBtn, marginTop: 12, background: "linear-gradient(180deg,#ffe07a,#e0890f)", color: "#2a1a00", boxShadow: "0 8px 24px rgba(224,137,15,.35)" }}>
              CLAIM REWARD
            </button>
          </div>
        )}

        {claimed && detail.userPayout && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>
            Claimed {detail.userPayout.amount.toLocaleString()} fragments (rank #{detail.userPayout.rank})
          </div>
        )}
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const adminBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(231,199,104,.1)", border: "1px solid rgba(231,199,104,.4)", color: "#e7c768", font: `700 11px var(--font-archivo,'Archivo',sans-serif)` };
const registerBtn: React.CSSProperties = { cursor: "pointer", width: "100%", border: "none", padding: "14px 20px", borderRadius: 11, font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#0a1a10", background: "linear-gradient(180deg,#5ad48a,#19e08a)", boxShadow: "0 8px 24px rgba(25,224,138,.35)" };
const withdrawBtn: React.CSSProperties = { ...registerBtn, color: "#e7ecf3", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.15)", boxShadow: "none" };
