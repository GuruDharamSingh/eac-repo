"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  getOrgFeed,
  getServiceOfferingById,
  listAllServiceOfferingsForOrg,
  listOrgFeeds,
  listPostContent,
  loadPostContent,
  savePostContent,
  serviceAnswersFromOffering,
  serviceInputFromAnswers,
  upsertServiceOffering,
  validateServiceInput,
  type PostInput,
  type PostRecord,
  type ServiceOffering,
} from "@elkdonis/services";
import type { SitePostContextView, SitePostInputView, SitePostRecordView } from "@elkdonis/studio-forms";
import type { ServiceContextView, ServiceRecordView } from "@elkdonis/studio-forms";
import { WRONG_ORG, siteOrg } from "@elkdonis/site-forms/server";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The shared forms' server side on hidden-enneagram (2026-11-14): the Offering (service) and the post, for
 * @elkdonis/site-forms (popup `compose:service` / `compose:article` in components/hub/HubSurfaces.tsx, page
 * host components/manage/site-form-page.tsx) and the /publish Studio's Offerings kind.
 *
 * Thin: who is asking, and this site's routes. The org is siteConfig.orgId; an `orgId` the client sends is
 * checked against it and otherwise ignored. A person who is not an owner or guide of this org gets nothing.
 * Posts save through services' site-post-content.ts (sanitised body); offerings through
 * serviceInputFromAnswers + upsertServiceOffering, the translation lib/cms/actions.ts used to call.
 */

const ORG = siteConfig.orgId;
const CURRENCIES = ["CAD", "USD", "EUR", "GBP"];

/** Services keep their marketplace route; posts live under their feed. */
function revalidateFor(section: string | null | undefined, slug: string | null | undefined, kind: "post" | "service") {
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/hub");
  if (section) {
    revalidatePath(`/${section}`);
    if (slug) revalidatePath(`/${section}/${slug}`);
  }
  if (kind === "service" || section === "services") {
    revalidatePath("/services");
    revalidatePath("/readings");
    if (slug) revalidatePath(`/services/${slug}`);
  }
}

// ── Service (Offering) ──────────────────────────────────────────────────────────────────────────────

const NO_SERVICE_CONTEXT: ServiceContextView = {
  canEdit: false,
  reason: "Sign in as an editor of this site.",
  feeds: [],
  currencies: CURRENCIES,
};

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function serviceRecord(o: ServiceOffering): ServiceRecordView {
  return {
    id: o.id,
    orgId: o.orgId,
    slug: o.slug,
    title: o.title,
    status: o.status,
    authorId: o.authorId,
    publishedAt: iso(o.publishedAt),
    updatedAt: iso(o.updatedAt) ?? new Date().toISOString(),
    // The offering's page is /services/<slug> on this site.
    href: o.status === "published" ? `/services/${o.slug}` : null,
  };
}

/** The shared thread fields plus serviceAnswersFromOffering: the form's answers for this offering. */
function serviceAnswers(o: ServiceOffering): Record<string, unknown> {
  return {
    kind: "service",
    title: o.title,
    excerpt: o.descriptionShort ?? "",
    body: o.body ?? "",
    cover_image_url: o.coverImageUrl ?? "",
    price: o.price ?? "",
    currency: o.currency || "CAD",
    format: o.format ?? "",
    visibility: o.visibility,
    feed_slug: o.section ?? "",
    ...serviceAnswersFromOffering(o),
  };
}

export async function siteServiceContextAction(orgId: string): Promise<ServiceContextView> {
  if (!siteOrg(ORG, orgId)) return { ...NO_SERVICE_CONTEXT, reason: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NO_SERVICE_CONTEXT;
  const feeds = await listOrgFeeds(ORG, { includePrivate: true });
  return { canEdit: true, reason: null, feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })), currencies: CURRENCIES };
}

export async function siteServiceLoadAction(id: string): Promise<{ record: ServiceRecordView; answers: Record<string, unknown> } | null> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return null;
  // getServiceOfferingById is scoped to the org and to kind = 'service'.
  const o = await getServiceOfferingById(ORG, id);
  return o ? { record: serviceRecord(o), answers: serviceAnswers(o) } : null;
}

export async function siteServiceListAction(orgId: string): Promise<Array<{ id: string; updatedAt: string; title: string; status: string }>> {
  if (!siteOrg(ORG, orgId)) return [];
  const viewer = await getViewer();
  if (!viewer?.canEdit) return [];
  const list = await listAllServiceOfferingsForOrg(ORG);
  return list.filter((o) => o.status !== "archived").map((o) => ({ id: o.id, updatedAt: iso(o.updatedAt) ?? "", title: o.title, status: o.status }));
}

