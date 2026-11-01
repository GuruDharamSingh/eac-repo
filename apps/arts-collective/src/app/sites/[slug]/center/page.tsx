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
import { orgDoorUrl } from "@elkdonis/cms-ui/center";
import { networkUrl } from "@/lib/org-url";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import { SiteCenterHost } from "./SiteCenterHost";

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
 * SiteCenterHost mounts the SurfaceProvider (profile popup, Where you show,
 * Post to…, this org's threads), so faces open in place; without script they
 * still navigate to the hrefs below. Brief: CENTER_PAGE_BRIEF_2026-09-09.md.
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

  const network = networkUrl();
  const homeBySlug = new Map(homes.map((o) => [o.orgSlug, o] as const));
  // Where another org can be reached: its verified domain, else its page on
  // the network hub. The `<slug>.<network>` form is not emitted — no column
  // says whether a subdomain's certificate is live (`subdomain_confirmed` is
  // the intake gate) and the sprint log records them failing TLS.
  const door = (orgSlug: string) => orgDoorUrl(homeBySlug.get(orgSlug), orgSlug, network);
  const ownDomain = homeBySlug.get(slug)?.primaryDomain ?? null;
  const thisHome = ownDomain ? `https://${ownDomain}` : null;
  const mainSiteUrl = !arrivedOnOwnDomain && thisHome ? thisHome : null;
  const personSlug = data.person?.slug ?? null;

  const links: CenterLinks = {
    // This org's threads render at /<contentSlug> on its subdomain.
    threadHref: (t: CenterThread) => `/${t.slug}`,
    networkThreadHref: (t: CenterThread) => {
      const d = homeBySlug.get(t.orgSlug)?.primaryDomain;
      return xs(d ? `https://${d}/${t.slug}` : door(t.orgSlug));
    },
    orgHref: (o: CenterOrgLink) => {
      if (o.isCurrent) return null;
      const staff = o.role === "owner" || o.role === "guide" || o.role === "member";
      const d = homeBySlug.get(o.orgSlug)?.primaryDomain;
      // Staff: the network hub keyed to that org. Followers: that org's center
      // on its own domain, or the same hub page when it has none.
      return xs(staff || !d ? door(o.orgSlug) : `https://${d}/center`);
    },
    profileHref: personSlug && ARTDIRECT_URL ? xs(`${ARTDIRECT_URL}/${personSlug}`) : null,
    editProfileHref:
      personSlug && ARTDIRECT_URL ? xs(`${ARTDIRECT_URL}/${personSlug}`) : xs(`${network}/account`),
    accountHref: xs(`${network}/account`),
    notificationsHref: null,
    // The person's files live on the network tab of the hub (FilesCard).
    filesHref: xs(`${network}/hub/network#files`),
    forumHref: process.env.NEXT_PUBLIC_FORUM_URL ?? null,
    artistHref: (s: string) => xs(ARTDIRECT_URL ? `${ARTDIRECT_URL}/${s}` : `${network}/artists/${s}`),
    marketplaceUrl: MARKETPLACE_URL,
    followEndpoint: `/api/org/${encodeURIComponent(slug)}/follow`,
    loginHref: "/login?next=/center",
    // The org's home: its own domain when it has one, else this site's root
    // (we are on the org's subdomain or custom domain already).
    homeUrl: thisHome ?? "/",
    homePreviewUrl: thisHome ?? "/",
    orgProfileHref: "/profile",
    composeHref: process.env.NEXT_PUBLIC_FORUM_URL ?? null,
    // Shown until the person is an artist of the collective (oad member).
    gainSpaceHref: data.orgs.some((o) => o.orgId === "oad" && o.role !== "viewer")
      ? null
      : xs(`${network}/wizard`),
    // The Studio, keyed to this org so "Writing as" starts here.
    studioHref: xs(`${network}/studio?org=${encodeURIComponent(org.id)}`),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeStyle orgId={org.id} pageKey="center" />
      <SiteNav orgName={org.name} current="center" mainSiteUrl={mainSiteUrl} signedIn />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <SiteCenterHost
          orgSlug={slug}
          orgName={org.name}
          displayName={data.person?.displayName ?? null}
          canCompose={role === "owner" || role === "guide" || role === "member"}
        >
          <CenterPage data={data} links={links} layout={layout} signedIn />
        </SiteCenterHost>
      </main>
      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
