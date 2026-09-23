import { notFound, redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { EMPTY_PAGE } from "@elkdonis/page-builder";
import { loadUserPage, listUserPages } from "@elkdonis/page-builder/server";
import { getOrgHomeBySlug, orgHostsStorePanels } from "@elkdonis/services";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { PanelEditor } from "@/components/panel/panel-editor";

// ============================================================================
// Design how your work appears on ONE org's page — a store panel.
//
// Deliberately OUTSIDE /studio: that route requires an active, approved
// marketplace store (StudioLayout's requireStudioStore), and most of what
// this editor offers — pictures, headings, a gallery — needs no store at
// all. The one block that does (profile-store) simply renders nothing for
// someone without one; nothing else here should be gated on having one.
//
// `?page=` selects which of the person's panels for this org is open —
// store:1, store:2, … — a plain query param, not a route segment: Puck's own
// header/canvas fill the whole viewport, so there is no page chrome for a
// segment-based URL to sit in anyway, and switching pages is meant to feel
// like flipping a tab, not a navigation.
// ============================================================================

export const dynamic = "force-dynamic";

function keyFor(page: number): string {
  return `store:${Math.max(1, Math.min(999, Math.trunc(page) || 1))}`;
}

export default async function StorePanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=/panel/${(await params).orgSlug}`);

  const { orgSlug } = await params;
  const org = await getOrgHomeBySlug(orgSlug);
  if (!org) notFound();

  const { page } = await searchParams;
  const pageNum = page ? Number(page) : 1;
  const key = keyFor(pageNum);

  const [existing, pages, hosts] = await Promise.all([
    loadUserPage(userId, org.orgId, key),
    listUserPages(userId, org.orgId),
    orgHostsStorePanels(org.orgId),
  ]);

  return (
    <PanelEditor
      orgId={org.orgId}
      orgName={org.orgName}
      orgHostsPanels={hosts}
      pageKey={key}
      pageNum={pageNum}
      initial={(existing?.data as Data) ?? (EMPTY_PAGE as Data)}
      status={existing?.status ?? "draft"}
      pages={pages}
    />
  );
}
