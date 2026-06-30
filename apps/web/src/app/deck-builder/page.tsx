"use client";

import React from "react";
import { useRouter } from "next/navigation";
import DeckBuilder from "@/components/DeckBuilder/DeckBuilder";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";

export default function DeckBuilderPage() {
  const { token } = useAuthStore();
  const router = useRouter();
  if (!token) return <AuthModal />;
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <button onClick={() => router.push("/collection")} style={{ position: "absolute", top: 14, left: 14, zIndex: 60, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10, background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.15)", color: "#cdd4df", font: "700 12px var(--font-archivo,'Archivo',sans-serif)" }}>‹ Back</button>
      <DeckBuilder />
    </div>
  );
}
