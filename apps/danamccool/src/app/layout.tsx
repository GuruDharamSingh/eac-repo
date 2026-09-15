import "@elkdonis/cms-ui/gallery.css";
import "./globals.css";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.orgName} — Artist`,
    template: `%s · ${siteConfig.orgName}`,
  },
  description:
    "Dana McCool, interdisciplinary artist, designer and writer. Surrealist paintings, mixed media, collage and installation work.",
};

/**
 * Every page reads the session (to offer editing to the site's owner), so
 * there's nothing meaningful to prerender — same reasoning as amrit-canada's
 * root layout.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="site-shell">
        <SiteHeader canEdit={Boolean(viewer?.canEdit)} />
        <div className="site-content">
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
