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
import { getArcadeArtwork } from "@/lib/arcade";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();

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
      <CommunityGame subtitle="A LITTLE ROMP" artwork={artwork} />
    </>
  );
}
