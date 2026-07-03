"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";
import BottomNav from "@/components/Dashboard/BottomNav";
import { CARD_BACK_DEFAULT, CARD_BACK_RADIUS, cardBackImage } from "@/lib/cardBacks";
import { packArtUrl } from "@/lib/packArt";
import CardComponent, { type CardData } from "@/components/Card/CardComponent";
import SellModal from "@/components/Market/SellModal";
import GameIcon from "@/components/UI/GameIcon";
import { musicManager } from "@/lib/music/MusicManager";
import { playSound } from "@/lib/sounds";
import { useIsMobile } from "@/hooks/useViewport";

interface PackEntry { packType: string; quantity: number; }
interface OpenResult { cards: CardData[]; remaining: number; }

const PACK_META: Record<string, { name: string; color: string; tag: string }> = {
  standard: { name: "Standard Pack", color: "#7b8cf4", tag: "STANDARD" },
  season: { name: "Genesis Drop Pack", color: "#19e08a", tag: "GENESIS DROP" },
  legendary: { name: "Legendary Pack", color: "#e7c768", tag: "LEGENDARY" },
  // legacy — no longer sold, but may exist in inventory
  faction: { name: "Faction Pack", color: "#9a7bff", tag: "FACTION" },
};

function packMeta(packType: string) {
  return PACK_META[packType] ?? PACK_META.standard;
}

const RARITY_RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

type View = "inventory" | "reveal";
/** pack: waiting for tap · tearing: shake+rip · dealing/cards: grid visible */
type Stage = "pack" | "tearing" | "dealing" | "cards";
type FlipState = "down" | "tease" | "up";

const TEAR_MS = 700;
const DEAL_STAGGER_MS = 110;
const DEAL_IN_MS = 500;
const TEASE_MS = 1100;