export async function siteServiceSaveAction(
  orgId: string,
  answers: Record<string, unknown>,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<{ ok: true; value: { record: ServiceRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(ORG, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (!viewer.canEdit) return { ok: false, error: "Only an owner or guide of this site can publish an offering." };

  if (id) {
    const existing = await getServiceOfferingById(ORG, id);
    if (!existing) return { ok: false, error: "That offering no longer exists here." };
    if (opts?.autosave && existing.status !== "draft") {
      return { ok: false, error: "Not saved automatically: it is no longer a draft. Press Save to update it." };
    }
  }

  const input = serviceInputFromAnswers(answers, intent);
  if (input.title.length < 2) return { ok: false, error: "Give the offering a title." };
  const problem = validateServiceInput(input);
  if (problem) return { ok: false, error: problem };
  if (!CURRENCIES.includes(input.currency ?? "CAD")) return { ok: false, error: "Pick the price in CAD, USD, EUR or GBP." };

  // The page must exist here (a typo would file it on a page that never renders); none chosen: `services`.
  input.section = input.section || "services";
  if (!(await getOrgFeed(ORG, input.section).catch(() => null))) return { ok: false, error: "That page does not exist on this site." };

  try {
    // authorId = the signed-in person: the payee (resolveSettlement pays a service's thread author, migration 253).
    const saved = await upsertServiceOffering(ORG, viewer.userId, input, id ?? undefined);
    const o = await getServiceOfferingById(ORG, saved.id);
    if (!o) return { ok: false, error: "Saved, but the offering could not be read back." };
    revalidateFor(o.section, o.slug, "service");
    // Booking settings are saved after the offering; a refusal there comes back as a warning.
    return { ok: true, value: { record: serviceRecord(o), warnings: saved.bookingWarning ? [saved.bookingWarning] : [] } };
  } catch (err) {
    console.error("[hidden-enneagram] siteServiceSaveAction:", err);
    return { ok: false, error: "Could not save that offering. Try again." };
  }
}

// ── Post (savePostContent / loadPostContent, services site-post-content.ts) ─────────────────────────

const NO_POST_CONTEXT: SitePostContextView = {
  canEdit: false,
  reason: "Sign in as an editor of this site.",
  feeds: [],
  canShareToNetwork: false,
  canSetVisibility: true,
};

function postView(r: PostRecord): SitePostRecordView {
  return {
    id: r.id,
    orgId: r.orgId,
    slug: r.slug,
    status: r.status,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    href: r.section ? `/${r.section}/${r.slug}` : null,
    input: r.input as SitePostInputView,
  };
}

export async function sitePostContextAction(orgId: string): Promise<SitePostContextView> {
  if (!siteOrg(ORG, orgId)) return { ...NO_POST_CONTEXT, reason: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer?.canEdit) return NO_POST_CONTEXT;
  const feeds = await listOrgFeeds(ORG, { includePrivate: true });
  // `services` holds offerings (made in the Offering form), not posts.
  return {
    canEdit: true,
    feeds: feeds.filter((f) => f.slug !== "services").map((f) => ({ slug: f.slug, name: f.name })),
    canShareToNetwork: false,
    canSetVisibility: true,
  };
}

export async function sitePostLoadAction(id: string): Promise<SitePostRecordView | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const r = await loadPostContent(viewer.userId, ORG, id);
  return r ? postView(r) : null;
}

export async function sitePostSaveAction(
  orgId: string,
  input: SitePostInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<{ ok: true; value: { record: SitePostRecordView; warnings: string[] } } | { ok: false; error: string }> {
  if (!siteOrg(ORG, orgId)) return { ok: false, error: WRONG_ORG };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const r = await savePostContent(viewer.userId, ORG, input as PostInput, intent === "draft" ? "draft" : "published", id, {
    autosave: opts?.autosave === true,
  });
  if (r.ok === false) return { ok: false, error: r.error };
  const record = postView(r.value);
  revalidateFor(record.input.section, record.slug, "post");
  return { ok: true, value: { record, warnings: r.warnings ?? [] } };
}

export async function sitePostListAction(orgId: string): Promise<Array<{ id: string; title: string; status: string; updatedAt: string }>> {
  if (!siteOrg(ORG, orgId)) return [];
  const viewer = await getViewer();
  if (!viewer?.canEdit) return [];
  const rows = await listPostContent(viewer.userId, ORG);
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, updatedAt: r.updatedAt }));
}
