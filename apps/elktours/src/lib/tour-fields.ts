// Server only. The words of one tour, edited in place on its page by the guide who leads it (or an owner): the one place that
// decides who may, validates, writes, and keeps ONE previous version of what a save replaced.
//
//   tour field        stored in                                  kept as the previous version under
//   title             threads.title                              threads.metadata.previousVersions.title
//   excerpt           threads.excerpt  ("what to expect")        ...previousVersions.excerpt
//   goodToKnow        threads.metadata.goodToKnow  (string[])    ...previousVersions.goodToKnow
//   contact           threads.metadata.contact     (string)      ...previousVersions.contact
//   stop line         tour_stops.excerpt                         ...previousVersions["stop:<stop id>"]
//
// Why not the existing actions (saveTourAction, patchTourAction, setStopExcerptAction): they gate on "any owner or guide of the
// organisation" (a guide could rewrite someone else's tour), saveTourAction writes the whole form, and a title change in both
// rewrites the slug, which would break the link a customer was sent. This module keeps their limits and their cleaning
// (title 200, summary 300 through deriveExcerpt, bullets 30 x 300, stop line 300 plain text) and adds the per-tour check.
// `metadata.goodToKnow`, `.contact` and `.previousVersions` are top-level keys on purpose: saveTourAction rewrites only
// `metadata.tour` and `coverImageUrl`, so a form save from the office does not drop them.
//
// Every function takes the sql handle (`db`, or a transaction in the check script) and the actor; none reads a session or a
// request. The session-bound wrappers are in lib/fields-site.ts.

import { checkValue, type FieldSpec } from "@elkdonis/house-editor/fields/server";
import { db } from "@elkdonis/db";
import { deriveExcerpt } from "@elkdonis/utils";
import { departuresSql } from "@/lib/departures";
import { siteConfig } from "@/config/site";
import { tourFieldsRegistry } from "@/lib/tour-fields-registry";

const ORG = siteConfig.orgId;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** postgres.js's `db` or a transaction of it (the check script runs everything in one and rolls it back). */
export type Sql = typeof db;

export interface Actor {
  userId: string;
  /** Role in this organisation, from getViewer(): "owner", "guide", ... or null. */
  role: string | null;
}

export interface KeptVersion {
  value: string;
  by: string | null;
  at: string;
}

export const TOUR_FIELD_NAMES = ["title", "excerpt", "goodToKnow", "contact"] as const;
export type TourFieldName = (typeof TOUR_FIELD_NAMES)[number];

export const NOT_YOURS = "Only the guide who leads this tour, or an owner, can change it.";
export const NOT_PUBLISHED = "Only a published tour can be changed from its page. Use the office for a tour that is not published yet.";

interface TourRow {
  id: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  status: string;
  visibility: string;
  author_id: string | null;
  slug: string;
  version: string;
  metadata: Record<string, unknown> | null;
}

async function tourRow(sql: Sql, tourId: string): Promise<TourRow | null> {
  if (typeof tourId !== "string" || tourId.length < 1 || tourId.length > 64) return null;
  const [r] = (await sql`
    SELECT id, title, excerpt, body, status, visibility, author_id, slug, updated_at::text AS version, metadata
    FROM threads WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' LIMIT 1
  `) as unknown as TourRow[];
  return r ?? null;
}

/**
 * May this person change this tour's words from its page. True, or the reason in plain words. An owner of the organisation, the
 * guide who wrote the tour, or a guide leading one of its coming dates; and only while the tour is published and public.
 */
