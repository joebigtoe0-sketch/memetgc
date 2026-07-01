"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BRAND } from "@/lib/brand";
import { API_URL } from "@/lib/constants";
import { clearAssetsReady } from "@/lib/assetPreloader";

interface AccessResponse {
  balance: number;
  required: number;
  hasAccess: boolean;
}

interface AuthStore {
  token: string | null;
  userId: string | null;
  username: string | null;
  walletAddress: string | null;
  hasUsername: boolean;
  fragments: number;
  rankTier: string;

  // Token gate
  hasAccess: boolean | null;
  tokenBalance: number;
  accessRequired: number;
  accessChecking: boolean;

  setAuth: (token: string, userId: string, username: string) => void;
  setWallet: (address: string | null) => void;
  setHasUsername: (v: boolean) => void;
  setUsername: (name: string) => void;
  setFragments: (n: number) => void;
  setRankTier: (tier: string) => void;
  checkAccess: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      userId: null,
      username: null,
      walletAddress: null,
      hasUsername: false,
      fragments: 0,
      rankTier: "bronze",

      hasAccess: null,
      tokenBalance: 0,
      accessRequired: 1000,
      accessChecking: false,

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

      checkAccess: async () => {
        const token = get().token ?? (typeof window !== "undefined"
          ? localStorage.getItem(BRAND.authTokenKey) ?? localStorage.getItem(BRAND.legacyAuthTokenKey)
          : null);
        if (!token) {
          set({ hasAccess: null });
          return;
        }
        set({ accessChecking: true });
        try {
          const res = await fetch(`${API_URL}/api/economy/access`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("access check failed");
          const data = (await res.json()) as AccessResponse;
          set({
            hasAccess: data.hasAccess,
            tokenBalance: data.balance,
            accessRequired: data.required,
            accessChecking: false,
          });
        } catch {
          // On network error, don't lock the user out on a false negative.
          set({ accessChecking: false });
        }
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(BRAND.authTokenKey);
          localStorage.removeItem(BRAND.legacyAuthTokenKey);
        }
        clearAssetsReady();
        set({ token: null, userId: null, username: null, walletAddress: null, hasUsername: false, hasAccess: null, tokenBalance: 0 });
      },
    }),
    { name: "mempool-auth" }
  )
);
