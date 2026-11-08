"use server";

import { db } from "@elkdonis/db";
import { getServiceOfferingById } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { saveContentAction } from "@/lib/cms/actions";
import { siteConfig } from "@/config/site";
import type { ServiceDraft, ServiceSummary } from "@/components/publish/service-types";

// ============================================================================
// The Studio's Services kind on Ario's site (round 4). An app-side extension:
// packages/studio lists `service` as not ready, so this site supplies it.
//
// The write is the site's own: saveContentAction (lib/cms/actions.ts), the
// same zod schema and upsertServiceOffering call /manage/content/new uses. So
// a service made in the Studio is exactly the one /manage would make: author
// = the signed-in editor (the payee rule, migration 253), feed `services`,
// the workshop_pages sidecar, revalidation of /readings and /services/<slug>.
// ============================================================================

const ORG = siteConfig.orgId;

export async function listPublishServices(): Promise<ServiceSummary[]> {
  if (!(await getApiEditor())) return [];
  const rows = await db<Array<{ id: string; title: string; slug: string; status: string; cover: string | null; updated_at: Date }>>`
    SELECT t.id, t.title, t.slug, t.status, COALESCE(t.metadata->>'coverImageUrl', wp.cover_image_url) AS cover, t.updated_at
    FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.org_id = ${ORG} AND t.kind = 'service' AND t.status <> 'archived'
    ORDER BY t.updated_at DESC
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status === "published" ? "published" : "draft",
    coverImageUrl: r.cover,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function loadPublishService(id: string): Promise<ServiceDraft | null> {
  if (!(await getApiEditor())) return null;
  const s = await getServiceOfferingById(ORG, id);
  if (!s) return null;
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    subtitle: s.subtitle ?? "",
    summary: s.descriptionShort ?? "",
    body: s.body ?? "",
    coverImageUrl: s.coverImageUrl ?? "",
    bookingType: s.bookingType ?? "one_on_one",
    format: s.format ?? "online",
    price: s.price != null ? String(s.price) : "",
    currency: s.currency || "CAD",
    slidingScale: s.priceSlidingMin != null,
    priceSlidingMin: s.priceSlidingMin != null ? String(s.priceSlidingMin) : "",
    slidingScaleNote: s.slidingScaleNote ?? "",
    durationMinutes: s.sessionDurationHrs != null ? String(Math.round(s.sessionDurationHrs * 60)) : "",
    sessionCount: s.sessionCount != null ? String(s.sessionCount) : "",
    location: s.location ?? "",
    registrationStatus: s.registrationStatus ?? "open",
    visibility: s.visibility === "ORGANIZATION" ? "ORGANIZATION" : "PUBLIC",
    status: s.status === "published" ? "published" : "draft",
    feedSlug: s.section || "services",
  };
}

export async function savePublishService(
  draft: ServiceDraft,
  status: "draft" | "published"
): Promise<{ ok: true; id: string; path: string | null } | { ok: false; error: string }> {
  // saveContentAction gates too (and redirects); this keeps the answer an error for the Studio.
  if (!(await getApiEditor())) return { ok: false, error: "Sign in as an editor of this site." };
  const minutes = draft.durationMinutes.trim() ? Number(draft.durationMinutes) : null;
  const result = await saveContentAction(
    {
      kind: "service",
      feedSlug: draft.feedSlug || "services",
      title: draft.title,
      excerpt: draft.summary,
      body: draft.body,
      coverImageUrl: draft.coverImageUrl,
      status,
      visibility: draft.visibility,
      subtitle: draft.subtitle,
      bookingType: draft.bookingType,
      format: draft.format,
      price: draft.price,
      currency: draft.currency || "CAD",
      slidingScale: draft.slidingScale,
      priceSlidingMin: draft.slidingScale ? draft.priceSlidingMin : "",
      slidingScaleNote: draft.slidingScale ? draft.slidingScaleNote : "",
      sessionCount: draft.sessionCount,
      sessionDurationHrs: minutes != null && Number.isFinite(minutes) ? minutes / 60 : "",
      location: draft.location,
      registrationStatus: draft.registrationStatus,
    } as Parameters<typeof saveContentAction>[0],
    draft.id ?? undefined
  );
  if (!result.ok || !result.id) return { ok: false, error: result.error ?? "Could not save it." };
  return { ok: true, id: result.id, path: result.path ?? null };
}
