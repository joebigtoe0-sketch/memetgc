"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { market, type MyListing } from "@/lib/market";
import { BRAND } from "@/lib/brand";
import { packArtUrl } from "@/lib/packArt";
import CardComponent from "@/components/Card/CardComponent";
import type { CardData } from "@/components/Card/CardComponent";

const PACK_LABELS: Record<string, string> = {
  standard: "Standard Pack",
  season: "Genesis Drop Pack",
  legendary: "Legendary Pack",
};

interface Props {
  onClose: () => void;
  onChanged?: () => void;
}

function msRemaining(until: string | null): number {
  if (!until) return 0;
  return Math.max(0, new Date(until).getTime() - Date.now());
}

function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${s}s`;
}

export default function MyListingsModal({ onClose, onChanged }: Props) {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [cards, setCards] = useState<Map<string, CardData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MyListing | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [mine, allCards] = await Promise.all([
        market.mine(),
        api.get<CardData[]>("/api/cards"),
      ]);
      setListings(mine);
      setCards(new Map(allCards.map((c) => [c.id, c])));
    } catch {
      /* keep stale data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const needsPoll = listings.some((l) => l.status === "cancelling" || l.status === "reserved");
  useEffect(() => {
    if (!needsPoll) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      void refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [needsPoll, refresh]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Drop listings that finished cancelling (sweeper removed them from mine query)
  useEffect(() => {
    if (selected && !listings.find((l) => l.id === selected.id)) {
      setSelected(null);
      onChanged?.();
    }
  }, [listings, selected, onChanged]);

  async function cancelListing(listing: MyListing) {
    setError("");
    setCancelling(true);
    try {
      const res = await market.cancel(listing.id);
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, status: res.status, cooldownUntil: res.cooldownUntil }
            : l
        )
      );
      setSelected((s) =>
        s?.id === listing.id ? { ...s, status: res.status, cooldownUntil: res.cooldownUntil } : s
      );
    } catch (e) {
      setError((e as Error).message ?? "Failed to cancel listing");
    } finally {
      setCancelling(false);
    }
  }

  function statusLabel(l: MyListing): { text: string; color: string } {
    if (l.status === "reserved") {
      const left = formatCountdown(msRemaining(l.reservedUntil));
      return { text: `Buyer paying · ${left}`, color: "#7cc4ff" };
    }
    if (l.status === "cancelling") {
      const left = formatCountdown(msRemaining(l.cooldownUntil));
      return { text: `Removing · ${left}`, color: "#ff9944" };
    }
    return { text: "On sale", color: "#19e08a" };
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ font: `900 18px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>My Listings</div>
          <span style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>
            {listings.length} active
          </span>
          <button onClick={onClose} style={{ marginLeft: "auto", ...ghostBtn, width: "auto", marginTop: 0, padding: "6px 12px" }}>
            Close
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#6a7488", font: `500 13px var(--font-archivo,'Archivo',sans-serif)` }}>
            Loading listings…
          </div>
        ) : listings.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "#6a7488" }}>
            <p style={{ font: `600 13px var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb6c4", margin: 0 }}>
              You have no cards or packs listed for sale.
            </p>
            <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, marginTop: 8, lineHeight: 1.5 }}>
              Open a card in your collection and tap Sell to list it on the marketplace.
            </p>
          </div>
        ) : selected ? (
          <ListingDetail
            listing={selected}
            card={selected.cardId ? cards.get(selected.cardId) : undefined}
            cancelling={cancelling}
            error={error}
            tick={tick}
            onBack={() => { setSelected(null); setError(""); }}
            onCancel={() => cancelListing(selected)}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 16, maxHeight: "min(62vh, 520px)", overflowY: "auto", padding: "4px 2px 8px" }}>
            {listings.map((l) => {
              const st = statusLabel(l);
              const card = l.kind === "card" && l.cardId ? cards.get(l.cardId) : undefined;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelected(l)}
                  style={{
                    cursor: "pointer", padding: 0, border: "none", background: "transparent",
                    textAlign: "center", position: "relative",
                  }}
                >
                  {card ? (
                    <CardComponent card={card} size="sm" />
                  ) : (
                    <div style={{ width: 130, height: 182, margin: "0 auto", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)", background: "#12161f" }}>
                      <img src={packArtUrl(l.packType ?? "standard")} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                  )}
                  <div style={{ marginTop: 8, font: `700 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#dfe5ee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {card?.name ?? PACK_LABELS[l.packType ?? ""] ?? l.packType}
                  </div>
                  <div style={{ font: `800 12px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ffe07a", marginTop: 2 }}>
                    {l.price.toLocaleString()} {BRAND.ticker}
                  </div>
                  <div style={{ font: `600 10px var(--font-mono,'JetBrains Mono',monospace)`, color: st.color, marginTop: 4 }}>
                    {st.text}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ListingDetail({
  listing,
  card,
  cancelling,
  error,
  tick,
  onBack,
  onCancel,
}: {
  listing: MyListing;
  card?: CardData;
  cancelling: boolean;
  error: string;
  tick: number;
  onBack: () => void;
  onCancel: () => void;
}) {
  void tick;
  const isCancelling = listing.status === "cancelling";
  const isReserved = listing.status === "reserved";
  const cooldownLeft = msRemaining(listing.cooldownUntil);
  const reserveLeft = msRemaining(listing.reservedUntil);

  return (
    <div>
      <button onClick={onBack} style={{ ...ghostBtn, width: "auto", marginTop: 0, marginBottom: 14, padding: "6px 12px" }}>
        ‹ All listings
      </button>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0 }}>
          {card ? (
            <CardComponent card={card} size="md" />
          ) : (
            <div style={{ width: 158, height: 220, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)", background: "#12161f" }}>
              <img src={packArtUrl(listing.packType ?? "standard")} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `900 17px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc" }}>
            {card?.name ?? PACK_LABELS[listing.packType ?? ""] ?? listing.packType}
          </div>
          <div style={{ font: `800 15px var(--font-mono,'JetBrains Mono',monospace)`, color: "#ffe07a", marginTop: 6 }}>
            {listing.price.toLocaleString()} {BRAND.ticker}
          </div>

          {isReserved && (
            <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#7cc4ff", marginTop: 12, lineHeight: 1.5 }}>
              A buyer is completing payment ({formatCountdown(reserveLeft)} left). You can still remove this listing — it will wait out their checkout window first.
            </p>
          )}

          {isCancelling && (
            <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff9944", marginTop: 12, lineHeight: 1.5 }}>
              Removing listing in {formatCountdown(cooldownLeft)}. If a buyer finishes payment before then, the sale still goes through. Otherwise the card returns to your collection.
            </p>
          )}

          {!isCancelling && !isReserved && (
            <p style={{ font: `500 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#8a93a6", marginTop: 12, lineHeight: 1.5 }}>
              This card is held in escrow on the marketplace. Removing a listing takes 30 seconds so in-flight purchases can complete.
            </p>
          )}

          {error && (
            <p style={{ font: `600 11px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff6b6b", marginTop: 12 }}>{error}</p>
          )}

          {!isCancelling && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              style={dangerBtn(cancelling)}
            >
              {cancelling ? "Starting removal…" : "Remove listing"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(4,6,12,.72)", backdropFilter: "blur(4px)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
};
const panel: React.CSSProperties = {
  width: "100%", maxWidth: 640, padding: 26, borderRadius: 18,
  background: "linear-gradient(150deg,rgba(255,255,255,.05),rgba(14,18,28,.92))",
  border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 60px rgba(0,0,0,.6)",
};
const ghostBtn: React.CSSProperties = {
  marginTop: 9, padding: "9px 0", borderRadius: 10,
  background: "transparent", border: "1px solid rgba(255,255,255,.12)",
  color: "#8a93a6", font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, cursor: "pointer",
};

function dangerBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 11, border: "none",
    font: `800 13px var(--font-cinzel,'Cinzel',serif)`, color: "#fff",
    background: "linear-gradient(180deg,#ff6b6b,#c0392b)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
  };
}
