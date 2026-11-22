import { db } from "@elkdonis/db";
import { sanitizeRichValues } from "@elkdonis/blocks";
import { validatePage } from "./validate";
import { isValidPagePath } from "./slug";
import type { SavePageResult } from "./store";

// ============================================================================
// Drafts for an organisation's pages (contract C3, 2026-11-20).
//
// A machine proposes, a person publishes: an assistant's change, or an editor's
// unfinished one, waits here until somebody publishes it. NO migration: a draft
// is one `site_config` row of the org, key `puck-draft:<slug>`, beside the live
// page's `puck:<slug>`. `listPages` matches `puck:%` only, so a draft never
// shows as a page, and no public route reads one.
//
// The row's value:
//   { v: 1, data: <Puck doc>, base: <the live row's updated_at::text when the
//     draft began, or null for a page that does not exist yet>, author: { id,
//     kind: "person" | "assistant", label }, note?, steps?, savedAt: <ISO> }
//
// One draft per page: saving replaces it. Publishing runs the live page's own
// stale guard against `base`: a live page that changed since refuses (stale)
// and keeps the draft, so nobody's work is overwritten by an older proposal.
//
// WHAT A CALLER OF publishDraft MUST PASS: `{ clean }`, the same cleaner its own page-save action runs, i.e.
// `(data) => cleanBoxDoc(stripResolvedKeys(data, resolvedKeys))` (`@elkdonis/direct-edit/block`,
// `@elkdonis/blocks/record`; the host's RESOLVED_KEYS table). It is required, not defaulted, because this package cannot
// import either and a silent default would skip them. The gate (who may publish) is also the caller's.
//
// Server only (imports @elkdonis/db). Every function takes the org id as an
// argument, never from a request. The last argument, `{ tx }`, is for a caller
// that wants the work inside its own transaction (the check script rolls back).
// ============================================================================

type Sql = typeof db;

export interface DraftOptions {
  /** Run on this connection or transaction instead of the pool. */
  tx?: Sql;
}
export interface PublishOptions extends DraftOptions {
  /**
   * REQUIRED. The host's cleaning of a document before it is stored: the very function its page-save action runs
   * (`createSavePageAction`'s default is `cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS))`). page-builder cannot
   * import direct-edit's `cleanBoxDoc` or a host's resolver-key table, so it cannot supply a default, and a default that
   * cleaned nothing would let a draft publish what a live save would have stripped. A publish without one is refused.
   * A draft built from a stored page holds no resolver keys, but pass the same cleaner anyway: it is the one place the
   * "what may be stored" rule lives.
   */
  clean: (data: unknown) => unknown;
}

export interface DraftAuthor {
  id: string;
  kind: "person" | "assistant";
  label: string;
}

export interface PageDraft {
  v: 1;
  data: unknown;
  base: string | null;
  author: DraftAuthor;
  note?: string;
  steps?: unknown[];
  savedAt: string;
}

export interface DraftInput {
  /**
   * Compare-and-set. What the caller read before building this draft: the `savedAt` of the draft it loaded, or `null` for
   * "there was no draft". When given and the stored draft no longer matches (someone saved or discarded in between),
   * nothing is written and the answer is `{ ok: false, code: "draft_changed" }`. Absent: the draft is simply replaced.
   */
  expected?: string | null;
  data: unknown;
  base: string | null;
  author: DraftAuthor;
  note?: string;
  steps?: unknown[];
}

const PREFIX = "puck-draft:";
const keyFor = (slug: string) => `${PREFIX}${slug}`;
const liveKeyFor = (slug: string) => `puck:${slug}`;

/** The same cap `savePage` holds a page to. */
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_NOTE = 500;
const MAX_STEPS = 200;
const MAX_STEPS_BYTES = 64 * 1024;
/** site_config.key is varchar(100). */
const MAX_KEY = 100;

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v : null);

function checkAuthor(a: unknown): DraftAuthor | null {
  if (!a || typeof a !== "object") return null;
  const { id, kind, label } = a as Record<string, unknown>;
  if (kind !== "person" && kind !== "assistant") return null;
  const i = text(id, 80);
  const l = text(label, 120);
  return i && l ? { id: i, kind, label: l } : null;
}

