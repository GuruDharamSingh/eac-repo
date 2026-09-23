import {
  listPendingThreads,
  listReviewedThreads,
  orgRequiresReview,
  listPendingUserPages,
  orgHostsStorePanels,
} from "@elkdonis/services";
import { requireIfacManager } from "@/lib/manage-auth";
import { siteConfig } from "@/config/site";
import { SubmissionsPanel } from "@/components/manage/submissions-panel";

export const metadata = { title: "Submissions — IFAC" };
export const dynamic = "force-dynamic";

/**
 * What members have sent in, and whether anything waits at all.
 *
 * IFAC ships with the thread queue off (migration 156's default) and store
 * panels off (migration 157's default) — this page is usually empty on both
 * counts, which is the point: moderation here is a power to intervene, not a
 * gate everything passes through.
 */
export default async function ManageSubmissionsPage() {
  await requireIfacManager("/manage/submissions");
  const [pending, recent, review, pendingPanels, storePanels] = await Promise.all([
    listPendingThreads(siteConfig.orgId),
    listReviewedThreads(siteConfig.orgId, 10),
    orgRequiresReview(siteConfig.orgId),
    listPendingUserPages(siteConfig.orgId),
    orgHostsStorePanels(siteConfig.orgId),
  ]);

  return (
    <SubmissionsPanel
      initialPending={pending}
      recent={recent}
      review={review}
      initialPendingPanels={pendingPanels}
      storePanels={storePanels}
    />
  );
}
