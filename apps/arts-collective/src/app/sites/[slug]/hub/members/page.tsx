import { notFound, redirect } from "next/navigation";
import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/hub/industry.css";
import { membersServer } from "@elkdonis/hub/server/members";
import { TenantMembersDetail } from "@/components/sites/hub/TenantHubCards";
import { canManageHub, loadTenantHub, requireTenantHost } from "@/lib/tenant-hub";

export const metadata = { title: "Members · Hub" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * The Members card's detail page on a tenant host (`/hub/members`). Gated
 * HERE, not only in a layout: Next renders layout and page in parallel, so a
 * layout-only gate would still run this loader (the /manage leak, Kit §1).
 * Same gate as ifac's mount: owners, guides, network admins.
 */
export default async function TenantMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  await requireTenantHost(slug, "/hub/members");
  const hub = await loadTenantHub(slug);
  if (!hub) notFound();
  const { site, viewer, networkUrl } = hub;
  if (!viewer) redirect("/login?next=/hub/members");
  if (!canManageHub(viewer)) redirect("/hub");

  const sp = await searchParams;
  const query = { tab: one(sp.tab), row: one(sp.row), range: one(sp.range) };
  const data = await membersServer.loadDetail(site, viewer, query);
  return (
    <TenantMembersDetail
      data={data}
      tab={query.tab}
      links={{ networkUrl, orgId: site.orgId, orgSlug: hub.slug }}
    />
  );
}
