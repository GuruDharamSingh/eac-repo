import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getOrgRole, listOrgHomes, loadCenter, resolveCenterLayout } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import {
  CenterPage,
  type CenterLinks,
  type CenterOrgLink,
  type CenterThread,
} from "@elkdonis/cms-ui/center";
import { handoffUrl } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";
import { isNetworkHost, networkHostWithPort, normalizeDomain } from "@/lib/domain";
import { getOrgHomeUrl, networkUrl } from "@/lib/org-url";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";

export const metadata: Metadata = { title: "Center" };
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const MARKETPLACE_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? null;

/**
 * /center on an org's subdomain (or custom domain served here) — the
 * follower's home. The middleware has already rewritten `acme.<network>/center`
 * to this route, so the org is the param. Same rows as the org's own app
 * would show at its /center; this is the copy for orgs without one.
 *
 * No SurfaceProvider is mounted in this app yet, so every face navigates
 * rather than opening in place; the page is built so that mounting one later
 * needs no change here. Brief: CENTER_PAGE_BRIEF_2026-09-09.md.
 */
/** A link to another site carries the sign-in with it (the network's SSO hop). */
const xs = (url: string) => (/^https?:\/\//i.test(url) ? handoffUrl(url) : url);

export default async function SiteCenterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/center");

  const h = await headers();
  const host = h.get("host") ?? networkHostWithPort();
  const requestDomain = normalizeDomain(host);
  const arrivedOnOwnDomain =
    h.get("x-org-domain") !== null || (requestDomain !== null && !isNetworkHost(requestDomain));

  const [role, homes] = await Promise.all([
    getOrgRole(user.id, org.id),
    listOrgHomes().catch(() => []),
  ]);
  // The org's definition over the network default (center-layout.ts).
  const { layout } = await resolveCenterLayout(org.id);
  const data = await loadCenter({
    orgId: org.id,
    userId: user.id,
    viewerRole: role,
    feedLimit: layout.options.feed?.limit,
    networkLimit: layout.options.network?.limit,
  });

  const homeBySlug = new Map<string, string>(
    homes.map((o) => [o.orgSlug, getOrgHomeUrl({ slug: o.orgSlug, primaryDomain: o.primaryDomain })] as const)
  );
  const thisHome = homeBySlug.get(slug) ?? getOrgHomeUrl({ slug });
  const mainSiteUrl = !arrivedOnOwnDomain && !thisHome.includes(networkHostWithPort()) ? thisHome : null;
  const personSlug = data.person?.slug ?? null;
  const network = networkUrl();

  const links: CenterLinks = {
    // This org's threads render at /<contentSlug> on its subdomain.
    threadHref: (t: CenterThread) => `/${t.slug}`,
    networkThreadHref: (t: CenterThread) =>
      xs(`${homeBySlug.get(t.orgSlug) ?? getOrgHomeUrl({ slug: t.orgSlug })}/${t.slug}`),
    orgHref: (o: CenterOrgLink) => {
      if (o.isCurrent) return null;
      const staff = o.role === "owner" || o.role === "guide" || o.role === "member";
      // Staff: the network hub keyed to that org. Followers: that org's center.
      return xs(
        staff
          ? `${network}/hub/organization?org=${encodeURIComponent(o.orgSlug)}`
          : `${homeBySlug.get(o.orgSlug) ?? getOrgHomeUrl({ slug: o.orgSlug })}/center`
      );
    },
    profileHref: personSlug && ARTDIRECT_URL ? xs(`${ARTDIRECT_URL}/${personSlug}`) : null,
    editProfileHref:
      personSlug && ARTDIRECT_URL ? xs(`${ARTDIRECT_URL}/${personSlug}`) : xs(`${network}/account`),
    accountHref: xs(`${network}/account`),
    notificationsHref: null,
    filesHref: xs(`${network}/hub/network`),
    forumHref: process.env.NEXT_PUBLIC_FORUM_URL ?? null,
    artistHref: (s: string) => xs(ARTDIRECT_URL ? `${ARTDIRECT_URL}/${s}` : `${network}/artists/${s}`),
    marketplaceUrl: MARKETPLACE_URL,
    followEndpoint: `/api/org/${encodeURIComponent(slug)}/follow`,
    loginHref: "/login?next=/center",
    // The org's real home: its own domain when it has one, else its subdomain root.
    homeUrl: thisHome,
    homePreviewUrl: thisHome,
    orgProfileHref: "/profile",
    composeHref: process.env.NEXT_PUBLIC_FORUM_URL ?? null,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeStyle orgId={org.id} pageKey="center" />
      <SiteNav orgName={org.name} current="center" mainSiteUrl={mainSiteUrl} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {org.name}
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          You, here: what&rsquo;s on at {org.name}, where else you are on the collective, and what
          the network is carrying.
        </p>
        <div className="mt-8">
          <CenterPage data={data} links={links} layout={layout} signedIn />
        </div>
      </main>
      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
