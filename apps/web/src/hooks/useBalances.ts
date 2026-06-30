"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface PackEntry { packType: string; quantity: number; }

export function useBalances() {
  const { token } = useAuthStore();
  const [degen, setDegen] = useState<number | null>(null);
  const [degenConfigured, setDegenConfigured] = useState(false);
  const [packs, setPacks] = useState(0);

  const refresh = useCallback(() => {
    if (!token) return;
    api.get<{ balance: number; configured: boolean }>("/api/economy/degen-balance")
      .then((r) => { setDegen(r.balance); setDegenConfigured(r.configured); })
      .catch(() => {});
    api.get<PackEntry[]>("/api/economy/packs/inventory")
      .then((r) => setPacks(r.reduce((s, p) => s + p.quantity, 0)))
      .catch(() => {});
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  return { degen, degenConfigured, packs, refresh };
}
