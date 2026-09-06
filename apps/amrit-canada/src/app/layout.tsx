import "./globals.css";
import type { Metadata } from "next";
import { Cinzel, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { getSiteSections } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { listOrgFeeds } from "@elkdonis/services";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora",
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
 * The header reads the session to decide between "Sign in" and "Account", and
 * the whole site is database-driven (feeds, gatherings, cycle status), so
 * there is nothing meaningful to prerender. Saying so explicitly avoids Next
 * attempting static generation and failing on the cookie read.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nav is built from org_feeds, so adding a section to the site is a database
  // row rather than a code change.
  const [feeds, viewer, sections] = await Promise.all([
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    getViewer().catch(() => null),
    getSiteSections(),
  ]);

  return (
    <html lang="en" suppressHydrationWarning className={`${cinzel.variable} ${lora.variable}`}>
      <body suppressHydrationWarning className="flex min-h-screen flex-col">
        <SiteHeader
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))}
          signedIn={Boolean(viewer)}
          canEdit={Boolean(viewer?.canEdit)}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter content={sections.footer} />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
