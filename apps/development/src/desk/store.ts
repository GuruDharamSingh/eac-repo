import { db as defaultSql } from "@elkdonis/db";
import { LIMITS, NOTE_KINDS, NOTE_STATUSES, type Note, type NoteKind, type NoteStatus, type Thread } from "./types";

// ============================================================================
// The desk store: a small server module over `dev_notes` (migration 302).
// Callers (actions.ts) have already passed getNetworkAdmin(). Plain text only; lengths are capped here
// as well as by the table's CHECKs. Tolerant of the table not existing yet: see isMissingTable.
// ============================================================================

export type Db = typeof defaultSql;
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export function isMissingTable(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "42P01" || /dev_notes.*does not exist/i.test(e instanceof Error ? e.message : "");
}

function toNote(r: Row): Note {
  const opts = Array.isArray(r.options) ? (r.options as unknown[]).map(String) : null;
  return {
    id: String(r.id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    path: String(r.path),
    anchor: (r.anchor as string | null) ?? null,
    anchorText: (r.anchor_text as string | null) ?? null,
    kind: r.kind as NoteKind,
    body: String(r.body),
    options: opts && opts.length ? opts : null,
    answer: (r.answer as string | null) ?? null,
    authorKind: r.author_kind === "claude" ? "claude" : "person",
    authorName: r.author_kind === "claude" ? "Claude" : ((r.author_name as string | null) ?? null),
    status: r.status as NoteStatus,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    resolvedAt: r.resolved_at ? iso(r.resolved_at) : null,
  };
}

const AUTHOR = (sql: Db) => sql`COALESCE(NULLIF(u.display_name, ''), u.email) AS author_name`;

async function withReplies(sql: Db, tops: Note[]): Promise<Thread[]> {
  if (!tops.length) return [];
  const ids = tops.map((t) => t.id);
  const rows = await sql<Row[]>`
    SELECT n.*, ${AUTHOR(sql)} FROM dev_notes n LEFT JOIN users u ON u.id = n.author_id
     WHERE n.parent_id IN ${sql(ids)} ORDER BY n.created_at ASC`;
  const by = new Map<string, Note[]>();
  for (const r of rows) {
    const n = toNote(r);
    const k = n.parentId as string;
    by.set(k, [...(by.get(k) ?? []), n]);
  }
  return tops.map((t) => ({ ...t, replies: by.get(t.id) ?? [] }));
}

export interface ListFilter {
  path?: string;
  openOnly?: boolean;
  since?: string; // ISO time: anything changed after it
  limit?: number;
}

/** Top-level notes (newest first) with their replies. */
export async function listThreads(f: ListFilter = {}, sql: Db = defaultSql): Promise<Thread[]> {
  const limit = Math.min(Math.max(f.limit ?? 300, 1), 500);
  const path = f.path ?? null;
  const since = f.since ? new Date(f.since) : null;
  if (since && Number.isNaN(since.getTime())) throw new Error("since must be a date.");
  const open = Boolean(f.openOnly);
  const rows = await sql<Row[]>`
    SELECT n.*, ${AUTHOR(sql)} FROM dev_notes n LEFT JOIN users u ON u.id = n.author_id
     WHERE n.parent_id IS NULL
       AND (${path}::text IS NULL OR n.path = ${path})
       AND (NOT ${open}::boolean OR n.status IN ('open', 'seen', 'doing'))
       AND (${since}::timestamptz IS NULL OR n.updated_at > ${since}::timestamptz)
     ORDER BY n.created_at DESC
     LIMIT ${limit}`;
  return withReplies(sql, rows.map(toNote));
}

/** One thread by full id or the first 6+ characters of it. Throws when the prefix matches more than one. */
export async function getThread(idOrPrefix: string, sql: Db = defaultSql): Promise<Thread | null> {
  const p = idOrPrefix.trim().toLowerCase();
  if (!/^[0-9a-f-]{6,36}$/.test(p)) return null;
  const rows = await sql<Row[]>`
    SELECT n.*, ${AUTHOR(sql)} FROM dev_notes n LEFT JOIN users u ON u.id = n.author_id
     WHERE n.id::text LIKE ${p + "%"} LIMIT 2`;
  if (rows.length > 1) throw new Error(`"${idOrPrefix}" matches more than one note; use more characters.`);
  if (!rows[0]) return null;
  const note = toNote(rows[0]);
  // A reply id opens its parent's thread.
  if (note.parentId) return getThread(note.parentId, sql);
  return (await withReplies(sql, [note]))[0] ?? null;
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\u0000/g, "").trim().slice(0, max);

export interface CreateInput {
  parentId?: string | null;
  path: string;
  anchor?: string | null;
  anchorText?: string | null;
  kind: NoteKind;
  body: string;
  options?: string[] | null;
  authorKind: "person" | "claude";
  authorId?: string | null;
  status?: NoteStatus;
}

export async function createNote(i: CreateInput, sql: Db = defaultSql): Promise<Note> {
  const body = clean(i.body, LIMITS.body);
  if (!body) throw new Error("Write something first.");
  if (!NOTE_KINDS.includes(i.kind)) throw new Error("Unknown kind.");
  const path = clean(i.path, LIMITS.path) || "/";
  if (!path.startsWith("/")) throw new Error("The page path must start with /.");
  const anchor = clean(i.anchor, LIMITS.anchor) || null;
  const anchorText = clean(i.anchorText, LIMITS.anchorText) || null;
  const options = i.options?.map((o) => clean(o, 200)).filter(Boolean).slice(0, 12);
  const status = i.status ?? "open";
  if (!NOTE_STATUSES.includes(status)) throw new Error("Unknown status.");
  const finished = status === "done" || status === "wontdo";
  const [row] = await sql<Row[]>`
    INSERT INTO dev_notes (parent_id, path, anchor, anchor_text, kind, body, options, author_id, author_kind, status, resolved_at)
    VALUES (${i.parentId ?? null}, ${path}, ${anchor}, ${anchorText}, ${i.kind}, ${body},
            ${options && options.length ? sql.json(options as never) : null}, ${i.authorId ?? null}, ${i.authorKind}, ${status},
            ${finished ? new Date() : null})
    RETURNING *, NULL::text AS author_name`;
  return toNote(row);
}

/** Reply to a thread. The reply takes the thread's page and anchor; `status` (optional) also moves the thread. */
export async function replyTo(
  threadId: string,
  input: { body: string; authorKind: "person" | "claude"; authorId?: string | null; status?: NoteStatus },
  sql: Db = defaultSql,
): Promise<Note> {
  const [t] = await sql<Row[]>`SELECT id, path, anchor, anchor_text, parent_id FROM dev_notes WHERE id = ${threadId}`;
  if (!t) throw new Error("That note no longer exists.");
  const rootId = t.parent_id ? String(t.parent_id) : String(t.id);
  const note = await createNote(
    { parentId: rootId, path: String(t.path), anchor: (t.anchor as string | null) ?? null, anchorText: (t.anchor_text as string | null) ?? null, kind: "note", body: input.body, authorKind: input.authorKind, authorId: input.authorId, status: "seen" },
    sql,
  );
  if (input.status) await setStatus(rootId, input.status, sql);
  else await sql`UPDATE dev_notes SET updated_at = now() WHERE id = ${rootId}`;
  return note;
}

export async function setStatus(id: string, status: NoteStatus, sql: Db = defaultSql): Promise<boolean> {
  if (!NOTE_STATUSES.includes(status)) throw new Error("Unknown status.");
  const finished = status === "done" || status === "wontdo";
  const rows = await sql`UPDATE dev_notes SET status = ${status}, updated_at = now(), resolved_at = ${finished ? new Date() : null} WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

/** Answer a question or decision: sets `answer` and marks it done. */
export async function answerNote(id: string, answer: string, sql: Db = defaultSql): Promise<boolean> {
  const a = clean(answer, LIMITS.body);
  if (!a) throw new Error("Pick an option or write an answer.");
  const rows = await sql`UPDATE dev_notes SET answer = ${a}, status = 'done', updated_at = now(), resolved_at = now() WHERE id = ${id} AND parent_id IS NULL RETURNING id`;
  return rows.length > 0;
}
