"use client";

import React from "react";
import GameIcon from "./GameIcon";

interface Props {
  amount: number | string;
  iconSize?: number;
  style?: React.CSSProperties;
}

export default function FragmentAmount({ amount, iconSize = 14, style }: Props) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...style }}>
      <GameIcon name="fragment" size={iconSize} />
      <span>{amount}</span>
    </span>
  );
}
