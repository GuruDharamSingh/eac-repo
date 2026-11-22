import { db } from "@elkdonis/db";
import { sanitizeRichValues } from "@elkdonis/blocks";
import { validatePage } from "./validate";
import { isValidPagePath, isValidSlug } from "./slug";

export { isValidSlug };

// ============================================================================
// Where a page lives.
//
// SHARED, and the org id is an ARGUMENT rather than an import. Every site in
// this repo has a `siteConfig.orgId`, and reaching for one of them here is
// what would make this file un-shareable — a store that knows whose pages it
// holds can only ever hold one site's.
//
// site_config is (org_id, key, value jsonb) with a primary key on the first
// two — a key/value store per organisation that already exists. A page is one
// row keyed "puck:<slug>", so this needed no migration and no new table, and a
// page belonging to one org can never be read as another's because org_id is
// half the key.
//
// Puck's saved shape is documented JSON, and we store it verbatim rather than
// translating it into something of our own. That is the property worth keeping:
// if Puck is ever replaced, the pages are still readable data rather than an
// export problem.
// ============================================================================

const keyFor = (slug: string) => `puck:${slug}`;

export interface PuckPage {
  slug: string;
  data: unknown;
  updatedAt: string | null;
}

export async function loadPage(
  orgId: string,
  slug: string,
  knownTypes?: Set<string>
): Promise<PuckPage | null> {
  // A page may live at a nested path now, so the whole path is validated
  // rather than a single segment. Still the same rule per segment — nothing
  // new reaches a storage key.
  if (!isValidPagePath(slug)) return null;
  try {
    const [row] = await db<Array<{ value: unknown; updated_at: string }>>`
      SELECT value, updated_at FROM site_config
      WHERE org_id = ${orgId} AND key = ${keyFor(slug)}
      LIMIT 1
    `;
    if (!row) return null;

    // Validate on the way OUT, not only on the way in. Save-side checks
    // protect future writes; this protects us from the rows already there,
    // including any hand-authored by hand or written by an older version.
    const check = validatePage(row.value, knownTypes);
    for (const w of check.warnings) console.warn(`[puck] ${slug} ${w.path}: ${w.message}`);
    if (!check.ok) {
      console.error(
        `[puck] ${slug} is not renderable: ` +
          check.errors.map((e) => `${e.path || "(root)"} — ${e.message}`).join("; ")
      );
      // Null, not a throw: the caller already knows how to show "no such page",
      // and a broken row should read as a missing page rather than a 500.
      return null;
    }

    return { slug, data: row.value, updatedAt: row.updated_at };
  } catch (err) {
    console.error(`[puck] loadPage(${slug}):`, err);
    return null;
  }
}

/**
 * A page and the version it was read at, for an editor that wants to refuse a
 * stale save (see savePage's `expectedUpdatedAt`). `updatedAt` is the row's
 * timestamp as Postgres prints it (`updated_at::text`, microseconds and zone
 * included): an opaque token to hand back, not something to parse. A JS Date
 * would cut it to milliseconds and the comparison would never match.
 *
 * Same validation as loadPage; null for a missing or unrenderable page.
 */
export async function loadPageWithVersion(
  orgId: string,
  slug: string,
  knownTypes?: Set<string>
): Promise<{ data: unknown; updatedAt: string } | null> {
  if (!isValidPagePath(slug)) return null;
  try {
    // Version FIRST, then the data: a save landing between the two leaves a
    // version older than the data, which only ever errs towards "stale".
    const [row] = await db<Array<{ version: string }>>`
      SELECT updated_at::text AS version FROM site_config
      WHERE org_id = ${orgId} AND key = ${keyFor(slug)}
      LIMIT 1
    `;
    if (!row) return null;
    const page = await loadPage(orgId, slug, knownTypes);
    if (!page) return null;
    return { data: page.data, updatedAt: row.version };
  } catch (err) {
    console.error(`[puck] loadPageWithVersion(${slug}):`, err);
    return null;
  }
}

export interface SavePageResult {
  ok: boolean;
  error?: string;
  /** True when `expectedUpdatedAt` no longer matched: nothing was written. */
  stale?: boolean;
  /** The row's new version, to pass as the next `expectedUpdatedAt`. */
  updatedAt?: string;
}

/** Refuse anything that would not survive being read back. */
const MAX_PAGE_BYTES = 512 * 1024;

export async function savePage(
  orgId: string,
  slug: string,
  data: unknown,
  /**
   * The `updatedAt` from loadPageWithVersion. When given, the write happens
   * only if the row still has that version (one UPDATE ... WHERE, so two tabs
   * cannot both pass the check); otherwise nothing is written and the result
   * has `stale: true`. A page deleted since it was read is stale too. Omitted:
   * the unconditional upsert, exactly as before.
   */
  expectedUpdatedAt?: string
): Promise<SavePageResult> {
  if (!isValidPagePath(slug)) return { ok: false, error: "That page name is not usable in a URL." };

  // Rich text is cut down to what a page's text may hold before it is
  // stored (the blocks sanitise again when they render).
  data = sanitizeRichValues(data);
  const check = validatePage(data);
  if (!check.ok) {
    console.error(`[puck] refusing to save ${slug}:`, check.errors);
    return { ok: false, error: "That page is not in a shape we can store." };
  }
  // A runaway paste loop or a deep nest would otherwise become a slow public
  // render and a large payload on every view.
  if (JSON.stringify(data).length > MAX_PAGE_BYTES) {
    return { ok: false, error: "That page is too large to save." };
  }
  try {
    if (expectedUpdatedAt) {
      // `::text::timestamptz`, not a bare `::timestamptz`: postgres.js sends a timestamptz parameter through a JS
      // Date (milliseconds), and the version is `updated_at::text` with microseconds, so the bare cast never
      // matched and every guarded save answered stale (found 2026-11-20, 0 of 35 live rows matched).
      const rows = await db<Array<{ version: string }>>`
        UPDATE site_config
        SET value = ${db.json(data as never)}, updated_at = NOW()
        WHERE org_id = ${orgId} AND key = ${keyFor(slug)}
          AND updated_at = ${expectedUpdatedAt}::text::timestamptz
        RETURNING updated_at::text AS version
      `;
      if (rows.length === 0) {
        return { ok: false, stale: true, error: "This page changed since you opened it." };
      }
      return { ok: true, updatedAt: rows[0]!.version };
    }
    const rows = await db<Array<{ version: string }>>`
      INSERT INTO site_config (org_id, key, value, updated_at)
      VALUES (${orgId}, ${keyFor(slug)}, ${db.json(data as never)}, NOW())
      ON CONFLICT (org_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING updated_at::text AS version
    `;
    return { ok: true, updatedAt: rows[0]?.version };
  } catch (err) {
    console.error(`[puck] savePage(${slug}):`, err);
    return { ok: false, error: "Could not save this page." };
  }
}

/** Every Puck page this org has, for an index. */
export async function listPages(orgId: string): Promise<Array<{ slug: string; updatedAt: string }>> {
  try {
    const rows = await db<Array<{ key: string; updated_at: string }>>`
      SELECT key, updated_at FROM site_config
      WHERE org_id = ${orgId} AND key LIKE 'puck:%'
      ORDER BY updated_at DESC
    `;
    return rows.map((r) => ({ slug: r.key.slice("puck:".length), updatedAt: r.updated_at }));
  } catch (err) {
    console.error("[puck] listPages:", err);
    return [];
  }
}
