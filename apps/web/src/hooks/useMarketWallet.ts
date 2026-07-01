"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuthStore } from "@/store/authStore";

export function useMarketWallet() {
  const { publicKey, signMessage, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const accountWallet = useAuthStore((s) => s.walletAddress);

  const activeWallet = publicKey?.toBase58() ?? null;
  const canSign = connected && !!activeWallet && !!signMessage;
  const canPay = connected && !!activeWallet && !!sendTransaction;
  const walletMismatch =
    !!accountWallet && !!activeWallet && accountWallet !== activeWallet;

  function openConnect() {
    setVisible(true);
  }

  function signWalletError(): string | null {
    if (!accountWallet) return "Sign in with your wallet first";
    if (!canSign) return null; // caller shows connect UI
    if (walletMismatch) {
      return `Connect your account wallet (${accountWallet.slice(0, 4)}…${accountWallet.slice(-4)})`;
    }
    return null;
  }

  function payWalletError(): string | null {
    if (!accountWallet) return "Sign in with your wallet first";
    if (!canPay) return null;
    if (walletMismatch) {
      return `Connect your account wallet (${accountWallet.slice(0, 4)}…${accountWallet.slice(-4)})`;
    }
    return null;
  }

  return {
    publicKey,
    accountWallet,
    activeWallet,
    canSign,
    canPay,
    walletMismatch,
    openConnect,
    signWalletError,
    payWalletError,
    signMessage,
    sendTransaction,
  };
}
