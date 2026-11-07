import { AnalyticsBeacon } from "@elkdonis/analytics/beacon";
import type { Metadata, Viewport } from "next";
import { canViewFeed, listOrgFeeds } from "@elkdonis/services";
import { siteStyleCss, siteStyleFontsHref } from "@elkdonis/direct-edit/site";
import { getViewer } from "@/lib/auth";
import { getSiteSections } from "@/lib/data";
import { courseUrl, siteConfig } from "@/config/site";
import { fontVariables } from "@/lib/fonts";
import { loadSiteStyle } from "@/lib/site-style";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { HubSurfaces } from "@/components/hub/HubSurfaces";
import { SiteHeader, type HeaderLink } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteStyleButton } from "@/components/site-style/SiteStyleButton";
// The ROOT layout imports every stylesheet, deliberately: Puck's canvas is an
// iframe that mirrors the parent document's <style>/<link> tags, and Next
// scopes a route's CSS import to that route. globals.css pulls in the shared
// blocks, the record frame, the figure (aeon.css), the shell and the kits.
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "The Hidden Enneagram",
    template: "%s · The Hidden Enneagram",
  },
  description:
    "Formative developmental imprints — a map of how core motivations become recurring psychological fixations. Typing sessions, consultations, and study.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07080d",
};

/** Every page reads the session (to offer editing to Ario), so nothing is prerendered. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);

  // Editors compose into private feeds too; visitors only see public ones.
  const [feeds, siteStyle, sections] = await Promise.all([
    listOrgFeeds(siteConfig.orgId, { includePrivate: canEdit }).catch(() => []),
    loadSiteStyle().catch(() => null),
    getSiteSections().catch(() => ({}) as Awaited<ReturnType<typeof getSiteSections>>),
  ]);

  // The menu: the figure first, then the org's feeds (a section is a row in
  // org_feeds, not an edit here), the course, the forum, About.
  const links: HeaderLink[] = [
    { href: "/enneagram", label: "The Figure" },
    ...feeds
      .filter((f) => canViewFeed(f, viewer?.role ?? null))
      .map((f) => ({ href: `/${f.slug}`, label: f.name, locked: Boolean(f.minRole) })),
    { href: courseUrl(), label: "Course" },
    { href: "/forum", label: "Forum" },
    { href: "/about", label: "About" },
  ];

  // The site style (elktours' pattern): stored values over SITE_STYLE's
  // defaults, as one <style>. Nothing stored = nothing emitted. In <body> so it
  // keeps its data attribute; unlayered and after globals.css, so it wins.
  const styleCss = siteStyleCss(siteStyle, SITE_STYLE);
  const styleFonts = siteStyleFontsHref(siteStyle, SITE_STYLE);
  const footer = sections.footer ?? {};

  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body suppressHydrationWarning className="antialiased flex min-h-screen flex-col">
        {styleFonts ? <link rel="stylesheet" href={styleFonts} /> : null}
        {styleCss ? <style data-site-style="" dangerouslySetInnerHTML={{ __html: styleCss }} /> : null}
        {/* One surface system for the whole site: a listing card on a feed
            page and a hub tile open into the same dialog. */}
        <HubSurfaces
          signedIn={Boolean(viewer)}
          userId={viewer?.userId ?? null}
          canEdit={canEdit}
          displayName={viewer?.email.split("@")[0] ?? null}
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name }))}
        >
          <SiteHeader links={links} signedIn={Boolean(viewer)} canEdit={canEdit} isMember={Boolean(viewer?.isMember)} email={viewer?.email ?? null} />
          {/* Not a <main>: most pages bring their own (they did before the header moved here). */}
          <div className="flex-1">{children}</div>
          <SiteFooter body={footer.body} note={footer.note} />
        </HubSurfaces>
        {canEdit ? <SiteStyleButton initial={siteStyle} /> : null}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
