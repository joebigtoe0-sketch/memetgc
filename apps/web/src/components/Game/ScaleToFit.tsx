"use client";

import React from "react";
import { useViewportSize } from "@/hooks/useViewport";

/**
 * Renders children at a fixed design canvas (default 1280x720) and scales the
 * whole thing with a CSS transform to fit the viewport, letterboxed on black.
 * This makes the dense, fixed-pixel battle board resolution-independent without
 * touching its internal layout. All HUD/overlays are children, so they scale
 * together and stay aligned.
 */
export default function ScaleToFit({
  children,
  designWidth = 1280,
  designHeight = 720,
}: {
  children: React.ReactNode;
  designWidth?: number;
  designHeight?: number;
}) {
  const { w, h } = useViewportSize();
  const scale = Math.min(w / designWidth, h / designHeight);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: designWidth,
          height: designHeight,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}
