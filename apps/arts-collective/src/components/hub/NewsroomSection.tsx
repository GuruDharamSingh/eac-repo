import {
  getMemberRoster,
  getNetworkUpcomingEvents,
  getNetworkFrontFeed,
  getNetworkCounts,
  groupEventsByCity,
} from "@/lib/network";
import { PORTAL_CSS, buildNewsroomHtml } from "@/lib/cms/community-render";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { CommunityGame } from "@/components/sites/CommunityGame";
import { ActiveArtPortal } from "@/components/sites/ActiveArtPortal";
import { getArcadeArtwork } from "@/lib/arcade";
import { calculateSkyAt } from "@elkdonis/astro/server";
import { SkySection } from "@/components/sites/SkySection";

/**
 * PORTAL_CSS was written for a page of its own: a global reset, `:root`
 * tokens and html/body/a rules. Inside the hub those would restyle the hub's
 * header and tabs, so the global selectors are rewritten to the wrapper.
 * `:where()` keeps their specificity at zero, as the originals were, so the
 * portal's own class rules still win.
 */
const SCOPED_PORTAL_CSS = PORTAL_CSS
  .replace(
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    ":where(.ep-scope) *,:where(.ep-scope) *::before,:where(.ep-scope) *::after{box-sizing:border-box;margin:0;padding:0}"
  )
  .replace(":root {", ".ep-scope {")
  .replace(/^html \{[^}]*\}$/m, "")
  .replace(/^body \{([^}]*)\}$/m, ".ep-scope {$1}")
  .replace(/^a \{/m, ":where(.ep-scope) a {")
  .replace(/^a:hover \{/m, ":where(.ep-scope) a:hover {") +
  // The sky column's moon disc is rotated; its bounding square overhangs the
  // circle and gave the page a horizontal scroll at phone width (2026-10-03).
  "\n.ep-scope .eac-pen-moon { overflow: clip; }\n";

/**
 * The network newsroom (front feed, events by city, member roster, the
 * active-art portal, the arcade game and the sky), which was the
 * arts-collective.com landing until 2026-10-03. It now lives on the hub's
 * Community tab.
 */
export async function NewsroomSection({
  user,
}: {
  user: { email: string } | null;
}) {
  const skyAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  const sky = calculateSkyAt(skyAt);

  const [memberOrgs, counts, events, feed, homes, artwork] = await Promise.all([
    getMemberRoster(24),
    // Counted, not inferred from the roster page's length — see getNetworkCounts.
    getNetworkCounts(),
    getNetworkUpcomingEvents(20),
    getNetworkFrontFeed(20),
    orgHomeUrlMap(),
    getArcadeArtwork(),
  ]);

  const html = buildNewsroomHtml({
    memberOrgs,
    counts,
    orgHomeUrls: Object.fromEntries(
      memberOrgs.map((m) => [m.slug, orgHomeUrl(homes, m.slug)])
    ),
    eventsByCity: groupEventsByCity(events),
    feed,
    isUserLoggedIn: Boolean(user),
    userDisplayName: user?.email.split("@")[0] ?? null,
    loginUrl: "/login",
    signupUrl: "/login?mode=signup",
  });

  return (
    <section className="ep-scope -mx-6 mb-12 sm:mx-0">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_PORTAL_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <ActiveArtPortal />
      <CommunityGame subtitle="A LITTLE ROMP" artwork={artwork} />
      <SkySection
        initialIso={skyAt.toISOString()}
        initialChart={sky}
        skyUrl={process.env.NEXT_PUBLIC_ELASTROCAL_URL ?? "/astro"}
      />
    </section>
  );
}
