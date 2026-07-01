"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BRAND } from "@/lib/brand";

interface AuthStore {
  token: string | null;
  userId: string | null;
  username: string | null;
  walletAddress: string | null;
  hasUsername: boolean;
  fragments: number;
  rankTier: string;

  setAuth: (token: string, userId: string, username: string) => void;
  setWallet: (address: string | null) => void;
  setHasUsername: (v: boolean) => void;
  setUsername: (name: string) => void;
  setFragments: (n: number) => void;
  setRankTier: (tier: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      username: null,
      walletAddress: null,
      hasUsername: false,
      fragments: 0,
      rankTier: "bronze",

      setAuth: (token, userId, username) => {
        if (typeof window !== "undefined") {
          localStorage.setItem(BRAND.authTokenKey, token);
          localStorage.removeItem(BRAND.legacyAuthTokenKey);
        }
        set({ token, userId, username });
      },

      setWallet: (walletAddress) => set({ walletAddress }),
      setHasUsername: (hasUsername) => set({ hasUsername }),
      setUsername: (username) => set({ username }),
      setFragments: (fragments) => set({ fragments }),
      setRankTier: (rankTier) => set({ rankTier }),

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(BRAND.authTokenKey);
          localStorage.removeItem(BRAND.legacyAuthTokenKey);
        }
        set({ token: null, userId: null, username: null, walletAddress: null, hasUsername: false });
      },
    }),
    { name: "mempool-auth" }
  )
);
