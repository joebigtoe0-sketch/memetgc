import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar/Navbar";

export const metadata: Metadata = {
  title: "Degen TCG — The Crypto Trading Card Game",
  description: "A crypto-native trading card game. HODL minions, Rug Pull enemies, and go to the moon.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "#060810", color: "#c8d0e0", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
        <Providers>
          <Navbar />
          <main style={{ height: "calc(100vh - 52px)", overflow: "hidden" }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
