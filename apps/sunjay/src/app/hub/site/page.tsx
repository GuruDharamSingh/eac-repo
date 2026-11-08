import { redirect } from "next/navigation";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { siteBuilderServer } from "@elkdonis/hub/server/site-builder";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { SiteBuilderDetailMount } from "@/components/hub/hub-card-host";

export const metadata = { title: "Site builder — Para Theater hub" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * The Site Builder hub card's detail page (pilot, docs/open/hub-cards-handoff/PLAN.md).
 * Gated HERE, not only in the layout: Next renders layout and page in parallel.
 */
export default async function SiteBuilderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getHubCardViewer();
  if (!viewer) redirect("/login?next=/hub/site");
  if (!(viewer.role === "owner" || viewer.role === "guide")) redirect("/hub");

  const sp = await searchParams;
  const query = { tab: one(sp.tab), row: one(sp.row) };
  const data = await siteBuilderServer.loadDetail(hubSite, viewer, query);
  return <SiteBuilderDetailMount data={data} tab={query.tab} row={query.row} />;
}
