"use client";

import React from "react";

interface Props {
  url: string | null;
}

export default function BoardBackground({ url }: Props) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "#070a10", pointerEvents: "none" }} />
      {url && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}
