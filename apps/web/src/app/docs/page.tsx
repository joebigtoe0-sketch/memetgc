"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Brand/Logo";
import { BRAND } from "@/lib/brand";
import { DOC_GROUPS, ALL_SECTIONS } from "./docsContent";

export default function DocsPage() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string>(ALL_SECTIONS[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const clickScrollingRef = useRef(false);

  // Scroll-spy: highlight the section nearest the top of the scroll container.
  const handleScroll = useCallback(() => {
    if (clickScrollingRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const top = container.scrollTop;
    const offset = 120;
    let current = ALL_SECTIONS[0]?.id ?? "";
    for (const s of ALL_SECTIONS) {
      const el = sectionRefs.current[s.id];
      if (el && el.offsetTop - offset <= top) current = s.id;
    }
    setActiveId(current);
  }, []);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    c.addEventListener("scroll", handleScroll, { passive: true });
    return () => c.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const jumpTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    const container = scrollRef.current;
    if (!el || !container) return;
    setActiveId(id);
    setMenuOpen(false);
    clickScrollingRef.current = true;
    container.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    window.setTimeout(() => { clickScrollingRef.current = false; }, 650);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "radial-gradient(140% 90% at 50% -8%,#141b2a 0%,#090c13 60%,#06080d 100%)", fontFamily: "var(--font-archivo,'Archivo',sans-serif)" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(120% 80% at 85% -10%,rgba(247,147,26,.06),transparent 55%),radial-gradient(100% 80% at 0% 110%,rgba(123,140,244,.06),transparent 55%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <header style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 72px 14px 22px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(8,11,18,.55)", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="docs-menu-btn" onClick={() => setMenuOpen((v) => !v)} style={hamburgerBtn} aria-label="Toggle menu">☰</button>
          <Logo size={34} />
          <div>
            <div style={{ font: `900 16px/1 var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", letterSpacing: ".5px" }}>{BRAND.shortName.toUpperCase()} DOCS</div>
            <div style={{ font: `600 9px var(--font-mono,'JetBrains Mono',monospace)`, color: "#f7931a", letterSpacing: "1.5px", marginTop: 3 }}>GAME GUIDE</div>
          </div>
        </div>
        <button onClick={() => router.push("/")} style={backBtn}>‹ Back to game</button>
      </header>

      {/* Body */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar */}
        <aside
          className={`docs-sidebar${menuOpen ? " docs-sidebar-open" : ""}`}
          style={{ width: 276, flexShrink: 0, overflowY: "auto", padding: "22px 14px 40px", borderRight: "1px solid rgba(255,255,255,.07)", background: "rgba(10,13,20,.5)" }}
        >
          {DOC_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 22 }}>
              <div style={{ font: `700 10px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "2px", color: "#6a7488", textTransform: "uppercase", padding: "0 10px 8px" }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {group.sections.map((s) => {
                  const on = s.id === activeId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => jumpTo(s.id)}
                      style={{
                        textAlign: "left", cursor: "pointer", border: "none", borderRadius: 8,
                        padding: "8px 12px",
                        font: `${on ? 700 : 500} 13px var(--font-archivo,'Archivo',sans-serif)`,
                        color: on ? "#f3e8cc" : "#9aa3b4",
                        background: on ? "rgba(247,147,26,.12)" : "transparent",
                        boxShadow: on ? "inset 2px 0 0 #f7931a" : "none",
                        transition: "background .12s ease, color .12s ease",
                      }}
                    >
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Backdrop for mobile menu */}
        {menuOpen && <div className="docs-backdrop" onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 5 }} />}

        {/* Content */}
        <main ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "32px clamp(20px, 6vw, 90px) 120px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {/* Hero intro */}
            <div style={{ font: `700 11px var(--font-mono,'JetBrains Mono',monospace)`, letterSpacing: "3px", color: "#f7931a" }}>
              {BRAND.fullName.toUpperCase()}
            </div>
            <h1 style={{ font: `900 40px/1.05 var(--font-cinzel,'Cinzel',serif)`, color: "#f6efdc", margin: "10px 0 14px", letterSpacing: ".5px" }}>
              GAME GUIDE
            </h1>
            <p style={{ font: `500 15px/1.7 var(--font-archivo,'Archivo',sans-serif)`, color: "#aeb7c6", margin: "0 0 8px", maxWidth: 640 }}>
              Everything you need to play {BRAND.fullName} — the rules, factions, decks, packs, fragments, the
              marketplace, and how to climb the ladder. Use the sidebar to jump to any topic.
            </p>

            <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "28px 0 8px" }} />

            {ALL_SECTIONS.map((s) => (
              <section
                key={s.id}
                id={s.id}
                ref={(el) => { sectionRefs.current[s.id] = el; }}
                style={{ paddingTop: 34, scrollMarginTop: 24 }}
              >
                <h2 style={{ font: `900 25px var(--font-cinzel,'Cinzel',serif)`, color: "#f3e8cc", margin: "0 0 16px", letterSpacing: ".3px" }}>
                  {s.title}
                </h2>
                {s.body}
              </section>
            ))}

            <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.08)", font: `500 12px var(--font-archivo,'Archivo',sans-serif)`, color: "#5a6478" }}>
              {BRAND.fullName} — {BRAND.tagline}
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .docs-menu-btn { display: none; }
        @media (max-width: 860px) {
          .docs-menu-btn { display: inline-flex !important; }
          .docs-sidebar {
            position: fixed !important;
            top: 0; bottom: 0; left: 0;
            z-index: 6;
            transform: translateX(-100%);
            transition: transform .22s ease;
            padding-top: 74px !important;
          }
          .docs-sidebar-open { transform: translateX(0) !important; }
        }
        @media (min-width: 861px) {
          .docs-backdrop { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  cursor: "pointer", padding: "8px 14px", borderRadius: 10,
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
  color: "#cdd4df", font: `700 12px var(--font-archivo,'Archivo',sans-serif)`,
};

const hamburgerBtn: React.CSSProperties = {
  cursor: "pointer", width: 36, height: 36, borderRadius: 9,
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)",
  color: "#cdd4df", font: "16px system-ui", alignItems: "center", justifyContent: "center",
};
