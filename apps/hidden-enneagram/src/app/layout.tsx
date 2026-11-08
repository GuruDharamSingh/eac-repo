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
import { LookWatcher } from "@/components/site-style/look-watcher";
import { SiteAudio } from "@/components/music/site-audio";
import { loadAudioConfig } from "@/lib/audio-config";
import { DEFAULT_AUDIO } from "@/lib/audio-config-schema";
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
  themeColor: "#0a0a0c",
};

/** Every page reads the session (to offer editing to Ario), so nothing is prerendered. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);

  // Editors compose into private feeds too; visitors only see public ones.
  const [feeds, siteStyle, sections, audio] = await Promise.all([
    listOrgFeeds(siteConfig.orgId, { includePrivate: canEdit }).catch(() => []),
    loadSiteStyle().catch(() => null),
    getSiteSections().catch(() => ({}) as Awaited<ReturnType<typeof getSiteSections>>),
    loadAudioConfig().catch(() => DEFAULT_AUDIO),
  ]);

  // Round 3, the quiet site: one line of five on the bar (the exposition,
  // the readings, the writing, the music, About). The rest (the forum, the
  // other feeds a viewer may open, the course) sit in the account menu and
  // the phone sheet, and in the footer for visitors. "services" is a feed
  // too, but its page is /readings now; the course is de-emphasised.
  const visible = feeds.filter((f) => canViewFeed(f, viewer?.role ?? null));
  const writing = visible.find((f) => f.slug === "writing");
  const links: HeaderLink[] = [
    { href: "/enneagram", label: "The Enneagram" },
    { href: "/readings", label: "Readings" },
    ...(writing ? [{ href: "/writing", label: writing.name }] : []),
    { href: "/music", label: "Music" },
    { href: "/about", label: "About" },
  ];
  const more: HeaderLink[] = [
    { href: "/forum", label: "Forum" },
    ...visible
      .filter((f) => f.slug !== "writing" && f.slug !== "services")
      .map((f) => ({ href: `/${f.slug}`, label: f.name, locked: Boolean(f.minRole) })),
    { href: courseUrl(), label: "Free course" },
  ];

  // The site style (elktours' pattern): stored values over SITE_STYLE's
  // defaults, as one <style>. Nothing stored = nothing emitted. In <body> so it
  // keeps its data attribute; unlayered and after globals.css, so it wins.
  const styleCss = siteStyleCss(siteStyle, SITE_STYLE);
  const styleFonts = siteStyleFontsHref(siteStyle, SITE_STYLE);
  const footer = sections.footer ?? {};
  // Round 3: the look preset ("quiet" = Ario's original Silex look, the default; "aeon" = round 1's ÆON).
  const look = siteStyle?.theme?.["--he-look"] === "aeon" ? "aeon" : "quiet";

  return (
    <html lang="en" suppressHydrationWarning className={fontVariables} data-he-look={look}>
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
          <SiteHeader links={links} more={more} signedIn={Boolean(viewer)} canEdit={canEdit} isMember={Boolean(viewer?.isMember)} email={viewer?.email ?? null} />
          {/* Not a <main>: most pages bring their own (they did before the header moved here). */}
          <div className="flex-1">{children}</div>
          <SiteFooter body={footer.body} note={footer.note} />
        </HubSurfaces>
        {canEdit ? <SiteStyleButton initial={siteStyle} /> : null}
        {canEdit ? <LookWatcher /> : null}
        {/* Ario's music and the figure's site sound defaults: one island, kept across navigation. */}
        <SiteAudio config={audio} />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
