import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { AnalyticsDashboard } from "@elkdonis/analytics/dashboard";
import { chooseScope, getAnalyticsAccess, getDashboardData } from "@elkdonis/analytics/server";
import { parseRangeKey } from "@elkdonis/analytics";
import "@elkdonis/analytics/dashboard.css";

/**
 * Visitor analytics. Network admins see the whole network or any org; an org
 * owner sees the orgs they own (packages/analytics/src/access.ts). Outside
 * hub/(tabs) like /hub/admin: it is not a member-facing tab.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Visitors", robots: { index: false, follow: false } };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; org?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const access = await getAnalyticsAccess(user.id);
  const scope = chooseScope(access, sp.org);
  if (!scope) notFound();

  const data = await getDashboardData({ scope, range: parseRangeKey(sp.range), includePeople: true });
  const orgName = "orgId" in scope ? access.orgs.find((o) => o.id === scope.orgId)?.name : null;

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <AnalyticsDashboard
          data={data}
          title={orgName ? `Visitors · ${orgName}` : "Visitors · whole network"}
          basePath="/hub/analytics"
          orgs={access.orgs.length > 1 || access.network ? access.orgs : undefined}
          selectedOrg={"orgId" in scope ? scope.orgId : null}
        />
      </div>
    </SiteShell>
  );
}
