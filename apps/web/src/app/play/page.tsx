"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import HeroSelect from "@/components/HeroSelect/HeroSelect";
import AuthModal from "@/components/Auth/AuthModal";

export default function PlayPage() {
  const { token } = useAuthStore();
  const { gameId } = useGameStore();
  const router = useRouter();

  useEffect(() => {
    if (gameId) router.push(`/game/${gameId}`);
  }, [gameId, router]);

  if (!token) return <AuthModal />;

  return (
    <Suspense fallback={null}>
      <HeroSelect />
    </Suspense>
  );
}
