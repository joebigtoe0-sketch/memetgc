"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useBalances } from "@/hooks/useBalances";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";
import { BRAND } from "@/lib/brand";
import { packArtUrl } from "@/lib/packArt";
import { market, type MarketSummary } from "@/lib/market";
import { useBuyFlow } from "@/hooks/useBuyFlow";

interface Pack { type: string; name: string; cost: number; color: string; desc: string; badge?: string; }
interface Bundle { type: string; name: string; count: number; cost: number; desc: string; color: string; }

const FEATURED: Pack = { type: "legendary", name: "Legendary Pack", cost: 800, color: "#e7c768", desc: "Guaranteed Legendary card + 4 others. The fastest way to chase the chase cards." };

const PACKS: Pack[] = [
  { type: "standard", name: "Standard Pack", cost: 100, color: "#7b8cf4", desc: "Any faction, any rarity. The staple booster.", badge: "POPULAR" },
  { type: "season", name: "Genesis Drop Pack", cost: 150, color: "#19e08a", desc: "Season 1 cards only - Limited time", badge: "LIMITED" },
  { type: "legendary", name: "Legendary Pack", cost: 800, color: "#e7c768", desc: "Guaranteed Legendary + 4 cards.", badge: "BEST PULL" },
];

const BUNDLES: Bundle[] = [
  { type: "standard", name: "Starter Bundle", count: 5, cost: 450, desc: "5 Standard Packs", color: "#7b8cf4" },
  { type: "standard", name: "Mempool Bundle", count: 15, cost: 1250, desc: "15 Standard Packs", color: "#f7931a" },
  { type: "legendary", name: "Legendary Trio", count: 3, cost: 2200, desc: "3 Legendary Packs", color: "#e7c768" },
];

