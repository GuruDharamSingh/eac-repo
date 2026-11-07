import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listOrgHomes, loadCenter, resolveCenterLayout } from "@elkdonis/services";
import { CenterPage, buildOrgSiteCenterLinks } from "@elkdonis/cms-ui/center";
import { handoffUrl } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

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
 * (`buildOrgSiteCenterLinks`); only what this host knows is passed in.
 * Brief: CENTER_PAGE_BRIEF_2026-09-09.md. Reached from the hub's
 * "Profile / Center" card, as on IFAC (apps/ifac/src/app/center/page.tsx):
 * a way back to the hub, Manage for editors, and Stripe's `?payouts=done`
 * return re-reads the account.
 */
export default async function CenterRoute({ searchParams }: { searchParams?: Promise<{ payouts?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/center");
  const sp = (await searchParams) ?? {};

  // Asking Stripe on return is what stamps the account payable; the webhook says the same later.
  if (sp.payouts === "done") {
    const { refreshStripeAccountStatus } = await import("@elkdonis/checkout/stripe");
    await refreshStripeAccountStatus(viewer.userId).catch(() => null);
  }

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
    forumHref: "/forum",
    composeHref: viewer.canEdit ? "/manage/compose" : "/forum",
    // A link to another site carries the sign-in with it (the network's SSO hop).
    crossSite: (url) => (/^https?:\/\//i.test(url) ? handoffUrl(url) : url),
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <CenterPage
        data={data}
        links={links}
        layout={layout}
        back={{ href: viewer.isMember ? "/hub" : "/", label: siteConfig.orgName }}
        manageHref={viewer.canEdit ? "/manage" : null}
        signedIn
        timeZone={siteConfig.timeZone}
      />
    </div>
  );
}
