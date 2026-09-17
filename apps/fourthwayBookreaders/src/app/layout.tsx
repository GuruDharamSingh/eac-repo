import "./globals.css";
import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import { listOrgFeeds } from "@elkdonis/services";
import { Curtains } from "@/components/curtains";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

// The one webfont: the face the book's page is set in. Everything else is the
// system's Georgia and Verdana, which is both the old-web look and zero bytes.
const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: siteConfig.orgName, template: `%s · ${siteConfig.orgName}` },
  description: `${siteConfig.tagline}. Currently reading Beelzebub's Tales to His Grandson.`,
};

/**
 * Every page is rendered per request: the header reads the session, and the
 * whole site is database-driven. Saying so stops Next attempting static
 * generation and failing on the cookie read.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);
  // Nav grows from org_feeds, so a new section of the site is a row, not a deploy.
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: false }).catch(() => []);

  return (
    <html lang="en" suppressHydrationWarning className={garamond.variable}>
      <body suppressHydrationWarning>
        <Curtains />
        <div className="page">
          <SiteHeader
            signedIn={Boolean(viewer)}
            canEdit={canEdit}
            isMember={Boolean(viewer?.isMember)}
            feeds={feeds.filter((f) => f.isPublic).map((f) => ({ slug: f.slug, name: f.name }))}
          />
          <main style={{ flex: 1 }}>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