export default function PacksPage() {
  const { token, hasUsername } = useAuthStore();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [inventory, setInventory] = useState<PackEntry[]>([]);
  const [view, setView] = useState<View>("inventory");
  const [stage, setStage] = useState<Stage>("pack");
  const [openType, setOpenType] = useState<string>("standard");
  const [cards, setCards] = useState<CardData[]>([]);
  const [flips, setFlips] = useState<FlipState[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sellPack, setSellPack] = useState<string | null>(null);
  const [cardBack, setCardBack] = useState<string>(CARD_BACK_DEFAULT);

  const loadInventory = useCallback(() => {
    api.get<PackEntry[]>("/api/economy/packs/inventory").then(setInventory).catch(() => {});
  }, []);

  useEffect(() => { if (token) loadInventory(); }, [token, loadInventory]);

  useEffect(() => {
    if (!token) return;
    api.get<{ equippedCardBack?: string | null }>("/api/economy/profile")
      .then((p) => setCardBack(cardBackImage(p.equippedCardBack)))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (view !== "reveal" || !musicManager.isUnlocked()) return;
    const returnTo = musicManager.getLastAmbient();
    musicManager.playPackOpening(openType === "season", returnTo);
    return () => musicManager.interruptPackOpening(returnTo);
  }, [view, openType, cards.length]);

  if (!token || !hasUsername) return <AuthModal />;

  async function openPack(type: string) {
    if (busy) return;
    setBusy(true); setError("");
    // Show the centered pack immediately; the API resolves while it flies in.
    setOpenType(type);
    setCards([]); setFlips([]);
    setStage("pack");
    setView("reveal");
    try {
      const res = await api.post<OpenResult>("/api/economy/packs/open", { packType: type });
      setCards(res.cards);
      setFlips(res.cards.map(() => "down"));
      setRemaining(res.remaining);
    } catch (e) {
      setError((e as Error).message);
      setView("inventory");
    } finally {
      setBusy(false);
    }
  }

  function tearPack() {
    if (stage !== "pack" || cards.length === 0) return;
    playSound("packTear", 0.9);
    setStage("tearing");
    setTimeout(() => {
      setStage("dealing");
      playSound("shuffle", 0.55);
      setTimeout(() => setStage("cards"), cards.length * DEAL_STAGGER_MS + DEAL_IN_MS);
    }, TEAR_MS);
  }

  function flip(i: number) {
    if (flips[i] !== "down" || (stage !== "cards" && stage !== "dealing")) return;
    const rank = RARITY_RANK[cards[i]?.rarity] ?? 0;
    if (rank >= 1) {
      // Rare+ teases: slow half-turn first, then snaps open with a sting.
      playSound("coin", 0.45);
      setFlips((f) => f.map((v, idx) => (idx === i ? "tease" : v)));
      setTimeout(() => {
        if (flipsRef.current[i] !== "tease") return;
        playSound(rank >= 3 ? "legendaryReveal" : "rareReveal", 0.85);
        setFlips((f) => f.map((v, idx) => (idx === i ? "up" : v)));
      }, TEASE_MS);
    } else {
      playSound("drawCard", 0.7);
      setFlips((f) => f.map((v, idx) => (idx === i ? "up" : v)));
    }
  }
  const flipRef = React.useRef(flip);
  flipRef.current = flip;
  const flipsRef = React.useRef(flips);
  flipsRef.current = flips;

  function revealAll() {
    let delay = 0;
    flips.forEach((f, i) => {
      if (f !== "down") return;
      setTimeout(() => flipRef.current(i), delay);
      // Give rare+ cards room so their stings don't pile on top of each other.
      delay += RARITY_RANK[cards[i]?.rarity] >= 1 ? 550 : 240;
    });
  }
  const allRevealed = flips.length > 0 && flips.every((f) => f === "up");
  const bestRarity = cards.reduce((best, c) => (RARITY_RANK[c.rarity] > RARITY_RANK[best] ? c.rarity : best), "common");

  const meta = packMeta(openType);
  const totalPacks = inventory.reduce((s, p) => s + p.quantity, 0);

  // ── Reveal view ──────────────────────────────────────────────
  if (view === "reveal") {
    const headerColor = PACK_META[openType]?.color ?? "#e7c768";

    // Stage 1-2: pack centered on screen, waiting for the tap / tearing open
    if (stage === "pack" || stage === "tearing") {
      return (
        <div style={pageBg}>
          <PackKeyframes />
          <div style={{ display: "flex", alignItems: "center", padding: "16px 26px" }}>
            <button onClick={() => { setView("inventory"); loadInventory(); }} style={backBtn}>‹ Packs</button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
            <div
              data-sound-skip-click
              onClick={tearPack}
              style={{
                cursor: cards.length > 0 && stage === "pack" ? "pointer" : "default",
                animation: stage === "tearing"
                  ? `packShake ${TEAR_MS}ms ease-in-out both`
                  : "packEnter .55s cubic-bezier(.2,.9,.3,1.15) both",
                filter: stage === "tearing" ? `drop-shadow(0 0 40px ${headerColor})` : undefined,
                transition: "filter .3s ease",
              }}
            >
              <PackBack packType={openType} />
            </div>
            <div style={{ font: `700 12px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: stage === "tearing" ? headerColor : "#8a93a6", marginTop: 26, textTransform: "uppercase", animation: stage === "pack" ? "hintPulse 1.6s ease-in-out infinite" : undefined }}>
              {stage === "tearing" ? "Tearing…" : cards.length > 0 ? "Tap the pack to tear it open" : "Opening…"}
            </div>
          </div>
        </div>
      );
    }

    // Stage 3-4: cards dealt from the pack, then flipped
    return (
      <div style={pageBg}>
        <PackKeyframes />
        {/* burst flash left behind by the torn pack */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(45% 45% at 50% 45%, color-mix(in srgb,${headerColor} 45%,transparent), transparent 70%)`, animation: "burstFlash .7s ease-out both" }} />
        <div style={{ display: "flex", alignItems: "center", padding: "16px 26px" }}>
          <button onClick={() => { setView("inventory"); loadInventory(); }} style={backBtn}>‹ Packs</button>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", minHeight: 0 }}>
          <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "4px", color: headerColor, textTransform: "uppercase" }}>
            {meta.tag} PACK · GENESIS
          </div>
          <div style={{ font: `900 ${isMobile ? 24 : 34}px var(--font-cinzel,'Cinzel',serif)`, color: "#fff", marginTop: 8, textTransform: "uppercase", textAlign: "center" }}>
            {allRevealed ? `${rarityLabel(bestRarity)} Pull!` : "Reveal your cards"}
          </div>
          <div style={{ font: `600 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#8a93a6", marginTop: 6 }}>
            {allRevealed ? `${cards.length} cards added to your collection` : `${flips.filter((f) => f === "up").length} of ${cards.length} revealed`}
          </div>

          <div style={{ display: "flex", gap: isMobile ? 10 : 16, flexWrap: "wrap", justifyContent: "center", margin: isMobile ? "20px 0 20px" : "30px 0 26px" }}>
            {cards.map((card, i) => (
              <FlipCard
                key={i}
                card={card}
                state={flips[i] ?? "down"}
                mobile={isMobile}
                backSrc={cardBack}
                dealDelayMs={i * DEAL_STAGGER_MS}
                onClick={() => flip(i)}
              />
            ))}
          </div>

          {allRevealed ? (
            <div style={{ display: "flex", gap: 14 }}>
              {remaining > 0 && (
                <button onClick={() => openPack(openType)} disabled={busy} style={secondaryBtn}>Open Another ({remaining})</button>
              )}
              <button onClick={() => router.push("/collection")} style={goldBtn}>Add to Collection ›</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={revealAll} style={goldBtn}>Reveal All</button>
              <span style={{ font: `500 11px var(--font-mono,'JetBrains Mono',monospace)`, color: "#6a7488" }}>Tap each card to flip</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Inventory view ───────────────────────────────────────────
  return (
    <div style={pageBg}>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, padding: isMobile ? "12px 14px" : "16px 26px", flexWrap: "wrap" }}>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back</button>
        <div style={{ font: `900 ${isMobile ? 18 : 22}px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: "1px" }}>Your Packs</div>
        <button onClick={() => router.push("/shop")} style={{ ...goldBtn, marginLeft: "auto", padding: "10px 18px", fontSize: 12 }}>Buy more ›</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "10px 12px 16px" : "10px 26px 16px" }}>
        {error && <div style={{ font: `600 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#ff8a8a", marginBottom: 14 }}>{error}</div>}
        {totalPacks === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#6a7488" }}>
            <GameIcon name="pack" size={56} style={{ margin: "0 auto 14px" }} />
            <div style={{ font: `700 16px var(--font-cinzel,'Cinzel',serif)`, color: "#aeb6c4" }}>No packs yet</div>
            <div style={{ font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, marginTop: 8 }}>Head to the Shop to buy booster packs.</div>
            <button onClick={() => router.push("/shop")} style={{ ...goldBtn, marginTop: 20 }}>Open Shop ›</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 18, maxWidth: 940 }}>
            {inventory.map((p) => {
              const m = packMeta(p.packType);
              return (
                <div key={p.packType} style={{ borderRadius: 16, padding: "20px 16px 18px", background: `linear-gradient(155deg,color-mix(in srgb,${m.color} 10%,transparent),rgba(18,23,35,.55))`, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <PackBack small packType={p.packType} />
                    <div style={{ position: "absolute", top: -8, right: -8, minWidth: 26, height: 26, padding: "0 6px", borderRadius: 13, background: m.color, color: "#1a1206", font: `900 13px var(--font-mono,'JetBrains Mono',monospace)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.4)" }}>×{p.quantity}</div>
                  </div>
                  <div style={{ font: `800 15px var(--font-cinzel,'Cinzel',serif)`, color: "#f1f4f9", marginTop: 14 }}>{m.name}</div>
                  <button onClick={() => openPack(p.packType)} disabled={busy} style={{ ...goldBtn, width: "100%", marginTop: 12, background: `linear-gradient(180deg,${m.color},color-mix(in srgb,${m.color} 70%,#000))` }}>
                    {busy ? "Opening…" : "Open Pack"}
                  </button>
                  <button onClick={() => setSellPack(p.packType)} style={{ cursor: "pointer", width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,.16)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` }}>
                    Sell Pack
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="packs" />

      {sellPack && (
        <SellModal
          kind="pack"
          itemId={sellPack}
          title={PACK_META[sellPack]?.name ?? "Pack"}
          onClose={() => setSellPack(null)}
          onListed={loadInventory}
        />
      )}
    </div>
  );
}

function rarityLabel(r: string): string {
  return ({ common: "Solid", rare: "Rare", epic: "Epic", legendary: "Legendary" } as Record<string, string>)[r] ?? "Nice";
}

const TEASE_GLOW: Record<number, string> = {
  1: "rgba(105,160,255,.75)",  // rare — blue
  2: "rgba(190,110,255,.8)",   // epic — purple
  3: "rgba(255,200,80,.9)",    // legendary — gold
};

function FlipCard({ card, state, mobile, backSrc, dealDelayMs, onClick }: {
  card: CardData;
  state: FlipState;
  mobile?: boolean;
  backSrc: string;
  dealDelayMs: number;
  onClick: () => void;
}) {
  // Must match the revealed CardComponent size exactly: sm (130×190) on mobile, md (195×285) otherwise.
  const w = mobile ? 130 : 195, h = mobile ? 190 : 285;
  const rank = RARITY_RANK[card.rarity] ?? 0;
  const tease = state === "tease";
  const up = state === "up";
  // Tease creeps to 78° (still showing the back edge-on), then snaps through to 180°.
  const rot = up ? 180 : tease ? 78 : 0;
  const glow = TEASE_GLOW[rank] ?? TEASE_GLOW[1];

  return (
    <div
      data-sound-skip-click
      onClick={onClick}
      style={{
        width: w, height: h, position: "relative", perspective: 1000,
        cursor: up ? "default" : "pointer",
        animation: `dealIn ${DEAL_IN_MS}ms cubic-bezier(.2,.85,.3,1.08) ${dealDelayMs}ms both`,
      }}
    >
      {tease && (
        <div style={{ position: "absolute", inset: -22, borderRadius: 20, pointerEvents: "none", background: `radial-gradient(50% 50% at 50% 50%, ${glow}, transparent 70%)`, animation: `teaseGlow ${TEASE_MS}ms ease-in both` }} />
      )}
      <div
        style={{
          position: "absolute", inset: 0, transformStyle: "preserve-3d",
          transform: `rotateY(${rot}deg)`,
          transition: up
            ? "transform .5s cubic-bezier(.45,.05,.3,1.15)"
            : tease
              ? `transform ${TEASE_MS}ms cubic-bezier(.25,.5,.35,1)`
              : "none",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
          <img
            src={backSrc}
            alt=""
            draggable={false}
            style={{ width: w, height: h, borderRadius: CARD_BACK_RADIUS, objectFit: "cover", boxShadow: "0 10px 26px rgba(0,0,0,.5)" }}
          />
        </div>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <CardComponent card={card} size={mobile ? "sm" : "md"} glowing={rank >= 2} />
        </div>
      </div>
    </div>
  );
}

function PackKeyframes() {
  return (
    <style>{`
      @keyframes packEnter {
        from { transform: translateY(55vh) scale(.45) rotate(-4deg); opacity: 0; }
        to   { transform: none; opacity: 1; }
      }
      @keyframes packShake {
        0%, 100% { transform: rotate(0) scale(1); }
        12% { transform: rotate(-7deg) scale(1.03); }
        24% { transform: rotate(6deg) scale(1.05); }
        36% { transform: rotate(-8deg) scale(1.06); }
        48% { transform: rotate(7deg) scale(1.08); }
        60% { transform: rotate(-6deg) scale(1.1); }
        72% { transform: rotate(5deg) scale(1.12); }
        86% { transform: rotate(-3deg) scale(1.16); }
      }
      @keyframes burstFlash {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
      @keyframes dealIn {
        from { transform: translateY(-24vh) scale(.35) rotate(-5deg); opacity: 0; }
        55%  { opacity: 1; }
        to   { transform: none; opacity: 1; }
      }
      @keyframes teaseGlow {
        from { opacity: 0; transform: scale(.85); }
        to   { opacity: 1; transform: scale(1.06); }
      }
      @keyframes hintPulse {
        0%, 100% { opacity: .55; }
        50% { opacity: 1; }
      }
    `}</style>
  );
}

function PackBack({ small, packType = "standard" }: { small?: boolean; packType?: string }) {
  const w = small ? 150 : 230, h = small ? 215 : 330;
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

const pageBg: React.CSSProperties = {
  position: "fixed", inset: 0, display: "flex", flexDirection: "column",
  background: "radial-gradient(140% 90% at 50% -8%,#181206 0%,#0b0a09 55%,#06080d 100%)",
  fontFamily: "var(--font-archivo,'Archivo',sans-serif)",
};
const backBtn: React.CSSProperties = { cursor: "pointer", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)` };
const goldBtn: React.CSSProperties = { cursor: "pointer", border: "none", padding: "13px 26px", borderRadius: 11, font: `800 14px var(--font-cinzel,'Cinzel',serif)`, color: "#2a1a00", background: "linear-gradient(180deg,#ffe07a,#e0890f)", boxShadow: "0 8px 20px rgba(224,137,15,.35), inset 0 1px 0 rgba(255,255,255,.5)" };
const secondaryBtn: React.CSSProperties = { cursor: "pointer", padding: "13px 22px", borderRadius: 11, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", color: "#e7ecf3", font: `700 13px var(--font-cinzel,'Cinzel',serif)` };
