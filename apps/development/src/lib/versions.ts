import { db as defaultSql } from "@elkdonis/db";
import { nextBranchName, type DraftRow, type History, type VersionRow } from "./versions-types";

// ============================================================================
// The versions store: a small server module for the Development sandbox, over the
// `dev_versions` table (migration 281). Kept inside apps/development, not in
// @elkdonis/services, because nothing else consumes it yet; it is subject-generic
// ("block:<app>:<id>" now, "page:<org>:<slug>" later), so it can move there unchanged.
//
// Rules: a version is never updated or deleted (only `kept` moves). Saving from a
// version that already has a child starts a new branch. The working copy ("draft")
// is the one row that is overwritten, one per (subject, author).
// Callers (versions-actions.ts) have already passed getNetworkAdmin().
// ============================================================================

/** A postgres.js client or transaction (so a test can run the lot inside BEGIN/ROLLBACK). */
export type Db = typeof defaultSql;

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function toVersion(r: Row): VersionRow {
  return {
    id: String(r.id),
    subject: String(r.subject),
    parentId: r.parent_id ? String(r.parent_id) : null,
    branch: String(r.branch),
    note: (r.note as string | null) ?? "",
    doc: r.doc,
    theme: (r.theme as string | null) ?? null,
    author: (r.author_name as string | null) ?? null,
    kept: Boolean(r.kept),
    createdAt: iso(r.created_at),
  };
}
function toDraft(r: Row): DraftRow {
  return { id: String(r.id), subject: String(r.subject), baseId: r.parent_id ? String(r.parent_id) : null, doc: r.doc, theme: (r.theme as string | null) ?? null, updatedAt: iso(r.updated_at) };
}

/** True when the failure is "the table is not there yet" (migration 281 not applied). */
export function isMissingTable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "42P01" || /dev_versions.*does not exist/i.test(e instanceof Error ? e.message : "");
}

export async function listHistory(subject: string, userId: string, sql: Db = defaultSql): Promise<History> {
  const rows = await sql<Row[]>`
    SELECT v.*, COALESCE(NULLIF(u.display_name, ''), u.email) AS author_name
      FROM dev_versions v LEFT JOIN users u ON u.id = v.author_id
     WHERE v.subject = ${subject} AND v.kind = 'version'
     ORDER BY v.created_at ASC, v.id ASC
     LIMIT 500`;
  const d = await sql<Row[]>`SELECT * FROM dev_versions WHERE subject = ${subject} AND kind = 'draft' AND author_id = ${userId} LIMIT 1`;
  return { versions: rows.map(toVersion), draft: d[0] ? toDraft(d[0]) : null };
}

export async function countsBySubject(sql: Db = defaultSql): Promise<Record<string, number>> {
  const rows = await sql<{ subject: string; n: number }[]>`SELECT subject, count(*)::int AS n FROM dev_versions WHERE kind = 'version' GROUP BY subject`;
  return Object.fromEntries(rows.map((r) => [r.subject, r.n]));
}

export type SaveOutcome = { saved: VersionRow; newBranch: boolean } | { needsName: true; suggested: string };

/**
 * Save a version. `baseId` = the version the working copy came from (null = from the block's defaults).
 * If that version already has a child, or this is a second root, a new branch begins: `branchName`
 * is then required (the caller shows `suggested`, default "Try N"). The caller's working copy is dropped.
 */
export async function saveVersion(
  input: { subject: string; baseId: string | null; note: string; doc: unknown; theme: string | null; branchName?: string; userId: string },
  sql: Db = defaultSql,
): Promise<SaveOutcome> {
  const { subject, baseId, note, doc, theme, userId } = input;
  const all = await sql<{ id: string; parent_id: string | null; branch: string }[]>`SELECT id, parent_id, branch FROM dev_versions WHERE subject = ${subject} AND kind = 'version' ORDER BY created_at`;
  const base = baseId ? all.find((v) => v.id === baseId) : undefined;
  if (baseId && !base) throw new Error("That version no longer exists.");
  const used = [...new Set(all.map((v) => v.branch))];
  const branching = baseId ? all.some((v) => v.parent_id === baseId) : all.length > 0;
  let branch = base?.branch ?? "Main";
  if (branching) {
    const asked = (input.branchName ?? "").trim().slice(0, 40);
    if (!asked) return { needsName: true, suggested: nextBranchName(used) };
    branch = asked;
    let n = 2;
    while (used.includes(branch)) branch = `${asked.slice(0, 36)} ${n++}`;
  }
  const [row] = await sql<Row[]>`
    INSERT INTO dev_versions (subject, kind, parent_id, branch, note, doc, theme, author_id)
    VALUES (${subject}, 'version', ${baseId}, ${branch}, ${note.slice(0, 280) || null}, ${sql.json(doc as never)}, ${theme}, ${userId})
    RETURNING *, (SELECT COALESCE(NULLIF(display_name, ''), email) FROM users WHERE id = ${userId}) AS author_name`;
  await sql`DELETE FROM dev_versions WHERE subject = ${subject} AND kind = 'draft' AND author_id = ${userId}`;
  return { saved: toVersion(row), newBranch: branching };
}

/** The autosaved working copy: overwritten in place, one per (subject, author). */
export async function saveDraft(input: { subject: string; baseId: string | null; doc: unknown; theme: string | null; userId: string }, sql: Db = defaultSql): Promise<{ updatedAt: string }> {
  const { subject, baseId, doc, theme, userId } = input;
  const [row] = await sql<Row[]>`
    INSERT INTO dev_versions (subject, kind, parent_id, branch, doc, theme, author_id)
    VALUES (${subject}, 'draft', ${baseId}, 'draft', ${sql.json(doc as never)}, ${theme}, ${userId})
    ON CONFLICT (subject, author_id) WHERE kind = 'draft'
    DO UPDATE SET parent_id = EXCLUDED.parent_id, doc = EXCLUDED.doc, theme = EXCLUDED.theme, updated_at = now()
    RETURNING updated_at`;
  return { updatedAt: iso(row.updated_at) };
}

export async function discardDraft(subject: string, userId: string, sql: Db = defaultSql): Promise<void> {
  await sql`DELETE FROM dev_versions WHERE subject = ${subject} AND kind = 'draft' AND author_id = ${userId}`;
}

/** Mark one version as the favourite of its subject (clears the previous one). Returns false if it is not a version. */
export async function keepVersion(id: string, sql: Db = defaultSql): Promise<boolean> {
  const [v] = await sql<{ subject: string }[]>`SELECT subject FROM dev_versions WHERE id = ${id} AND kind = 'version'`;
  if (!v) return false;
  await sql`UPDATE dev_versions SET kept = false WHERE subject = ${v.subject} AND kept`;
  await sql`UPDATE dev_versions SET kept = true WHERE id = ${id}`;
  return true;
}

/** Drop the favourite mark from a version. */
export async function unkeepVersion(id: string, sql: Db = defaultSql): Promise<void> {
  await sql`UPDATE dev_versions SET kept = false WHERE id = ${id} AND kind = 'version'`;
}
