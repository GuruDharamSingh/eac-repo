import { notFound, redirect } from "next/navigation";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { loadReviewQueue } from "@elkdonis/hub/server/review";
import { TenantReviewDetail } from "@/components/sites/hub/TenantHubCards";
import { canManageHub, loadTenantHub, requireTenantHost } from "@/lib/tenant-hub";

export const metadata = { title: "Review queue · Hub" };
export const dynamic = "force-dynamic";

/**
 * Everything waiting for a look in this org (`/hub/review` on its own host):
 * listings from other network sites and members' posts held for review.
 * Store panels are an ifac feature and stay off here. Gated in the page.
 */
export default async function TenantReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireTenantHost(slug, "/hub/review");
  const hub = await loadTenantHub(slug);
  if (!hub) notFound();
  const { site, viewer, networkUrl } = hub;
  if (!viewer) redirect("/login?next=/hub/review");
  if (!canManageHub(viewer)) redirect("/hub");
  const data = await loadReviewQueue(site, viewer);
  return <TenantReviewDetail data={data} links={{ networkUrl, orgId: site.orgId, orgSlug: hub.slug }} />;
}
