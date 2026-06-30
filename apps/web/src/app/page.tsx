"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import Dashboard from "@/components/Dashboard/Dashboard";
import AuthModal from "@/components/Auth/AuthModal";

export default function HomePage() {
  const { token, hasUsername } = useAuthStore();
  const { gameId } = useGameStore();
  const router = useRouter();

  // Reconnect: if a match is in progress, jump back into it
  useEffect(() => {
    if (gameId) router.push(`/game/${gameId}`);
  }, [gameId, router]);

  if (!token || !hasUsername) {
    return <AuthModal />;
  }

  return <Dashboard />;
}
