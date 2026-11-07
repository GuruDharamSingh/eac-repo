import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { AnalyticsDashboard } from "@elkdonis/analytics/dashboard";
import { getDashboardData } from "@elkdonis/analytics/server";
import { parseRangeKey } from "@elkdonis/analytics";
import "@elkdonis/analytics/dashboard.css";

/**
 * Visitor analytics for this site. Owner only: the numbers include which
 * signed-in members visited, which guides do not see.
 */
export const dynamic = "force-dynamic";

export default async function ManageAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireIfacManager();
  const viewer = await getViewer();
  if (viewer?.role !== "owner") return <p style={{ padding: "1rem 0" }}>Visitor figures are visible to the site owner only.</p>;
  const sp = await searchParams;

  const data = await getDashboardData({
    scope: { orgId: siteConfig.orgId },
    range: parseRangeKey(sp.range),
    includePeople: true,
  });

  return <AnalyticsDashboard data={data} title={`Visitors · ${siteConfig.orgName}`} basePath="/manage/analytics" />;
}

import { requireIfacManager } from "@/lib/manage-auth";