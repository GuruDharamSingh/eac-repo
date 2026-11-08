import { redirect } from "next/navigation";
import { NextcloudAccessPanel } from "@elkdonis/cms-ui/nextcloud-access";
import "@elkdonis/cms-ui/nextcloud-access.css";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { membersServer, membersStorageOn } from "@elkdonis/hub/server/members";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { MembersDetailMount } from "@/components/hub/hub-card-host";

export const metadata = { title: "Members — IFAC hub" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * The Members hub card's detail page (pilot, docs/open/hub-cards-handoff/PLAN.md).
 * Gated HERE, not only in the layout: Next renders layout and page in parallel,
 * so a layout-only gate would still run this loader (the /manage leak, Kit §1).
 */
export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getHubCardViewer();
  if (!viewer) redirect("/login?next=/hub/members");
  if (!(viewer.role === "owner" || viewer.role === "guide" || viewer.isNetworkAdmin)) redirect("/hub");

  const sp = await searchParams;
  const query = { tab: one(sp.tab), row: one(sp.row), range: one(sp.range) };
  const [data, storageOn] = await Promise.all([
    membersServer.loadDetail(hubSite, viewer, query),
    membersStorageOn(hubSite, viewer),
  ]);
  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL ?? "https://cloud.elkdonis-arts.org";
  const storagePanel = storageOn ? (
    <NextcloudAccessPanel endpoint="/api/manage/nextcloud-access" nextcloudUrl={nextcloudUrl} />
  ) : null;

  return <MembersDetailMount data={data} tab={query.tab} storagePanel={storagePanel} />;
}
