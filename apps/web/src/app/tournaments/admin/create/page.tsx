"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useIsMobile } from "@/hooks/useViewport";
import type { PrizeCurrency } from "@memetgc/types";

type TierForm = {
  rankLabel: string;
  rankMin: number;
  rankMax: number;
  amount: string;
  currency: PrizeCurrency;
  customLabel: string;
};

const DEFAULT_TIERS: TierForm[] = [
  { rankLabel: "1st", rankMin: 1, rankMax: 1, amount: "", currency: "fragments", customLabel: "" },
  { rankLabel: "2nd", rankMin: 2, rankMax: 2, amount: "", currency: "fragments", customLabel: "" },
  { rankLabel: "3rd - 4th", rankMin: 3, rankMax: 4, amount: "", currency: "fragments", customLabel: "" },
  { rankLabel: "5th - 8th", rankMin: 5, rankMax: 8, amount: "", currency: "fragments", customLabel: "" },
  { rankLabel: "9th - 16th", rankMin: 9, rankMax: 16, amount: "", currency: "fragments", customLabel: "" },
];

export default function AdminCreateTournamentPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { token } = useAuthStore();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [maxSlots, setMaxSlots] = useState(64);
  const [tiers, setTiers] = useState<TierForm[]>(DEFAULT_TIERS);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setAuthorized(false); return; }
    api.get<{ isAdmin: boolean }>("/api/tournaments/admin/check")
      .then((d) => setAuthorized(d.isAdmin))
      .catch(() => setAuthorized(false));
  }, [token]);

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      try {
        const res = await api.post<{ imagePath: string }>("/api/tournaments/admin/upload-image", {
          imageBase64: base64,
          filename: file.name,
        });
        setImagePath(res.imagePath);
        setError("");
      } catch {
        setError("Image upload failed");
      }
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setError("");
    if (!title.trim() || !startDate) {
      setError("Title and start date required");
      return;
    }
    const startAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    setSubmitting(true);
    try {
      await api.post("/api/tournaments/admin/create", {
        title,
        description,
        startAt,
        maxSlots,
        imagePath,
        prizeTiers: tiers.map((t) => ({
          rankLabel: t.rankLabel,
          rankMin: t.rankMin,
          rankMax: t.rankMax,
          amount: t.amount ? parseInt(t.amount, 10) : null,
          currency: t.currency,
          customLabel: t.currency === "custom" ? t.customLabel : null,
        })),
      });
      router.push("/tournaments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
    setSubmitting(false);
  }

  if (authorized === null) return <div style={pageStyle}><div style={{ color: "#6a7488", textAlign: "center", padding: 40 }}>Checking access…</div></div>;
  if (!authorized) return <div style={pageStyle}><div style={{ color: "#ff8a8a", textAlign: "center", padding: 40 }}>Restricted — admin wallet required</div></div>;

  return (
    <div style={pageStyle}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "14px 26px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <button onClick={() => router.push("/tournaments")} style={backBtn}>‹ Back</button>
        <span style={{ font: `900 14px var(--font-cinzel,'Cinzel',serif)`, color: "#e7c768", letterSpacing: ".5px" }}>ADMIN · CREATE TOURNAMENT</span>
        <span style={{ font: `700 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ff8a8a", padding: "4px 8px", border: "1px solid rgba(255,138,138,.4)", borderRadius: 6 }}>RESTRICTED</span>
      </header>

      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px 40px" : "24px 26px 40px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <Section title="Tournament details">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Memepool Masters" /></Field>
          <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="Weekly open bracket…" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <Field label="Start date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} /></Field>
            <Field label="Start time"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Max slots"><input type="number" min={4} max={256} value={maxSlots} onChange={(e) => setMaxSlots(parseInt(e.target.value, 10) || 64)} style={inputStyle} /></Field>
          <Field label="Tournament logo">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onImageChange} style={{ color: "#cdd4df", fontSize: 12 }} />
            {imagePreview && <img src={imagePreview} alt="" style={{ marginTop: 10, width: 80, height: 80, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(255,255,255,.15)" }} />}
          </Field>
        </Section>

        <Section title="Prize tiers" hint="Leave amount blank for no prize — default currency is fragments">
          {tiers.map((t, i) => (
            <div key={t.rankLabel} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "80px 1fr auto auto", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{ font: `700 12px var(--font-cinzel,'Cinzel',serif)`, color: "#e7c768" }}>{t.rankLabel}</span>
              <input
                value={t.amount}
                onChange={(e) => setTiers((prev) => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                style={inputStyle}
                placeholder="blank = none"
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>
                <input
                  type="checkbox"
                  checked={t.currency === "custom"}
                  onChange={(e) => setTiers((prev) => prev.map((x, j) => j === i ? { ...x, currency: e.target.checked ? "custom" : "fragments" } : x))}
                />
                Custom
              </label>
              {t.currency === "custom" && (
                <input
                  value={t.customLabel}
                  onChange={(e) => setTiers((prev) => prev.map((x, j) => j === i ? { ...x, customLabel: e.target.value } : x))}
                  style={inputStyle}
                  placeholder="$SOL"
                />
              )}
            </div>
          ))}
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(25,224,138,.06)", border: "1px solid rgba(25,224,138,.2)", font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", lineHeight: 1.5 }}>
            Fragment prizes must be claimed from the tournament page after it ends. Custom-currency prizes (e.g. $SOL, $MEMEPOOL) are flagged for manual payout.
          </div>
        </Section>

        {error && <div style={{ color: "#ff8a8a", marginBottom: 12, font: `600 12px var(--font-archivo,'Archivo',sans-serif)` }}>{error}</div>}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={() => router.push("/tournaments")} style={backBtn}>Cancel</button>
          <button disabled={submitting} onClick={submit} style={createBtn}>{submitting ? "Creating…" : "CREATE TOURNAMENT"}</button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, padding: 18, borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={{ font: `800 12px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>{title.toUpperCase()}</span>
        {hint && <span style={{ font: `500 10px var(--font-archivo,'Archivo',sans-serif)`, color: "#6a7488", maxWidth: 280, textAlign: "right" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginBottom: 6, letterSpacing: ".5px" }}>{label}</div>
      {children}
    </div>
  );
}

const pageStyle: React.CSSProperties = { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", color: "#e7ecf3", font: `500 13px var(--font-archivo,'Archivo',sans-serif)`, boxSizing: "border-box" };
const backBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const createBtn: React.CSSProperties = { cursor: "pointer", border: "none", padding: "12px 28px", borderRadius: 11, font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.4)" };
