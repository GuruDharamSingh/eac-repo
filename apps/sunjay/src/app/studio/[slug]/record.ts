import { isValidSlug } from "@elkdonis/page-builder/server";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";

// ============================================================================
// The record a template is opened on (round 2, 2026-11-14, agreed with system32-fc):
// /studio/<template>?thread=<threadId> (event-detail, post-detail) or ?piece=<slug>
// (journal-piece). Passed to the editors as resolver metadata (`threadId`, `piece`),
// the keys the route pages already pass when they draw a template
// (app/[feed]/[slug]/page.tsx, app/journal/[piece]/page.tsx), so the editor draws
// THAT gathering, post or piece instead of the newest. Only on a template slug; a
// value that is not an id or a slug is dropped. Visibility is the loaders' job
// (editors only, through /api/blocks): this only names the record.
// ============================================================================

/** A thread id as this database writes them (nanoid-style, e.g. 21 characters of A-Z a-z 0-9 _ -), or a UUID. */
const THREAD_ID = /^[A-Za-z0-9_-]{6,64}$/;

export interface StudioRecord {
  threadId?: string;
  piece?: string;
}

export function studioRecord(slug: string, q: { thread?: string; piece?: string }): StudioRecord {
  if (!TEMPLATE_SLUGS.has(slug)) return {};
  const out: StudioRecord = {};
  if (typeof q.thread === "string" && THREAD_ID.test(q.thread)) out.threadId = q.thread;
  if (typeof q.piece === "string" && isValidSlug(q.piece)) out.piece = q.piece;
  return out;
}

/** The same record as a query string for the other editor's address ("" when none). */
export function recordQuery(r: StudioRecord, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  if (r.threadId) q.set("thread", r.threadId);
  if (r.piece) q.set("piece", r.piece);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}
