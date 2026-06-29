"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { DEGEN_CONTRACT, ERC20_BALANCE_ABI } from "@/lib/wagmi";
import { formatUnits } from "viem";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { walletAddress, setWallet } = useAuthStore();
  const [error, setError] = useState("");
  const [linking, setLinking] = useState(false);

  const { data: degenBalance } = useReadContract({
    address: DEGEN_CONTRACT,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Auto-link wallet to profile when connected
  useEffect(() => {
    if (isConnected && address && address !== walletAddress) {
      setLinking(true);
      api.post("/api/auth/wallet", { walletAddress: address })
        .then(() => setWallet(address))
        .catch((e: unknown) => setError((e as Error).message ?? "Failed to link wallet"))
        .finally(() => setLinking(false));
    }
  }, [isConnected, address, walletAddress, setWallet]);

  const balanceFormatted = degenBalance !== undefined
    ? parseFloat(formatUnits(degenBalance, 18)).toFixed(0)
    : null;

  const DEGEN_THRESHOLD = BigInt(1000) * BigInt(10) ** BigInt(18);
  const hasEnoughDegen = degenBalance !== undefined && degenBalance >= DEGEN_THRESHOLD;

  if (isConnected && address) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
          style={{
            background: "rgba(43,189,134,0.1)",
            border: "1px solid #2bbd86",
            color: "#2bbd86",
          }}
          title="Click to disconnect"
          onClick={() => { disconnect(); setWallet(""); }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        {linking && <p className="text-xs" style={{ color: "#6080a0" }}>Linking...</p>}
        {balanceFormatted !== null && (
          <div
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: hasEnoughDegen ? "rgba(247,147,26,0.1)" : "rgba(100,40,40,0.2)",
              border: `1px solid ${hasEnoughDegen ? "#f7931a" : "#804040"}`,
              color: hasEnoughDegen ? "#f7931a" : "#cc4444",
            }}
          >
            {parseInt(balanceFormatted).toLocaleString()} $DEGEN
            {hasEnoughDegen ? " ✓ Ranked" : " — Need 1K"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => { setError(""); connect({ connector: injected() }); }}
        disabled={isConnecting}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
        style={{
          background: isConnecting ? "rgba(20,20,30,0.6)" : "rgba(247,147,26,0.1)",
          border: "1px solid #f7931a",
          color: isConnecting ? "#666" : "#f7931a",
          cursor: isConnecting ? "not-allowed" : "pointer",
        }}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="text-xs mt-1" style={{ color: "#ff4444" }}>{error}</p>}
    </div>
  );
}
