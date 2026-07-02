"use client";

import React from "react";
import { useViewportSize } from "@/hooks/useViewport";

/**
 * Renders children at a fixed design canvas and scales the whole thing with a
 * CSS transform to fit the viewport, letterboxed on black. This makes the dense,
 * fixed-pixel battle board resolution-independent without touching its internal
 * layout. All HUD/overlays are children, so they scale together and stay aligned.
 *
 * The design canvas is intentionally large (1440x810) so that on a normal 1080p
 * screen the whole board renders a touch smaller than 1:1-per-pixel would, giving
 * more breathing room and preventing elements from overlapping. `maxScale` caps
 * how large it can blow up on very big / high-DPI monitors (letterboxed beyond).
 */
export default function ScaleToFit({
  children,
  designWidth = 1440,
  designHeight = 810,
  maxScale = 1.4,
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
