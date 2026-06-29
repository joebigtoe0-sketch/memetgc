"use client";

import React, { useState, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useSocket } from "@/hooks/useSocket";

const queryClient = new QueryClient();

function SocketInit() {
  useSocket();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SocketInit />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
