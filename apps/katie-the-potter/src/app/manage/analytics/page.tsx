import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AnalyticsDashboard } from "@elkdonis/analytics/dashboard";
import { getDashboardData } from "@elkdonis/analytics/server";
import { parseRangeKey } from "@elkdonis/analytics";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import "@elkdonis/analytics/dashboard.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Visitors" };

/**
 * Visitor analytics for this site, from sunjay. Owner only: the numbers
 * include which signed-in members visited, which a guide does not see. The
 * beacon in the root layout posts to /api/pulse, which is pinned to this org.
 */
export default async function ManageAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const viewer = await requireOrgEditor("/manage/analytics");
  if (viewer.role !== "owner") notFound();
  const sp = await searchParams;

  const data = await getDashboardData({
    scope: { orgId: siteConfig.orgId },
    range: parseRangeKey(sp.range),
    includePeople: true,
  });

  return <AnalyticsDashboard data={data} title={`Visitors · ${siteConfig.orgName}`} basePath="/manage/analytics" />;
}
