"use client";

import React from "react";
import { useViewportSize } from "@/hooks/useViewport";

/**
 * Renders children at a fixed 16:9 design canvas (1920x1080) and scales the whole
 * thing with a CSS transform to fit the viewport. This makes the dense, fixed-pixel
 * battle board resolution-independent without touching its internal layout. All
 * HUD/overlays are children, so they scale together and stay aligned.
 *
 * Because the canvas is 16:9, any normal 16:9 monitor fills edge-to-edge with NO
 * letterbox bars (scale = viewport / canvas on both axes). Bars only appear on
 * genuinely off-aspect displays (ultrawide / very tall), and only on one axis.
 * On a 1080p screen scale is 1.0 (pixel-perfect); it scales up proportionally on
 * bigger monitors and down on smaller ones. `maxScale` is a very high safety cap.
 */
export default function ScaleToFit({
  children,
  designWidth = 1920,
  designHeight = 1080,
  maxScale = 4,
}: {
  children: React.ReactNode;
  designWidth?: number;
  designHeight?: number;
  maxScale?: number;
}) {
  const { w, h } = useViewportSize();
  const scale = Math.min(w / designWidth, h / designHeight, maxScale);

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
