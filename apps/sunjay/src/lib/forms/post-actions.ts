"use server";

import { revalidatePath } from "next/cache";
import { listOrgFeeds, listPostContent, loadPostContent, savePostContent, type PostInput } from "@elkdonis/services";
import type { SitePostContextView, SitePostInputView, SitePostRecordView } from "@elkdonis/studio-forms";
import { WRONG_ORG, siteOrg } from "@elkdonis/site-forms/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The post form's server side on Para Theater (2026-11-14), for the shared popup and page
 * (@elkdonis/site-forms; `compose:article` in components/hub/HubSurfaces.tsx, /manage/content).
 * The rules are services' site-post-content.ts; the org is siteConfig.orgId.
 */

const NO_CONTEXT: SitePostContextView = { canEdit: false, reason: "Sign in as an editor of this site.", feeds: [] };

/** This site's page for a post: `/<feed>/<slug>`. */
function withHref(r: NonNullable<Awaited<ReturnType<typeof loadPostContent>>>): SitePostRecordView {
  const input = { ...r.input, audience: r.input.audience } as SitePostInputView;
  return { ...r, status: r.status, input, href: r.section ? `/${r.section}/${r.slug}` : null };
}

export async function sitePostContextAction(orgId: string): Promise<SitePostContextView> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ...NO_CONTEXT, reason: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return NO_CONTEXT;
  if (!viewer.canEdit) return { ...NO_CONTEXT, reason: "Only an owner or guide of this site can post here." };
  const feeds = await listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []);
  return { canEdit: true, reason: null, feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })), canShareToNetwork: true, canSetVisibility: true };
}

export async function sitePostLoadAction(id: string): Promise<SitePostRecordView | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const r = await loadPostContent(viewer.userId, siteConfig.orgId, id);
  return r ? withHref(r) : null;
}

export async function sitePostSaveAction(
  orgId: string,
  input: SitePostInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<{ ok: true; value: { record: SitePostRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(siteConfig.orgId, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const r = await savePostContent(viewer.userId, siteConfig.orgId, input as PostInput, intent === "draft" ? "draft" : "published", id, {
    autosave: opts?.autosave === true,
  });
  if (r.ok === false) return { ok: false, error: r.error };
  const record = withHref(r.value);
  revalidatePath("/");
  revalidatePath("/hub");
  revalidatePath("/manage");
  if (record.input.section) {
    revalidatePath(`/${record.input.section}`);
    revalidatePath(`/${record.input.section}/${record.slug}`);
  }
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

export async function sitePostListAction(orgId: string): Promise<Array<{ id: string; title: string; status: string; updatedAt: string }>> {
  if (!siteOrg(siteConfig.orgId, orgId)) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  const rows = await listPostContent(viewer.userId, siteConfig.orgId);
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt }));
}
