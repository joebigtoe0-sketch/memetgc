import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@memetgc/types"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001",
  },
};

export default nextConfig;
