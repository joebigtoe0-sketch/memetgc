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
          <div style={{ display: "flex", justifyContent: "center", padding: "16px 16px 0", background: "#06080d", minHeight: "calc(100vh - 52px)" }}>
            <main style={{ width: "100%", maxWidth: 1480, height: "calc(100vh - 84px)", overflow: "hidden", borderRadius: 18, border: "1px solid rgba(231,199,104,.18)", boxShadow: "0 30px 80px rgba(0,0,0,.6)", position: "relative" }}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