export default function ShopPage() {
  const { token, hasUsername, fragments, setFragments } = useAuthStore();
  const { degen, packs, refresh } = useBalances();
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [packMarket, setPackMarket] = useState<MarketSummary["packs"]>({});
  const { buy: buyTokens, state: buyState } = useBuyFlow();

  const loadPackMarket = React.useCallback(() => {
    market.summary().then((s) => setPackMarket(s.packs)).catch(() => {});
  }, []);

  useEffect(() => {
    if (token) api.get<{ fragments: number }>("/api/economy/profile").then((p) => setFragments(p.fragments)).catch(() => {});
  }, [token, setFragments]);

  useEffect(() => { if (token) loadPackMarket(); }, [token, loadPackMarket]);

  if (!token || !hasUsername) return <AuthModal />;

  async function buy(type: string, cost: number, count: number, label: string) {
    if (busy || fragments < cost) { if (fragments < cost) showToast("Not enough fragments."); return; }
    setBusy(label);
    try {
      const res = await api.post<{ newBalance: number }>("/api/economy/packs/buy", { packType: type, count });
      setFragments(res.newBalance);
      refresh();
      showToast(`Purchased ${count > 1 ? count + "× " : ""}${label}! Open it in Packs.`);
    } catch (e) { showToast((e as Error).message); }
    setBusy("");
  }
  function showToast(t: string) { setToast(t); setTimeout(() => setToast(""), 3500); }

  const tokenBusy = buyState.phase !== "idle" && buyState.phase !== "error" && buyState.phase !== "done";

  async function buyPackWithTokens(type: string, label: string) {
    if (tokenBusy) return;
    showToast(`Buying ${label} with ${BRAND.ticker}…`);
    const ok = await buyTokens("pack", type);
    if (ok) {
      showToast(`Bought ${label}! Open it in Packs.`);
      refresh();
      loadPackMarket();
    } else {
      showToast(buyState.error ?? "Purchase failed");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 26px", flexShrink: 0 }}>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back</button>
        <div style={{ font: `900 20px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Pack Store</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <Chip icon="◆" label={`${(degen ?? 0).toLocaleString()} ${BRAND.ticker}`} color="#e7c768" />
          <Chip icon="✦" label={`${fragments.toLocaleString()} frags`} color="#7b8cf4" />
          <Chip icon="🎁" label={`${packs}`} color="#19e08a" onClick={() => router.push("/packs")} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "6px 26px 20px" }}>
        {/* Featured */}
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 18, padding: "26px 30px", marginBottom: 26, background: "linear-gradient(110deg,rgba(231,199,104,.2),rgba(20,26,42,.4) 60%)", border: "1px solid rgba(231,199,104,.35)", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: "#ffd187" }}>FEATURED · LIMITED TIME</div>
            <div style={{ font: `900 30px var(--font-cinzel,'Cinzel',serif)`, color: "#fff", margin: "8px 0 8px" }}>{FEATURED.name}</div>
            <div style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#d8c79a", maxWidth: 440, lineHeight: 1.5 }}>{FEATURED.desc}</div>
            <button onClick={() => buy(FEATURED.type, FEATURED.cost, 1, FEATURED.name)} disabled={busy !== "" || fragments < FEATURED.cost} style={{ ...goldBtn, marginTop: 16, opacity: fragments < FEATURED.cost ? 0.5 : 1 }}>
              ◆ {FEATURED.cost} · BUY NOW
            </button>
          </div>
          <PackArt packType={FEATURED.type} big />
        </div>

        {/* Booster packs */}
        <SectionLabel>Booster Packs</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16, marginBottom: 26 }}>
          {PACKS.map((p) => {
            const afford = fragments >= p.cost;
            const tokenInfo = packMarket[p.type];
            const tokenPrice = tokenInfo?.count ? tokenInfo.lowestPrice : null;
            const buyerPays = tokenPrice != null ? Math.round(tokenPrice * 1.05 * 1e6) / 1e6 : null;
            return (
              <div key={p.name} style={{ position: "relative", borderRadius: 16, padding: 18, background: "linear-gradient(155deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: `1px solid ${p.color}40` }}>
                {p.badge && <div style={{ position: "absolute", top: 12, right: 12, font: `800 8px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "1px", padding: "4px 8px", borderRadius: 6, background: p.color, color: "#1a1206" }}>{p.badge}</div>}
                <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 14px" }}><PackArt packType={p.type} /></div>
                <div style={{ font: `800 15px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{p.name}</div>
                <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 6, minHeight: 32, lineHeight: 1.4 }}>{p.desc}</div>

                {/* Fragments */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0 6px" }}>
                  <span style={{ color: "#e7c768", fontSize: 13 }}>◆</span>
                  <span style={{ font: `900 18px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f3e8cc" }}>{p.cost}</span>
                  <span style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px", marginLeft: "auto" }}>FRAGMENTS</span>
                </div>
                <button onClick={() => buy(p.type, p.cost, 1, p.name)} disabled={busy !== "" || !afford} style={{ width: "100%", cursor: afford ? "pointer" : "not-allowed", padding: "10px", borderRadius: 10, border: "none", color: "#1a1206", background: `linear-gradient(180deg,${p.color},color-mix(in srgb,${p.color} 70%,#000))`, font: `800 12px var(--font-cinzel,'Cinzel',serif)`, opacity: afford ? 1 : 0.5 }}>
                  {busy === p.name ? "BUYING…" : "BUY WITH FRAGMENTS"}
                </button>

                {/* Marketplace token price */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0 6px" }}>
                  <span style={{ color: "#4ff0a8", fontSize: 12 }}>◈</span>
                  <span style={{ font: `900 16px var(--font-mono,'JetBrains Mono',monospace)`, color: tokenPrice != null ? "#c9ffe8" : "#5a6478" }}>{tokenPrice != null ? tokenPrice.toLocaleString() : "—"}</span>
                  <span style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", letterSpacing: "1px", marginLeft: "auto" }}>{BRAND.ticker} MARKET</span>
                </div>
                <button onClick={() => buyPackWithTokens(p.type, p.name)} disabled={tokenBusy || tokenPrice == null} style={{ width: "100%", cursor: tokenPrice != null && !tokenBusy ? "pointer" : "not-allowed", padding: "10px", borderRadius: 10, border: "none", color: "#04140d", background: "linear-gradient(180deg,#4ff0a8,#129c66)", font: `800 12px var(--font-cinzel,'Cinzel',serif)`, opacity: tokenPrice != null && !tokenBusy ? 1 : 0.45 }}>
                  {tokenBusy ? "PROCESSING…" : tokenPrice != null ? `BUY · ${buyerPays!.toLocaleString()} ${BRAND.ticker}` : "NONE ON SALE"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bundles */}
        <SectionLabel>Value Bundles</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {BUNDLES.map((b) => {
            const afford = fragments >= b.cost;
            return (
              <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 14, padding: 16, background: "linear-gradient(150deg,rgba(255,255,255,.045),rgba(18,23,35,.6))", border: `1px solid ${b.color}33` }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb,${b.color} 18%,#12161f)`, border: `1px solid ${b.color}55`, color: b.color, font: `900 16px var(--font-mono,'JetBrains Mono',monospace)` }}>×{b.count}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9" }}>{b.name}</div>
                  <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", marginTop: 3 }}>{b.desc}</div>
                  <button onClick={() => buy(b.type, b.cost, b.count, b.name)} disabled={busy !== "" || !afford} style={{ marginTop: 8, cursor: afford ? "pointer" : "not-allowed", padding: "7px 16px", borderRadius: 8, border: "none", color: "#1a1206", background: `linear-gradient(180deg,${b.color},color-mix(in srgb,${b.color} 70%,#000))`, font: `800 11px var(--font-cinzel,'Cinzel',serif)`, opacity: afford ? 1 : 0.5 }}>
                    {busy === b.name ? "BUYING…" : `◆ ${b.cost}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478", marginTop: 24, textAlign: "center" }}>
          {BRAND.ticker} market prices are player-listed and paid on-chain. Buy with fragments, or grab a listing from another player with your token.
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", padding: "12px 22px", borderRadius: 12, background: "rgba(25,224,138,.14)", border: "1px solid rgba(25,224,138,.4)", color: "#7fe8bd", font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, zIndex: 50, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>{toast}</div>
      )}

      <BottomNav active="shop" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#8a93a6", margin: "0 0 12px" }}>{(children as string).toUpperCase()}</div>;
}

function PackArt({ packType, big }: { packType: string; color?: string; big?: boolean }) {
  const w = big ? 165 : 120, h = big ? 238 : 172;
  const isLegendary = packType === "legendary";
  return (
    <img
      src={packArtUrl(packType)}
      alt=""
      draggable={false}
      style={{
        width: w, height: h, objectFit: "contain", display: "block",
        filter: isLegendary ? "drop-shadow(0 0 18px rgba(255,200,80,.55)) drop-shadow(0 0 36px rgba(255,180,40,.25))" : "drop-shadow(0 8px 20px rgba(0,0,0,.45))",
      }}
    />
  );
}

function Chip({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", cursor: onClick ? "pointer" : "default" }}>
      <span style={{ color, fontSize: 11 }}>{icon}</span>
      <span style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#e7ecf3" }}>{label}</span>
    </div>
  );
}

const backBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const goldBtn: React.CSSProperties = { cursor: "pointer", border: "none", padding: "12px 24px", borderRadius: 11, font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.35), inset 0 1px 0 rgba(255,255,255,.5)" };
