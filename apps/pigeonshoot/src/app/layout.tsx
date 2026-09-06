import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { getSiteSections } from "@/lib/data";
import { getViewer } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.orgName,
    template: `%s · ${siteConfig.orgName}`,
  },
  description: siteConfig.tagline,
};

/**
 * Every page is rendered per request.
 *
 * The header reads the session and the guest cookie, and every surface is
 * database-driven, so there is nothing meaningful to prerender. Saying so
 * explicitly avoids Next attempting static generation and failing on the
 * cookie read.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Unlike the amrit-canada template, nav is NOT built from org_feeds here.
  // Pigeonshoot's surfaces (/cards, /map, /species, /places) are product, not
  // editorial sections, so they're fixed routes rather than data.
  const [viewer, sections] = await Promise.all([
    getViewer().catch(() => null),
    getSiteSections(),
  ]);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning className="flex min-h-screen flex-col">
        <SiteHeader signedIn={Boolean(viewer)} canEdit={Boolean(viewer?.canEdit)} />
        <main className="flex-1">{children}</main>
        <SiteFooter content={sections.footer} />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
