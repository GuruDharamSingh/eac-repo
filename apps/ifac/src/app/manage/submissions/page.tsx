import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { loadReviewQueue } from "@elkdonis/hub/server/review";
import { requireIfacManager } from "@/lib/manage-auth";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { ReviewDetailMount } from "@/components/hub/hub-card-host";

export const metadata = { title: "Submissions — IFAC" };
export const dynamic = "force-dynamic";

/**
 * What members have sent in, posts from other network sites asking to show
 * here, and whether anything waits at all: the shared review queue
 * (@elkdonis/hub review, 2026-11-08), which replaced this tab's own panel. The
 * same queue is at /hub/review; this tab redirects there once the old tabs are
 * retired (PLAN §4).
 *
 * TODO: the old panel's "recently decided" list (listReviewedThreads) is not in
 * the shared queue yet.
 */
export default async function ManageSubmissionsPage() {
  await requireIfacManager("/manage/submissions");
  const viewer = await getHubCardViewer();
  if (!viewer) return null;
  const data = await loadReviewQueue(hubSite, viewer, { storePanels: true });
  return <ReviewDetailMount data={data} backHref="/manage" />;
}
