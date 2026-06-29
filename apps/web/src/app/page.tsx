"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";
import HeroSelect from "@/components/HeroSelect/HeroSelect";
import GameBoard from "@/components/Game/GameBoard";
import AuthModal from "@/components/Auth/AuthModal";

export default function HomePage() {
  const { token, username } = useAuthStore();
  const { gameId } = useGameStore();
  const router = useRouter();

  useSocket(); // Initialize socket connection

  // Redirect to game if in a match
  useEffect(() => {
    if (gameId) router.push(`/game/${gameId}`);
  }, [gameId, router]);

  if (!token) {
    return <AuthModal />;
  }

  return (
    <div className="h-full w-full">
      <HeroSelect />
    </div>
  );
}
