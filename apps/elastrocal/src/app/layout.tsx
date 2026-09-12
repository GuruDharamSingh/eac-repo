import "./globals.css";
import type { Metadata } from "next";
import { Cinzel, Inter, Noto_Sans_Symbols } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { Surfaces } from "@/components/surfaces";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

// Carries the planet and zodiac glyphs, so they render as line symbols
// rather than whatever emoji the visitor's OS substitutes.
const symbols = Noto_Sans_Symbols({
  subsets: ["symbols"],
  weight: ["400", "700"],
  variable: "--font-symbols",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: siteConfig.orgName, template: `%s · ${siteConfig.orgName}` },
  description: siteConfig.tagline,
};

// The header reads the session on every request.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);

  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable} ${symbols.variable}`}>
      <body suppressHydrationWarning className="flex min-h-screen flex-col">
        <Surfaces signedIn={Boolean(viewer)}>
          <SiteHeader signedIn={Boolean(viewer)} isMember={Boolean(viewer?.isMember)} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Surfaces>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
