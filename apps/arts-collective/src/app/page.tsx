import { getCurrentUser } from "@/lib/session";
import {
  getMemberRoster,
  getNetworkUpcomingEvents,
  getNetworkFrontFeed,
  groupEventsByCity,
} from "@/lib/network";
import {
  PORTAL_CSS,
  buildNewsroomHtml,
} from "@/lib/cms/community-render";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { CommunityGame } from "@/components/sites/CommunityGame";
import { ActiveArtPortal } from "@/components/sites/ActiveArtPortal";
import { getArcadeArtwork } from "@/lib/arcade";
import { calculateSkyAt } from "@elkdonis/astro/server";
import { SkySection } from "@/components/sites/SkySection";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();

  // The sky face's first chart, rendered here so the section arrives complete.
  const skyAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  const sky = calculateSkyAt(skyAt);

  const [memberOrgs, events, feed, homes, artwork] = await Promise.all([
    getMemberRoster(24),
    getNetworkUpcomingEvents(20),
    getNetworkFrontFeed(20),
    orgHomeUrlMap(),
    getArcadeArtwork(),
  ]);

  const html = buildNewsroomHtml({
    memberOrgs,
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
    <>
      <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <ActiveArtPortal />
      <CommunityGame subtitle="A LITTLE ROMP" artwork={artwork} />
      <SkySection
        initialIso={skyAt.toISOString()}
        initialChart={sky}
        skyUrl={process.env.NEXT_PUBLIC_ELASTROCAL_URL ?? "/astro"}
      />
    </>
  );
}
