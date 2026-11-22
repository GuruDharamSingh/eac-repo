import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { siteConfig } from "@/config/site";
import { ArrivalNotice } from "@elkdonis/cms-ui/network";
import { SiteHeader } from "@/components/site-header";
import { NetworkBar } from "@/components/network-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteChrome } from "@/components/site-chrome";
import { siteStyleCss, siteStyleFontsHref } from "@elkdonis/direct-edit/site";
import { loadSiteStyle } from "@/lib/site-style";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { getPagesEditor } from "@/lib/puck/auth";
import { SiteStyleButton } from "@/components/site-style/SiteStyleButton";
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

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Site style: stored values over SITE_STYLE's defaults, as one <style>. Nothing
  // stored = nothing emitted, so visitors see globals.css exactly as before.
  // The button is for marketplace owners/editors only (the action checks again).
  const [siteStyle, editor] = await Promise.all([
    loadSiteStyle().catch(() => null),
    getPagesEditor().catch(() => null),
  ]);
  const styleCss = siteStyleCss(siteStyle, SITE_STYLE);
  const styleFonts = siteStyleFontsHref(siteStyle, SITE_STYLE);
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* In <body> (as katie): a plain <style> keeps its data attribute, and the
            editor finds it to switch it off while previewing. Unlayered, after globals.css. */}
        {styleFonts ? <link rel="stylesheet" href={styleFonts} /> : null}
        {styleCss ? <style data-site-style="" dangerouslySetInnerHTML={{ __html: styleCss }} /> : null}
        <SiteChrome>
          <NetworkBar />
          <SiteHeader />
        </SiteChrome>
        {children}
        <SiteChrome>
          <SiteFooter />
        </SiteChrome>
        {editor ? <SiteStyleButton initial={siteStyle} /> : null}
        <Toaster richColors position="top-right" />
        <ArrivalNotice endpoint="/api/network/arrival" />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
