"use server";

import {
  PERSONAL_ORG_ID,
  canModerateOrg,
  getOrgFeed,
  getServiceOfferingById,
  listAllServiceOfferingsForOrg,
  listOrgFeeds,
  serviceAnswersFromOffering,
  serviceInputFromAnswers,
  upsertServiceOffering,
  validateServiceInput,
  type ServiceOffering,
} from "@elkdonis/services";
import type { StudioResult } from "@elkdonis/studio";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";
import { networkItemUrl } from "@/lib/org-url";

/**
 * The publication forms' Service ("Offering"), on arts-collective (pass 2,
 * 2026-11-08). The answers are cms-ui content-fields' `service` keys,
 * converted here, server side, by services' serviceInputFromAnswers and saved
 * by upsertServiceOffering (thread + workshop_pages sidecar, one transaction),
 * as hidden-enneagram's saveContentAction does.
 *
 * Who may: an owner or guide of the org (canModerateOrg; not the personal org,
 * whose services are ArtDirect's artist-offerings). Payee rule: the AUTHOR is
 * the signed-in person on create (resolveSettlement pays a service's author;
 * hidden-enneagram migration 253), never an org service account. An update
 * leaves the author as it is. Bound to studio/forms adapters/service.ts
 * ServiceActions. Not imported anywhere until the PM's go.
 */

const CURRENCIES = ["CAD", "USD", "EUR", "GBP"];

/** Structurally ServiceRecordView. */
interface ServiceFormRecord {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  status: ServiceOffering["status"];
  authorId: string | null;
  publishedAt: string | null;
  updatedAt: string;
  href: string | null;
}

interface ServiceFormContext {
  canEdit: boolean;
  reason: string | null;
  feeds: Array<{ slug: string; name: string }>;
  currencies: string[];
}

async function viewerId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

async function gate(viewer: string, orgId: string): Promise<string | null> {
  if (orgId === PERSONAL_ORG_ID) return "An offering here belongs to an organisation. Choose the organisation under “Making as”.";
  const ok = await canModerateOrg(viewer, orgId).catch(() => false);
  return ok ? null : "Only an owner or guide of this organisation can publish an offering.";
}

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function toRecord(o: ServiceOffering): Promise<ServiceFormRecord> {
  let href: string | null = null;
  if (o.status === "published") {
    const [org] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE id = ${o.orgId}`.catch(
      () => [] as Array<{ slug: string }>
    );
    // The network subdomain: `<custom domain>/<slug>` 404s where an org's own app serves its domain.
    href = org?.slug ? networkItemUrl(org.slug, o.slug) : null;
  }
  return {
    id: o.id,
    orgId: o.orgId,
    slug: o.slug,
    title: o.title,
    status: o.status,
    authorId: o.authorId,
    publishedAt: iso(o.publishedAt),
    updatedAt: iso(o.updatedAt) ?? new Date().toISOString(),
    href,
  };
}

/** The shared thread fields plus serviceAnswersFromOffering: the compose answers for this offering. */
function answersOf(o: ServiceOffering): Record<string, unknown> {
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

export async function serviceFormContextAction(orgId: string): Promise<ServiceFormContext> {
  const viewer = await viewerId();
  if (!viewer) return { canEdit: false, reason: "Sign in first.", feeds: [], currencies: CURRENCIES };
  const refused = await gate(viewer, orgId);
  if (refused) return { canEdit: false, reason: refused, feeds: [], currencies: CURRENCIES };
  const feeds = await listOrgFeeds(orgId, { includePrivate: true }).catch(() => []);
  return { canEdit: true, reason: null, feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })), currencies: CURRENCIES };
}

export async function loadServiceFormAction(
  id: string
): Promise<{ record: ServiceFormRecord; answers: Record<string, unknown> } | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const [row] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${id} AND kind = 'service'`.catch(
    () => [] as Array<{ org_id: string }>
  );
  if (!row || (await gate(viewer, row.org_id))) return null;
  const o = await getServiceOfferingById(row.org_id, id);
  return o ? { record: await toRecord(o), answers: answersOf(o) } : null;
}

export async function listServiceFormAction(orgId: string): Promise<Array<{ id: string; updatedAt: string }>> {
  const viewer = await viewerId();
  if (!viewer || (await gate(viewer, orgId))) return [];
  const list = await listAllServiceOfferingsForOrg(orgId);
  return list.map((o) => ({ id: o.id, updatedAt: iso(o.updatedAt) ?? "" }));
}

export async function saveServiceFormAction(
  orgId: string,
  answers: Record<string, unknown>,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
): Promise<StudioResult<{ record: ServiceFormRecord; warnings: string[] }>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const refused = await gate(viewer, orgId);
  if (refused) return { ok: false, error: refused };

  if (id) {
    // getServiceOfferingById checks kind = 'service': upsertServiceOffering's update does not.
    const existing = await getServiceOfferingById(orgId, id);
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

  // The feed must exist (a typo would file it on a page that never renders). None chosen:
  // 'services' when the org has that feed, else no feed.
  if (input.section) {
    const feed = await getOrgFeed(orgId, input.section).catch(() => null);
    if (!feed) return { ok: false, error: "That page does not exist on this site." };
  } else {
    const services = await getOrgFeed(orgId, "services").catch(() => null);
    input.section = services ? "services" : null;
  }

  try {
    // authorId = the signed-in person: the payee (resolveSettlement).
    const saved = await upsertServiceOffering(orgId, viewer, input, id ?? undefined);
    const o = await getServiceOfferingById(orgId, saved.id);
    if (!o) return { ok: false, error: "Saved, but the offering could not be read back." };
    return { ok: true, value: { record: await toRecord(o), warnings: [] } };
  } catch (err) {
    console.error("[studio] saveServiceFormAction:", err);
    return { ok: false, error: "Could not save that offering. Try again." };
  }
}