/** A stored draft value, or null when it is not one this code wrote. */
export function parseDraft(value: unknown): PageDraft | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return null;
  const author = checkAuthor(v.author);
  if (!author) return null;
  if (!validatePage(v.data).ok) return null;
  if (v.base !== null && typeof v.base !== "string") return null;
  if (typeof v.savedAt !== "string") return null;
  return {
    v: 1,
    data: v.data,
    base: v.base as string | null,
    author,
    ...(typeof v.note === "string" ? { note: v.note } : {}),
    ...(Array.isArray(v.steps) ? { steps: v.steps } : {}),
    savedAt: v.savedAt,
  };
}

/** The draft waiting for this page, or null. A row that is not a draft this code wrote reads as none. */
export async function loadDraft(orgId: string, slug: string, o: DraftOptions = {}): Promise<PageDraft | null> {
  if (!isValidPagePath(slug)) return null;
  const q = o.tx ?? db;
  try {
    const [row] = await q<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${keyFor(slug)} LIMIT 1`;
    return row ? parseDraft(row.value) : null;
  } catch (err) {
    console.error(`[puck] loadDraft(${slug}):`, err);
    return null;
  }
}

/**
 * Keep a draft for this page, replacing any that waits. Checked like a page save: the document must be a page we can
 * store, rich text is cut down to what a page's text may hold, and the page size cap holds.
 */
export async function saveDraft(orgId: string, slug: string, draft: DraftInput, o: DraftOptions = {}): Promise<{ ok: boolean; error?: string; code?: string }> {
  if (!isValidPagePath(slug)) return { ok: false, error: "That page name is not usable in a URL." };
  if (keyFor(slug).length > MAX_KEY) return { ok: false, error: "That page name is too long to keep a draft for." };
  const author = checkAuthor(draft?.author);
  if (!author) return { ok: false, error: "A draft needs to say who made it." };
  if (draft.base !== null && typeof draft.base !== "string") return { ok: false, error: "A draft needs the version of the page it started from." };
  if (draft.note !== undefined && (typeof draft.note !== "string" || draft.note.length > MAX_NOTE)) return { ok: false, error: `A note is ${MAX_NOTE} characters at most.` };
  let steps: unknown[] | undefined;
  if (draft.steps !== undefined) {
    if (!Array.isArray(draft.steps) || draft.steps.length > MAX_STEPS) return { ok: false, error: `A draft keeps ${MAX_STEPS} steps at most.` };
    if (JSON.stringify(draft.steps).length > MAX_STEPS_BYTES) return { ok: false, error: "The steps of that draft are too large to keep." };
    steps = draft.steps;
  }
  const data = sanitizeRichValues(draft.data);
  if (!validatePage(data).ok) return { ok: false, error: "That page is not in a shape we can store." };
  if (JSON.stringify(data).length > MAX_PAGE_BYTES) return { ok: false, error: "That page is too large to save." };

  const value: PageDraft = {
    v: 1,
    data,
    base: draft.base,
    author,
    ...(draft.note ? { note: draft.note } : {}),
    ...(steps ? { steps } : {}),
    savedAt: new Date().toISOString(),
  };
  const q = o.tx ?? db;
  const changed = { ok: false, code: "draft_changed", error: "Someone saved or removed this draft since you opened it. Nothing was written; reload to see theirs." };
  try {
    if (draft.expected !== undefined) {
      if (draft.expected !== null && typeof draft.expected !== "string") return { ok: false, error: "A draft needs the time of the draft it started from." };
      // One statement. The draft's own savedAt is stored as text in the value, so it is compared as text (no timestamp cast).
      const rows = draft.expected === null
        ? await q`
            INSERT INTO site_config (org_id, key, value, updated_at)
            VALUES (${orgId}, ${keyFor(slug)}, ${q.json(value as never)}, NOW())
            ON CONFLICT (org_id, key) DO NOTHING RETURNING 1 AS ok`
        : await q`
            UPDATE site_config SET value = ${q.json(value as never)}, updated_at = NOW()
            WHERE org_id = ${orgId} AND key = ${keyFor(slug)} AND value->>'savedAt' = ${draft.expected}
            RETURNING 1 AS ok`;
      return rows.length ? { ok: true } : changed;
    }
    await q`
      INSERT INTO site_config (org_id, key, value, updated_at)
      VALUES (${orgId}, ${keyFor(slug)}, ${q.json(value as never)}, NOW())
      ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error(`[puck] saveDraft(${slug}):`, err);
    return { ok: false, error: "Could not keep this draft." };
  }
}