export async function mayEditTour(sql: Sql, actor: Actor | null, tour: Pick<TourRow, "id" | "status" | "visibility" | "author_id">): Promise<true | string> {
  if (!actor || !UUID.test(actor.userId ?? "")) return "Sign in as the guide of this tour to change it.";
  if (actor.role !== "owner" && actor.role !== "guide") return NOT_YOURS;
  if (tour.status !== "published" || tour.visibility !== "PUBLIC") return NOT_PUBLISHED;
  if (actor.role === "owner" || tour.author_id === actor.userId) return true;
  const [led] = (await sql`
    SELECT 1 AS yes FROM ${departuresSql()} d
    WHERE d.thread_id = ${tour.id} AND d.org_id = ${ORG} AND d.guide_user_id = ${actor.userId}
      AND d.status <> 'cancelled' AND d.starts_at > NOW()
    LIMIT 1
  `) as unknown as { yes: number }[];
  return led ? true : NOT_YOURS;
}

/** The page asks this once per request for a signed-in editor: the tour's id when the edit marks may be drawn, else null. */
export async function editableTourId(sql: Sql, actor: Actor | null, tourId: string): Promise<string | null> {
  if (!actor) return null;
  const row = await tourRow(sql, tourId);
  if (!row) return null;
  return (await mayEditTour(sql, actor, row)) === true ? row.id : null;
}

// ── cleaning ──────────────────────────────────────────────────────────────

/** Plain text: tags (and the insides of script and style) removed, the rest collapsed to single spaces. */
function plainLine(s: string): string {
  return s
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The stop line as setStopExcerptAction keeps it: tags out, runs of spaces folded, line breaks kept as one space. */
function plainStopLine(s: string): string {
  return plainLine(s);
}

const declared: Record<string, Record<string, FieldSpec>> = {
  tour: tourFieldsRegistry.tour.fields as Record<string, FieldSpec>,
  tourstop: tourFieldsRegistry.tourstop.fields as Record<string, FieldSpec>,
};
const spec = (kind: "tour" | "tourstop", field: string): FieldSpec => {
  const f = declared[kind]?.[field];
  if (!f) throw new Error(`no field ${kind}.${field}`);
  return f;
};

type Cleaned = { ok: boolean; value?: string; error?: string };

/** One tour field's value, checked against its declared limits and cleaned. "" = empty (clears the field where it may be cleared). */
export function cleanTourField(field: string, raw: unknown): Cleaned {
  if (!(TOUR_FIELD_NAMES as readonly string[]).includes(field)) return { ok: false, error: `${field} is not an editable field.` };
  const s = spec("tour", field);
  const c = checkValue(s, raw);
  if (!c.ok) return { ok: false, error: c.error };
  if (field === "goodToKnow") {
    const items = c.value === "" ? [] : c.value.split("\n").map(plainLine).filter(Boolean);
    return { ok: true, value: items.join("\n") };
  }
  const v = plainLine(c.value);
  if (field === "title") {
    if (v.length < 2) return { ok: false, error: "Give the tour a title (at least 2 letters)." };
    return { ok: true, value: v };
  }
  return { ok: true, value: v };
}

export function cleanStopLine(raw: unknown): Cleaned {
  const c = checkValue(spec("tourstop", "line"), raw);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, value: plainStopLine(c.value) };
}

// ── reading ───────────────────────────────────────────────────────────────

function metaStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()) : [];
}

function keptOf(meta: Record<string, unknown> | null, key: string): KeptVersion | null {
  const all = meta?.previousVersions;
  if (!all || typeof all !== "object" || Array.isArray(all)) return null;
  const e = (all as Record<string, unknown>)[key] as { value?: unknown; by?: unknown; at?: unknown } | undefined;
  if (!e || typeof e.value !== "string" || typeof e.at !== "string") return null;
  return { value: e.value, by: typeof e.by === "string" ? e.by : null, at: e.at };
}

function currentOf(row: TourRow): Record<TourFieldName, string> {
  const m = row.metadata ?? {};
  return {
    title: row.title,
    excerpt: row.excerpt ?? "",
    goodToKnow: metaStrings(m.goodToKnow).join("\n"),
    contact: typeof m.contact === "string" ? m.contact : "",
  };
}

export interface ReadResult {
  values: Record<string, string>;
  version: string;
  readOnly?: string;
  previous?: Record<string, KeptVersion>;
}

