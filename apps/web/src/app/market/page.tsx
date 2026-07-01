"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import CardComponent, { type CardData } from "@/components/Card/CardComponent";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";
import { factionColor, FACTIONS } from "@/lib/factions";
import FactionIcon from "@/components/Faction/FactionIcon";
import BuyInspectModal from "@/components/Market/BuyInspectModal";
import { market, type MarketSummary } from "@/lib/market";
import { BRAND } from "@/lib/brand";
import GameIcon from "@/components/UI/GameIcon";

const TYPES = ["", "minion", "spell", "weapon", "location", "hero"];
const TYPE_LABEL: Record<string, string> = { "": "All", minion: "Minion", spell: "Spell", weapon: "Weapon", location: "Location", hero: "Hero" };

export default function MarketPage() {
  const { token, hasUsername } = useAuthStore();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CardData[]>([]);
  const [summary, setSummary] = useState<MarketSummary["cards"]>({});
  const [loading, setLoading] = useState(true);
  const [inspect, setInspect] = useState<CardData | null>(null);
  const [filterFaction, setFilterFaction] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [onlyListed, setOnlyListed] = useState(false);

  const loadSummary = useCallback(() => {
    market.summary().then((s) => setSummary(s.cards)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.get<CardData[]>("/api/cards"), market.summary()])
      .then(([cards, s]) => {
        setCatalog(cards);
        setSummary(s.cards);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (!token || !hasUsername) return <AuthModal />;

  const filtered = catalog.filter((c) => {
    if (filterFaction && c.faction !== filterFaction) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterSearch && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (onlyListed && !(summary[c.id]?.count > 0)) return false;
    return true;
  });

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 30px", flexShrink: 0 }}>
        <button onClick={() => router.push("/collection")} style={chip}>‹ Collection</button>
        <div style={{ font: `900 22px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Marketplace</div>
        <span style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>Buy cards with {BRAND.ticker}</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setOnlyListed((v) => !v)} style={{ cursor: "pointer", height: 34, padding: "0 14px", borderRadius: 9, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: onlyListed ? "#04140d" : "#aeb6c4", background: onlyListed ? "linear-gradient(180deg,#4ff0a8,#129c66)" : "rgba(255,255,255,.04)", border: `1px solid ${onlyListed ? "transparent" : "rgba(255,255,255,.1)"}` }}>On sale only</button>
          <FacBtn active={filterFaction === ""} color="#cdd4df" onClick={() => setFilterFaction("")}>ALL</FacBtn>
          {FACTIONS.map((f) => (
            <FacBtn key={f} active={filterFaction === f} color={factionColor(f)} onClick={() => setFilterFaction(filterFaction === f ? "" : f)}>
              <FactionIcon faction={f} size={22} />
            </FacBtn>
          ))}
          <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Search cards…" style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#e7ecf3", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, width: 150, outline: "none" }} />
        </div>
      </div>

      {/* Type pills */}
      <div style={{ display: "flex", gap: 8, padding: "0 30px 12px", flexWrap: "wrap", flexShrink: 0 }}>
        {TYPES.map((t) => {
          const on = filterType === t;
          return (
            <button key={t || "all"} onClick={() => setFilterType(t)} style={{ cursor: "pointer", padding: "7px 16px", borderRadius: 9, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: on ? "#2a1a00" : "#aeb6c4", background: on ? "linear-gradient(180deg,#ffe07a,#e0890f)" : "rgba(255,255,255,.04)", border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.1)"}` }}>{TYPE_LABEL[t]}</button>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 30px 40px", minHeight: 0 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6a7488" }}>Loading marketplace…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#5a6478" }}>
            <GameIcon name="shop" size={48} style={{ margin: "0 auto 12px" }} />
            <p style={{ font: `700 15px var(--font-cinzel,'Cinzel',serif)`, color: "#aeb6c4" }}>No cards match your filters</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "40px 26px", justifyItems: "center" }}>
            {filtered.map((card) => {
              const info = summary[card.id];
              const hasListings = (info?.count ?? 0) > 0;
              return (
                <div key={card.id} data-sound-skip-click style={{ position: "relative", cursor: "pointer", opacity: hasListings ? 1 : 0.72 }} onClick={() => setInspect(card)}>
                  <CardComponent card={card} size="md" interactive />
                  <div style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                    {hasListings ? (
                      <span style={{ padding: "3px 12px", borderRadius: 20, font: `800 12px var(--font-mono,'JetBrains Mono',monospace)`, background: "#0d1020", border: "1px solid rgba(255,224,122,.5)", color: "#ffe07a" }}>
                        {info!.lowestPrice.toLocaleString()} {BRAND.ticker}
                      </span>
                    ) : (
                      <span style={{ padding: "3px 12px", borderRadius: 20, font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, background: "#0d1020", border: "1px solid rgba(255,255,255,.12)", color: "#6a7488" }}>
                        No listings
                      </span>
                    )}
                    {hasListings && (
                      <span style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6" }}>{info!.count} on sale</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="collection" />

      {inspect && (
        <BuyInspectModal
          kind="card"
          itemId={inspect.id}
          title={inspect.name}
          preview={<CardComponent card={inspect} size="md" glowing interactive />}
          onClose={() => setInspect(null)}
          onBought={() => { loadSummary(); }}
        />
      )}
    </div>
  );
}

function FacBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ cursor: "pointer", minWidth: 34, height: 34, padding: "0 8px", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: active ? "#15101a" : color, background: active ? color : "rgba(255,255,255,.04)", border: `1px solid ${active ? color : "rgba(255,255,255,.1)"}`, boxShadow: active ? `0 0 12px ${color}66` : "none" }}>{children}</button>
  );
}

const chip: React.CSSProperties = { cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
