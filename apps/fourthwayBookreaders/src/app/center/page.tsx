import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listOrgHomes, loadCenter, resolveCenterLayout } from "@elkdonis/services";
import { CenterPage, buildOrgSiteCenterLinks } from "@elkdonis/cms-ui/center";
import { handoffUrl } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
// CenterPage renders plain anchors and fetches followEndpoint itself, so every
// same-site path handed to it has to carry the basePath — including the
// handoff route, which handoffUrl() returns without it.
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "Center" };
export const dynamic = "force-dynamic";

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013").replace(/\/$/, "");
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

/**
 * /center — the follower's home on this site.
 *
 * Signed in, any relation or none: a person with no row for this org sees
 * the Follow state rather than being bounced. Members reach it too; their
 * header says Hub, but the rail on every center links back here.
 * The links are the single-org set from @elkdonis/cms-ui/center
 * (`buildOrgSiteCenterLinks`) with every same-site path under the basePath.
 * Brief: CENTER_PAGE_BRIEF_2026-09-09.md.
 */
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

  const links = buildOrgSiteCenterLinks({
    data,
    homes,
    networkUrl: NETWORK_URL,
    artdirectUrl: ARTDIRECT_URL,
    marketplaceUrl: siteConfig.marketplaceUrl,
    forumHref: null,
    composeHref: null,
    // A link to another site carries the sign-in with it (the network's SSO hop).
    crossSite: (url) => (/^https?:\/\//i.test(url) ? withBase(handoffUrl(url)) : url),
    path: withBase,
  });

  return (
    <div className="column band">
      <CenterPage data={data} links={links} layout={layout} signedIn timeZone={siteConfig.timeZone} />
    </div>
  );
}
