"use client";

import React from "react";
import DeckBuilder from "@/components/DeckBuilder/DeckBuilder";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/Auth/AuthModal";

export default function DeckBuilderPage() {
  const { token } = useAuthStore();
  if (!token) return <AuthModal />;
  return <DeckBuilder />;
}
