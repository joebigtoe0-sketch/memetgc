"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { Adapter } from "@solana/wallet-adapter-base";
import { useSocket } from "@/hooks/useSocket";

const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

function SocketInit() {
  useSocket();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Modern wallets register via the Wallet Standard and are auto-detected,
  // so we don't need to hard-code adapters here.
  const wallets = useMemo<Adapter[]>(() => [], []);

  if (!mounted) {
    // Render a neutral shell until the client mounts so components that depend
    // on the Solana wallet context never render without a provider (SSR safety).
    return <div style={{ width: "100vw", height: "100vh", background: "#06080d" }} />;
  }

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SocketInit />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
