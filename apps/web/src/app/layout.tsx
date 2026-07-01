import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import Providers from "./providers";
import AccessGate from "@/components/Access/AccessGate";
import { BRAND } from "@/lib/brand";
import { Cinzel, Archivo, JetBrains_Mono } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["600","700","800","900"], variable: "--font-cinzel", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-archivo", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500","700","800"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: `${BRAND.fullName} — ${BRAND.shortName}`,
  description: `${BRAND.tagline} A crypto-native trading card game. HODL minions, rug pulls, and climb the ladder.`,
  icons: { icon: BRAND.logoUrl, apple: BRAND.logoUrl },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${cinzel.variable} ${archivo.variable} ${jetbrainsMono.variable}`}>
      <body style={{ background: "#06080d", color: "#c8d0e0", fontFamily: "var(--font-archivo, system-ui, sans-serif)", height: "100vh", overflow: "hidden" }}>
        <Providers>
          <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
            <AccessGate>{children}</AccessGate>
          </div>
        </Providers>
      </body>
    </html>
  );
}
