import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrgIdentity } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";
import {
  getMemberRoster,
  getNetworkFrontFeed,
  getNetworkUpcomingEvents,
  getNetworkCounts,
  groupEventsByCity,
} from "@/lib/network";
import { PORTAL_CSS, buildNewsroomHtml } from "@/lib/cms/community-render";
import { orgHomeUrl, orgHomeUrlMap } from "@/lib/org-url.server";
import { isNetworkHost, networkHostWithPort, normalizeDomain } from "@/lib/domain";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import { CommunityGame } from "@/components/sites/CommunityGame";
import { getArcadeArtwork } from "@/lib/arcade";

export const dynamic = "force-dynamic";

/**
 * The scene around the org — for now, the whole network's newsroom.
 *
 * This is the least org-controlled of the three pages by design: it is the
 * visitor's way out of one org and into the wider collective. It renders the
 * same newsroom template as the network's own landing page (one renderer, not
 * a per-org copy — this route previously carried its own 850-line duplicate of
 * it) so what a visitor sees here is what the collective is publishing.
 *
 * Narrowing it to the org's own field and locality — and letting the org
 * suggest or veto entries, with staff review — is the next step, and wants the
 * news-aggregation design settled first (docs/news-aggregation-groundwork.md).
 */
export default async function SiteCommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const identity = await getOrgIdentity(slug);
  const user = await getCurrentUser();

  const h = await headers();
  const host = h.get("host") ?? networkHostWithPort();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const requestDomain = normalizeDomain(host);
  const arrivedOnOwnDomain =
    h.get("x-org-domain") !== null ||
    (identity?.primaryDomain != null && requestDomain === identity.primaryDomain) ||
    (requestDomain !== null && !isNetworkHost(requestDomain));
  const mainSiteUrl =
    identity?.primaryDomain && !arrivedOnOwnDomain
      ? `https://${identity.primaryDomain}`
      : null;

  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  const rootBase = `${proto}://${rootHost}`;

  const [memberOrgs, counts, events, feed, homes, artwork] = await Promise.all([
    getMemberRoster(24),
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
    loginUrl: `${rootBase}/login`,
    signupUrl: `${rootBase}/login?mode=signup`,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav orgName={org.name} current="community" mainSiteUrl={mainSiteUrl} />
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <p className="text-sm text-muted-foreground">
          The wider collective, seen from {org.name}.
        </p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <CommunityGame subtitle="A LITTLE ROMP" artwork={artwork} />
      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
