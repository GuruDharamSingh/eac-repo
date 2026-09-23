import { requireOrgEditor } from "@/lib/auth";
import { HubView } from "@/components/hud/hub-view";

// ============================================================================
// /hub — the site's control room, for whoever can edit it.
//
// The same panels the editor has in its left rail (Galleries, Pages, Media),
// full width, plus the site's other desks. Nothing here is a second copy:
// a change made on /hub and a change made in the editor are the same change,
// to the same records.
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata = { title: "Hub" };

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; gallery?: string }>;
}) {
  await requireOrgEditor("/hub");
  const { tab, gallery } = await searchParams;
  return <HubView tab={tab} gallery={gallery} />;
}
