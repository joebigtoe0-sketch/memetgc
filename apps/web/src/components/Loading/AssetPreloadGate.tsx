"use client";

import React, { useEffect, useState } from "react";
import { areAssetsReady, preloadAllAssets } from "@/lib/assetPreloader";
import AssetLoadingScreen from "./AssetLoadingScreen";

export default function AssetPreloadGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState("Starting…");

  useEffect(() => {
    if (areAssetsReady()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    preloadAllAssets((p) => {
      if (cancelled) return;
      setPercent(p.percent);
      setPhase(p.phase);
    })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <AssetLoadingScreen percent={percent} phase={phase} />;
  }

  return <>{children}</>;
}