/** What the panel shows for a tour. A person who may not edit it gets no values, only the reason. */
export async function readTourFields(sql: Sql, actor: Actor | null, tourId: string): Promise<ReadResult | null> {
  const row = await tourRow(sql, tourId);
  if (!row) return null;
  const may = await mayEditTour(sql, actor, row);
  if (may !== true) return { values: {}, version: "", readOnly: may };
  const values = currentOf(row);
  const previous: Record<string, KeptVersion> = {};
  for (const f of TOUR_FIELD_NAMES) {
    const k = keptOf(row.metadata, f);
    if (k) previous[f] = k;
  }
  return { values, version: row.version, previous };
}

// ── writing ───────────────────────────────────────────────────────────────

async function nameOf(sql: Sql, userId: string): Promise<string | null> {
  if (!UUID.test(userId)) return null;
  const [u] = (await sql`SELECT display_name FROM users WHERE id = ${userId}::uuid`.catch(() => [])) as unknown as { display_name: string | null }[];
  return u?.display_name ?? null;
}

async function refresh(slug: string | null): Promise<void> {
  // Outside a request (the check script) there is no cache to refresh; that is not an error.
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/tours");
    if (slug) revalidatePath(`/tours/${slug}`);
  } catch {
    /* not in a request */
  }
}

export type WriteResult = { ok: boolean; changed?: string[]; error?: string };

/**
 * Change some of a tour's words. `values` holds only the fields to change (the same strings the lens sends). A field whose
 * cleaned value equals what is stored is left alone, and keeps its earlier version. For each field that changes, the value
 * it replaces becomes that field's one kept version (who, when), in the same statement as the change.
 */
export async function saveTourFields(sql: Sql, actor: Actor | null, tourId: string, values: Record<string, unknown>): Promise<WriteResult> {
  const row = await tourRow(sql, tourId);
  if (!row) return { ok: false, error: "That tour was not found." };
  const may = await mayEditTour(sql, actor, row);
  if (may !== true) return { ok: false, error: may };
  const cur = currentOf(row);

  const next: Partial<Record<TourFieldName, string>> = {};
  for (const [f, raw] of Object.entries(values ?? {})) {
    const c = cleanTourField(f, raw);
    if (!c.ok) return { ok: false, error: c.error };
    if (c.value !== cur[f as TourFieldName]) next[f as TourFieldName] = c.value ?? "";
  }
  const changed = Object.keys(next) as TourFieldName[];
  if (changed.length === 0) return { ok: true, changed: [] };

  const by = await nameOf(sql, actor!.userId);
  const at = new Date().toISOString();
  const kept: Record<string, { value: string; by: string | null; byId: string; at: string }> = {};
  for (const f of changed) kept[f] = { value: cur[f], by, byId: actor!.userId, at };

  const title = next.title ?? row.title;
  // The summary as the wizard stores it: what was typed, else the opening of the body.
  const excerpt = next.excerpt !== undefined ? deriveExcerpt(row.body ?? "", { explicit: next.excerpt || undefined }) : row.excerpt;
  const patch: Record<string, unknown> = {};
  if (next.goodToKnow !== undefined) patch.goodToKnow = next.goodToKnow === "" ? [] : next.goodToKnow.split("\n");
  if (next.contact !== undefined) patch.contact = next.contact === "" ? null : next.contact;

  await sql`
    UPDATE threads SET
      title = ${title},
      excerpt = ${excerpt},
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb) || ${sql.json(patch as never)},
        '{previousVersions}',
        COALESCE(metadata->'previousVersions', '{}'::jsonb) || ${sql.json(kept as never)},
        true
      ),
      updated_at = NOW()
    WHERE id = ${row.id} AND org_id = ${ORG} AND kind = 'tour' AND status = 'published'
  `;
  await refresh(row.slug);
  return { ok: true, changed };
}

