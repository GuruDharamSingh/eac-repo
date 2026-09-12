import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Noto_Sans_Symbols } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Astrological glyphs for @elkdonis/sky-ui's list (sky.css reads this var).
// Without it the zodiac signs fall back to the system's EMOJI forms.
const notoSymbols = Noto_Sans_Symbols({
  subsets: ["symbols"],
  weight: ["400"],
  variable: "--font-symbols",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elkdonis Arts Collective",
  description:
    "Join the collective — a home for artists, makers, writers, and performers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${notoSymbols.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
