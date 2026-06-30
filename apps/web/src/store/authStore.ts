"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
          localStorage.setItem("degen_token", token);
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
          localStorage.removeItem("degen_token");
        }
        set({ token: null, userId: null, username: null, walletAddress: null, hasUsername: false });
      },
    }),
    { name: "degen-auth" }
  )
);