/** Run `fn` as one transaction, or as a savepoint when the caller already holds one. */
function atomic<T>(q: Sql, fn: (s: Sql) => Promise<T>): Promise<T> {
  const any = q as unknown as { begin?: (f: (s: Sql) => Promise<T>) => Promise<T>; savepoint?: (f: (s: Sql) => Promise<T>) => Promise<T> };
  if (typeof any.savepoint === "function") return any.savepoint(fn);
  if (typeof any.begin === "function") return any.begin(fn);
  return fn(q);
}

/**
 * Publish the waiting draft as the live page. The live page's own guard decides: when the row changed since the draft
 * began (or, for a new page, somebody made it), nothing is written, the answer is `stale: true`, and the draft stays.
 * On success the live row is written and the draft row deleted in one transaction. Same sanitiser, size cap and shape
 * check as `savePage`; the SQL is repeated here because `savePage` cannot join a transaction (store.ts is shared).
 * Who may publish is the caller's gate, not this function's.
 */
export async function publishDraft(orgId: string, slug: string, o: PublishOptions): Promise<SavePageResult> {
  if (!isValidPagePath(slug)) return { ok: false, error: "That page name is not usable in a URL." };
  if (typeof o?.clean !== "function") return { ok: false, error: "Publishing needs the site's cleaner, the same one its page save uses. Nothing was published." };
  const q = o.tx ?? db;
  try {
    return await atomic(q, async (sql) => {
      const [row] = await sql<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${keyFor(slug)} FOR UPDATE`;
      const draft = row ? parseDraft(row.value) : null;
      if (!draft) return { ok: false, error: "There is no draft waiting for this page." };

      const cleaned = o.clean(draft.data);
      const data = sanitizeRichValues(cleaned);
      if (!validatePage(data).ok) return { ok: false, error: "That page is not in a shape we can store." };
      if (JSON.stringify(data).length > MAX_PAGE_BYTES) return { ok: false, error: "That page is too large to save." };

      let version: string | undefined;
      if (draft.base) {
        const rows = await sql<Array<{ version: string }>>`
          UPDATE site_config SET value = ${sql.json(data as never)}, updated_at = NOW()
          WHERE org_id = ${orgId} AND key = ${liveKeyFor(slug)} AND updated_at = ${draft.base}::text::timestamptz
          RETURNING updated_at::text AS version`;
        version = rows[0]?.version;
      } else {
        const rows = await sql<Array<{ version: string }>>`
          INSERT INTO site_config (org_id, key, value, updated_at)
          VALUES (${orgId}, ${liveKeyFor(slug)}, ${sql.json(data as never)}, NOW())
          ON CONFLICT (org_id, key) DO NOTHING
          RETURNING updated_at::text AS version`;
        version = rows[0]?.version;
      }
      if (!version) return { ok: false, stale: true, error: "This page changed since the draft was started." };
      await sql`DELETE FROM site_config WHERE org_id = ${orgId} AND key = ${keyFor(slug)}`;
      return { ok: true, updatedAt: version };
    });
  } catch (err) {
    console.error(`[puck] publishDraft(${slug}):`, err);
    return { ok: false, error: "Could not publish this draft." };
  }
}

/** Throw the waiting draft away. Nothing waiting is not an error. */
export async function discardDraft(orgId: string, slug: string, o: DraftOptions = {}): Promise<void> {
  if (!isValidPagePath(slug)) return;
  const q = o.tx ?? db;
  await q`DELETE FROM site_config WHERE org_id = ${orgId} AND key = ${keyFor(slug)}`;
}

/** The drafts waiting for this organisation, newest first, without their documents. */
export async function listDrafts(
  orgId: string,
  o: DraftOptions = {}
): Promise<Array<{ slug: string; author: DraftAuthor; note: string | null; savedAt: string; base: string | null }>> {
  const q = o.tx ?? db;
  try {
    const rows = await q<Array<{ key: string; value: unknown }>>`
      SELECT key, value FROM site_config WHERE org_id = ${orgId} AND key LIKE ${PREFIX + "%"} ORDER BY updated_at DESC
    `;
    const out: Array<{ slug: string; author: DraftAuthor; note: string | null; savedAt: string; base: string | null }> = [];
    for (const r of rows) {
      const d = parseDraft(r.value);
      if (d) out.push({ slug: r.key.slice(PREFIX.length), author: d.author, note: d.note ?? null, savedAt: d.savedAt, base: d.base });
    }
    return out;
  } catch (err) {
    console.error("[puck] listDrafts:", err);
    return [];
  }
}
