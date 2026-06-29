import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar/Navbar";
import { Cinzel, Archivo, JetBrains_Mono } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["600","700","800","900"], variable: "--font-cinzel", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-archivo", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500","700","800"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Degen TCG — The Crypto Trading Card Game",
  description: "A crypto-native trading card game. HODL minions, Rug Pull enemies, and go to the moon.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${cinzel.variable} ${archivo.variable} ${jetbrainsMono.variable}`}>
      <body style={{ background: "#06080d", color: "#c8d0e0", fontFamily: "var(--font-archivo, system-ui, sans-serif)", minHeight: "100vh" }}>
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
