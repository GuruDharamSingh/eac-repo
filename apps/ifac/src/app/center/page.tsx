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
 * /center — the person's home on this site (Center redesign, 2026-10-18).
 *
 * Same page the other org sites render (`CenterPage` from cms-ui), reached
 * from the hub's Profile card. Signed in, any relation or none. What is
 * particular to IFAC: the auction journey is passed in (this site onboards
 * the auction's artists), and Stripe returns a seller here with
 * `?payouts=done`, which is when their account is re-read and stamped.
 */
export default async function CenterRoute({
  searchParams,
}: {
  searchParams?: Promise<{ payouts?: string; journey?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/center");
  const sp = (await searchParams) ?? {};
  // `selling` is the hub card's older name for the auction journey.
  const journeyTab =
    sp.journey === "selling" ? ("auction" as const) : (["auction", "org", "profile", "site"] as const).find((t) => t === sp.journey) ?? null;

  // Asking Stripe on return is what stamps the account payable; the webhook
  // says the same later, but nobody who just finished the form should wait.
  if (sp.payouts === "done") {
    const { refreshStripeAccountStatus } = await import("@elkdonis/checkout/stripe");
    await refreshStripeAccountStatus(viewer.userId).catch(() => null);
  }

  const { layout } = await resolveCenterLayout(siteConfig.orgId);
  const { loadAuctionJourney } = await import("@elkdonis/commerce/server");
  const [data, homes, journey] = await Promise.all([
    loadCenter({
      orgId: siteConfig.orgId,
      userId: viewer.userId,
      viewerRole: viewer.role,
      feedLimit: layout.options.feed?.limit,
      networkLimit: layout.options.network?.limit,
    }),
    listOrgHomes().catch(() => []),
    loadAuctionJourney(viewer.userId).catch(() => null),
  ]);

  const links = buildOrgSiteCenterLinks({
    data,
    homes,
    networkUrl: NETWORK_URL,
    artdirectUrl: ARTDIRECT_URL,
    marketplaceUrl: siteConfig.marketplaceUrl,
    // This site has no /account; the network's is the one place for it.
    accountHref: handoffUrl(`${NETWORK_URL}/account`),
    forumHref: "/forum",
    composeHref: viewer.isMember ? "/hub/compose" : null,
    // A link to another site carries the sign-in with it (the network's SSO hop).
    crossSite: (url) => (/^https?:\/\//i.test(url) ? handoffUrl(url) : url),
  });

  // No site header or footer (developer, 2026-10-18): the page is the whole
  // window, with "← Back to IFAC" in its own heading. `.hub` is the members'
  // area's paper ground and ink; the body is the site's dark chrome.
  return (
    <main className="hub eac-center-page">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <CenterPage
          data={data}
          links={links}
          layout={layout}
          journey={journey}
          journeyTab={journeyTab}
          back={{ href: viewer.isMember ? "/hub" : "/", label: siteConfig.shortName }}
          manageHref={viewer.canEdit ? "/manage" : null}
          signedIn
          timeZone="America/Toronto"
        />
      </div>
    </main>
  );
}