/** Put one field back to the version it kept. The value it had trades places with it, so putting back twice undoes itself. */
export async function putBackTourField(sql: Sql, actor: Actor | null, tourId: string, field: string): Promise<WriteResult> {
  if (!(TOUR_FIELD_NAMES as readonly string[]).includes(field)) return { ok: false, error: `${field} is not an editable field.` };
  const row = await tourRow(sql, tourId);
  if (!row) return { ok: false, error: "That tour was not found." };
  const may = await mayEditTour(sql, actor, row);
  if (may !== true) return { ok: false, error: may };
  const k = keptOf(row.metadata, field);
  if (!k) return { ok: false, error: "There is no earlier version of this to put back." };
  return saveTourFields(sql, actor, tourId, { [field]: k.value });
}

// ── stops ─────────────────────────────────────────────────────────────────

interface StopRow {
  id: string;
  thread_id: string;
  excerpt: string | null;
  version: string;
}

async function stopRow(sql: Sql, stopId: string): Promise<(StopRow & { tour: TourRow }) | null> {
  if (typeof stopId !== "string" || !UUID.test(stopId)) return null;
  const [s] = (await sql`
    SELECT id, thread_id, excerpt, updated_at::text AS version FROM tour_stops WHERE id = ${stopId} AND org_id = ${ORG} LIMIT 1
  `) as unknown as StopRow[];
  if (!s) return null;
  const tour = await tourRow(sql, s.thread_id);
  return tour ? { ...s, tour } : null;
}

export async function readStopLine(sql: Sql, actor: Actor | null, stopId: string): Promise<ReadResult | null> {
  const s = await stopRow(sql, stopId);
  if (!s) return null;
  const may = await mayEditTour(sql, actor, s.tour);
  if (may !== true) return { values: {}, version: "", readOnly: may };
  const k = keptOf(s.tour.metadata, `stop:${s.id}`);
  return { values: { line: s.excerpt ?? "" }, version: s.version, ...(k ? { previous: { line: k } } : {}) };
}

export async function saveStopLine(sql: Sql, actor: Actor | null, stopId: string, raw: unknown): Promise<WriteResult> {
  const s = await stopRow(sql, stopId);
  if (!s) return { ok: false, error: "That stop was not found." };
  const may = await mayEditTour(sql, actor, s.tour);
  if (may !== true) return { ok: false, error: may };
  const c = cleanStopLine(raw);
  if (!c.ok) return { ok: false, error: c.error };
  const cur = s.excerpt ?? "";
  if (c.value === cur) return { ok: true, changed: [] };

  const by = await nameOf(sql, actor!.userId);
  const kept = { [`stop:${s.id}`]: { value: cur, by, byId: actor!.userId, at: new Date().toISOString() } };
  // One statement: the line and the kept version change together or not at all.
  await sql`
    WITH s AS (
      UPDATE tour_stops SET excerpt = ${c.value ? c.value : null}, updated_at = NOW()
      WHERE id = ${s.id} AND org_id = ${ORG} RETURNING id
    )
    UPDATE threads SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{previousVersions}',
      COALESCE(metadata->'previousVersions', '{}'::jsonb) || ${sql.json(kept as never)},
      true
    )
    WHERE id = ${s.thread_id} AND org_id = ${ORG} AND EXISTS (SELECT 1 FROM s)
  `;
  await refresh(s.tour.slug);
  return { ok: true, changed: ["line"] };
}

export async function putBackStopLine(sql: Sql, actor: Actor | null, stopId: string): Promise<WriteResult> {
  const s = await stopRow(sql, stopId);
  if (!s) return { ok: false, error: "That stop was not found." };
  const may = await mayEditTour(sql, actor, s.tour);
  if (may !== true) return { ok: false, error: may };
  const k = keptOf(s.tour.metadata, `stop:${s.id}`);
  if (!k) return { ok: false, error: "There is no earlier version of this to put back." };
  return saveStopLine(sql, actor, stopId, k.value);
}
