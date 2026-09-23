import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listOrgHomes, loadCenter, resolveCenterLayout } from "@elkdonis/services";
import {
  CenterPage,
  type CenterLinks,
  type CenterOrgLink,
  type CenterThread,
} from "@elkdonis/cms-ui/center";
import { handoffUrl } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Center" };
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013").replace(/\/$/, "");
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_PROTO = NETWORK_HOST.includes("localhost") ? "http" : "https";

/** An org's home: its own domain when it has one, else its network subdomain. */
function orgHome(slug: string, primaryDomain: string | null): string {
  return primaryDomain ? `https://${primaryDomain}` : `${NETWORK_PROTO}://${slug}.${NETWORK_HOST}`;
}

/**
 * /center — the follower's home on this site.
 *
 * Signed in, any relation or none: a person with no row for this org sees
 * the Follow state rather than being bounced. Members reach it too; their
 * header says Hub, but the rail on every center links back here.
 * Brief: CENTER_PAGE_BRIEF_2026-09-09.md.
 */
/** A link to another site carries the sign-in with it (the network's SSO hop). */
const xs = (url: string) => (/^https?:\/\//i.test(url) ? handoffUrl(url) : url);

export default async function CenterRoute() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/center");

  // The org's definition over the network default (center-layout.ts).
  const { layout } = await resolveCenterLayout(siteConfig.orgId);
  const [data, homes] = await Promise.all([
    loadCenter({
      orgId: siteConfig.orgId,
      userId: viewer.userId,
      viewerRole: viewer.role,
      feedLimit: layout.options.feed?.limit,
      networkLimit: layout.options.network?.limit,
    }),
    listOrgHomes().catch(() => []),
  ]);
  const homeBySlug = new Map<string, string>(
    homes.map((h) => [h.orgSlug, orgHome(h.orgSlug, h.primaryDomain)] as const)
  );
  const slug = data.person?.slug ?? null;

  const links: CenterLinks = {
    threadHref: (t: CenterThread) => `/${t.section ?? "feed"}/${t.slug}`,
    networkThreadHref: (t: CenterThread) =>
      xs(`${homeBySlug.get(t.orgSlug) ?? orgHome(t.orgSlug, null)}/${t.slug}`),
    orgHref: (o: CenterOrgLink) => {
      if (o.isCurrent) return null;
      const home = homeBySlug.get(o.orgSlug) ?? orgHome(o.orgSlug, null);
      const staff = o.role === "owner" || o.role === "guide" || o.role === "member";
      // Staff go to that org's hub; a follower to its center. Orgs on their
      // own domain answer both routes; the rest answer on their subdomain.
      return xs(staff ? `${home}/hub` : `${home}/center`);
    },
    profileHref: slug ? xs(`${ARTDIRECT_URL}/${slug}`) : null,
    editProfileHref: slug ? xs(`${ARTDIRECT_URL}/${slug}`) : "/account",
    accountHref: "/account",
    notificationsHref: null,
    filesHref: null,
    forumHref: "/forum",
    artistHref: (s: string) => xs(`${ARTDIRECT_URL}/${s}`),
    marketplaceUrl: siteConfig.marketplaceUrl,
    followEndpoint: "/api/center/follow",
    loginHref: "/login?next=/center",
    homeUrl: "/",
    homePreviewUrl: "/",
    orgProfileHref: "/about",
    composeHref: "/forum",
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
        {siteConfig.orgName}
      </p>
      <h1 className="mt-1 font-serif text-3xl">Center</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        You, here: what&rsquo;s on at {siteConfig.orgName}, where else you are on the collective,
        and what the network is carrying.
      </p>
      <div className="mt-8">
        <CenterPage data={data} links={links} layout={layout} signedIn timeZone="America/Toronto" />
      </div>
    </div>
  );
}
