import { redirect } from "next/navigation";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { loadReviewQueue } from "@elkdonis/hub/server/review";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { ReviewDetailMount } from "@/components/hub/hub-card-host";

export const metadata = { title: "Review queue — IFAC hub" };
export const dynamic = "force-dynamic";

/**
 * Everything waiting for a look: posts from other network sites asking to show
 * here, members' posts held for review, store panels. Gated in the page.
 */
export default async function ReviewPage() {
  const viewer = await getHubCardViewer();
  if (!viewer) redirect("/login?next=/hub/review");
  if (!(viewer.role === "owner" || viewer.role === "guide" || viewer.isNetworkAdmin)) redirect("/hub");
  const data = await loadReviewQueue(hubSite, viewer, { storePanels: true });
  return <ReviewDetailMount data={data} />;
}
