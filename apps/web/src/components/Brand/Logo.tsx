"use client";

import React from "react";
import { BRAND } from "@/lib/brand";

interface Props {
  size?: number;
  style?: React.CSSProperties;
}

export default function Logo({ size = 38, style }: Props) {
  return (
    <img
      src={BRAND.logoUrl}
      alt={BRAND.shortName}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
