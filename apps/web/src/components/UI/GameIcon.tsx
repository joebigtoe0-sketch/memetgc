"use client";

import React from "react";
import { ICONS, type IconName } from "@/lib/icons";

interface Props {
  name: IconName;
  size?: number;
  style?: React.CSSProperties;
}

export default function GameIcon({ name, size = 20, style }: Props) {
  return (
    <img
      src={ICONS[name]}
      alt=""
      draggable={false}
      style={{ width: size, height: size, objectFit: "contain", display: "block", flexShrink: 0, ...style }}
    />
  );
}
