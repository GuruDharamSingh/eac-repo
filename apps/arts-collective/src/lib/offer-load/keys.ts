import { TEMPLATES, type TemplateId } from "@elkdonis/cms-ui/offer-templates/types";
import type { OfferKind } from "@elkdonis/cms-ui/offer-surface";

/**
 * Storage keys and allow-lists for the free-tier offer page. No server code here, so
 * both the loader and the save actions (a "use server" file may export only async
 * functions) can share it.
 *
 *   site_config `offer:featured`            { key: "thread:<id>" | "artwork:<uuid>" }
 *   threads.metadata.page.template          template id stored WITH a piece homed on the org
 *   site_config `offer:template:<key>`      { template } for an artwork, or a piece the org
 *                                           only lists (it cannot edit another author's row)
 *   threads.metadata.page.program           running order [{ time, label }] (optional)
 */

export const FEATURED_KEY = "offer:featured";
export const TEMPLATE_KEY_PREFIX = "offer:template:";

/** The content-library key forms (packages/content KEY_RE): thread ids are nanoid(21), artwork ids uuids. */
const THREAD_KEY = /^thread:[A-Za-z0-9_-]{1,21}$/;
const ARTWORK_KEY = /^artwork:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isContentKey(v: unknown): v is string {
  return typeof v === "string" && (THREAD_KEY.test(v) || ARTWORK_KEY.test(v));
}

/** `offer:featured` value -> its key, or null when the row holds anything else. */
export function parseFeatured(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const k = (value as Record<string, unknown>).key;
  return isContentKey(k) ? k : null;
}

/** Default template for a kind of piece, when none is stored. */
export const DEFAULT_TEMPLATE: Record<OfferKind, TemplateId> = {
  event: "event",
  service: "service",
  series: "series",
  artwork: "artwork",
  writing: "essay",
};

/** Templates a piece of this kind may use (the catalogue's `kinds`; the profile template is the second page, never a piece's). */
export function templatesFor(kind: OfferKind): TemplateId[] {
  return TEMPLATES.filter((t) => t.id !== "profile" && t.kinds.includes(kind)).map((t) => t.id);
}

/** A stored template id kept only when it is known and suits the kind; otherwise null (caller uses the default). */
export function cleanTemplate(id: unknown, kind: OfferKind): TemplateId | null {
  return typeof id === "string" && (templatesFor(kind) as string[]).includes(id) ? (id as TemplateId) : null;
}

/** `metadata.page.program` -> running order rows; anything malformed is dropped, at most 20 rows. */
export function cleanProgram(value: unknown): Array<{ time: string; label: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
    .filter((r): r is Record<string, unknown> => Boolean(r))
    .map((r) => ({ time: typeof r.time === "string" ? r.time.trim().slice(0, 16) : "", label: typeof r.label === "string" ? r.label.trim().slice(0, 80) : "" }))
    .filter((r) => r.time && r.label)
    .slice(0, 20);
  return rows.length ? rows : undefined;
}
