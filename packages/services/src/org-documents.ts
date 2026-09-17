import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { createCollaborativeDocument } from './nextcloud';
import { davGetText } from './dav';

// ============================================================================
// The group's living documents.
//
// WHAT THEY ARE NOW. `threads` rows of `kind = 'document'` (migration 133).
// They used to be entries in a JSONB array under `site_config.living_documents`
// — a hand-rolled table with no author foreign key, no index, no revision
// history, a documented lost-update race on every non-append write, and an
// `ideaId` string field that was a thread edge somebody wrote by hand because
// there was nowhere to put one. That field is now a real `thread_gathers` row
// and the rest is a real table.
//
// The exported surface is UNCHANGED on purpose: same four functions, same
// `OrgDocument` shape. Three apps' routes and three hub pages call these and
// none of them had to learn anything. This is a storage swap, not a redesign.
//
// WHERE THE FILES LIVE. `EAC_Network/<orgId>/Media/Documents/`, the org's own
// folder, shared by a public WRITABLE link. That link is what makes a document
// collaborative for the majority of members, who have no Nextcloud account —
// and it is why `editUrl` is only ever handed out behind a membership guard.
// Migration 132 did not move a single file.
//
// This deployment has no Nextcloud Team folders (groupfolders): all fifteen
// orgs are plain Nextcloud users, so the org's own tree IS the team folder.
// ============================================================================

/** The kind these rows carry. In OFF_FEED_KINDS — a document is not a feed item. */
export const DOCUMENT_KIND = 'document';

export interface OrgDocument {
  id: string;
  title: string;
  /** Storage path, for reading the body back. */
  path?: string | null;
  url: string;
  /** Public writable share — what a member opens. */
  editUrl: string;
  createdAt: string;
  createdBy?: string | null;
  /** The idea this document belongs to, when it has been assigned to one. */
  ideaId?: string | null;
  ideaTitle?: string | null;
  /** The first lines of the file itself. Filled only when asked for. */
  snippet?: string | null;
}

interface DocRow {
  id: string;
  title: string;
  url: string | null;
  edit_url: string | null;
  path: string | null;
  created_at: Date | string;
  author_name: string | null;
  idea_id: string | null;
  idea_title: string | null;
}

/**
 * One row → one document.
 *
 * `url` and `editUrl` are non-null in the type but nullable in the column, and
 * a row missing its share is a document nobody can open. It is mapped to the
 * empty string rather than dropped: the group still wrote it, and a list that
 * silently loses an entry is worse than one that shows an entry which will not
 * open.
 */
function toDocument(row: DocRow): OrgDocument {
  return {
    id: row.id,
    title: row.title,
    path: row.path,
    url: row.url ?? '',
    editUrl: row.edit_url ?? '',
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    createdBy: row.author_name,
    ideaId: row.idea_id,
    ideaTitle: row.idea_title,
  };
}

/** The first prose of a markdown file, flattened to one line. */
function snippetOf(markdown: string): string | null {
  const text = markdown
    .split('\n')
    // Drop the heading the seed writes, so the snippet is not the title again.
    .filter((line) => !/^#{1,6}\s/.test(line.trim()))
    .join(' ')
    .replace(/[*_`>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 179)}…` : text;
}

/**
 * The org's documents, newest first.
 *
 * `withSnippets` reads that many files back from Nextcloud so the hub tile can
 * show what is actually IN the current document rather than its filename. It
 * is capped deliberately: one DAV round trip per document would make a list of
 * twenty documents a slow page for a snapshot only the first one shows.
 *
 * Archived rows are excluded, which is what `deleteOrgDocument` does — see the
 * note there for why removal archives rather than deletes.
 */
export async function listOrgDocuments(
  orgId: string,
  opts: { withSnippets?: number } = {}
): Promise<OrgDocument[]> {
  try {
    const rows = await db<DocRow[]>`
      SELECT
        t.id,
        t.title,
        t.document_url                    AS url,
        t.nextcloud_doc_url               AS edit_url,
        t.metadata->>'documentPath'       AS path,
        t.created_at,
        u.display_name                    AS author_name,
        -- The idea a document belongs to is now an edge, not a string field.
        -- One idea per document by construction: assignOrgDocument clears the
        -- others, so LIMIT 1 is a statement of that, not a guess.
        g.thread_id                       AS idea_id,
        i.title                           AS idea_title
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      LEFT JOIN LATERAL (
        SELECT gg.thread_id
        FROM thread_gathers gg
        JOIN threads ii ON ii.id = gg.thread_id AND ii.kind = 'idea'
        WHERE gg.target_thread_id = t.id AND gg.relation = 'gathers'
        ORDER BY gg.added_at ASC
        LIMIT 1
      ) g ON TRUE
      LEFT JOIN threads i ON i.id = g.thread_id
      WHERE t.org_id = ${orgId}
        AND t.kind = ${DOCUMENT_KIND}
        AND t.status = 'published'
      ORDER BY t.created_at DESC
    `;

    const docs = rows.map(toDocument);

    const wanted = Math.min(opts.withSnippets ?? 0, 3);
    if (wanted > 0) {
      await Promise.all(
        docs.slice(0, wanted).map(async (doc) => {
          if (!doc.path) return;
          // A document whose file is gone still lists — with no snippet. The
          // index is the record; the file is allowed to be missing.
          const text = await davGetText(doc.path).catch(() => null);
          if (text) doc.snippet = snippetOf(text);
        })
      );
    }

    return docs;
  } catch (error) {
    console.error(`[org-documents] list(${orgId}):`, error);
    return [];
  }
}

/** A date-stamped name for a document nobody has decided the point of yet. */
function scrapTitle(now = new Date()): string {
  return `Scrap — ${now.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function slugFor(title: string, id: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document';
  // Carries the id: documents are off every feed so nothing routes by this,
  // but two scrap docs made on the same day have identical titles.
  return `${base}-${id}`.slice(0, 255);
}

/**
 * Start one.
 *
 * Omitting `title` asks for a SCRAP document: it is named by date and seeded
 * empty, because naming a document is a decision about a thing you have not
 * written yet and it is the step at which most notes never get taken.
 *
 * The Nextcloud file is created FIRST and the row only written if that
 * succeeded, so a failed upload leaves no document listed that cannot be
 * opened. The reverse order would be cheaper and would lie.
 */
export async function createOrgDocument(
  orgId: string,
  input: {
    title?: string;
    authorId?: string;
    authorName?: string | null;
    ideaId?: string | null;
  } = {}
): Promise<OrgDocument | null> {
  const title = input.title?.trim().slice(0, 200) || scrapTitle();

  // The thread id IS the document id, as it has been since migration 133 made
  // the legacy ids the primary keys. Minted before the file so the filename
  // and the row agree.
  const documentId = nanoid();

  const created = await createCollaborativeDocument(
    orgId,
    title,
    documentId,
    // The seed is passed for EVERY document, never left to default.
    // `createCollaborativeDocument`'s fallback body is a meeting agenda
    // ("Agenda / Discussion Points / Action Items") from its first caller,
    // which a proposal or a shared list opens to and has to delete.
    `# ${title}\n\n`
  );
  if (!created) return null;

  // author_id is NOT NULL. A caller that did not say who is writing falls back
  // to the org's owner, then anyone who has authored for it — the same chain
  // migration 133 used for the backfill, and for the same reason: losing the
  // document over a missing name would be the worse outcome.
  const authorId =
    input.authorId ??
    (
      await db<Array<{ user_id: string }>>`
        SELECT user_id FROM user_organizations
        WHERE org_id = ${orgId} AND role IN ('owner', 'guide')
        ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END
        LIMIT 1
      `
    )[0]?.user_id;

  if (!authorId) {
    console.error(`[org-documents] create(${orgId}): no author available`);
    return null;
  }

  const [row] = await db<DocRow[]>`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug,
      status, visibility,
      document_url, nextcloud_doc_url, nextcloud_file_id, metadata
    ) VALUES (
      ${documentId}, ${orgId}, ${authorId}, ${DOCUMENT_KIND},
      ${title}, ${slugFor(title, documentId)},
      'published',
      -- Never PUBLIC: the share this row carries grants edit and delete to
      -- anyone holding it. See migration 133.
      'ORGANIZATION',
      ${created.url}, ${created.editUrl}, ${created.fileId ?? null},
      ${db.json({ documentPath: created.path } as never)}
    )
    RETURNING id, title, document_url AS url, nextcloud_doc_url AS edit_url,
              metadata->>'documentPath' AS path, created_at,
              NULL::text AS author_name,
              NULL::text AS idea_id, NULL::text AS idea_title
  `;

  // The name is read back rather than echoed from the input, so a document
  // reads the same the moment it is made as it does in the next list. The
  // caller's `authorName` is only a hint for when the row has no display name
  // of its own.
  const [author] = await db<Array<{ display_name: string | null }>>`
    SELECT display_name FROM users WHERE id = ${authorId}
  `;
  row.author_name = author?.display_name ?? input.authorName ?? null;

  const document = toDocument(row);

  if (input.ideaId) {
    await assignOrgDocument(orgId, documentId, input.ideaId);
    document.ideaId = input.ideaId;
  }

  return document;
}

/**
 * Take a document off the group's list.
 *
 * ARCHIVED, not deleted, and the file in Nextcloud is not touched at all. That
 * asymmetry is the whole safety of this operation — the list is the thing
 * members see and act on, so removing it from the list is what "delete" means
 * to them, while the words someone wrote survive in
 * `EAC_Network/<org>/Media/Documents/` for anyone who goes looking.
 *
 * Archiving rather than DELETE also keeps every `thread_gathers` edge pointing
 * at it, which a delete would cascade away: the record that last month's
 * meeting produced this document should outlive the document being tidied off
 * a list. Nothing renders it, because every read here and in gather.ts
 * requires `status = 'published'`.
 */
export async function deleteOrgDocument(
  orgId: string,
  documentId: string
): Promise<boolean> {
  try {
    const rows = await db`
      UPDATE threads
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${documentId}
        AND org_id = ${orgId}
        AND kind = ${DOCUMENT_KIND}
        AND status = 'published'
      RETURNING id
    `;
    return rows.length > 0;
  } catch (error) {
    console.error(`[org-documents] delete(${orgId}, ${documentId}):`, error);
    return false;
  }
}

/**
 * Say which idea a document belongs to, or pass null to unassign.
 *
 * This used to patch a string field inside a JSON array, read-modify-write,
 * with the losing half of a simultaneous reassign silently discarded. It is
 * now what it always was underneath: an edge from the idea to the document,
 * in `thread_gathers`.
 *
 * One idea at a time — the previous assignment is cleared in the same
 * transaction — because the field it replaces held exactly one value and the
 * documents surface renders it as a single-select.
 */
export async function assignOrgDocument(
  orgId: string,
  documentId: string,
  ideaId: string | null
): Promise<boolean> {
  try {
    const [doc] = await db<Array<{ id: string }>>`
      SELECT id FROM threads
      WHERE id = ${documentId} AND org_id = ${orgId} AND kind = ${DOCUMENT_KIND}
    `;
    if (!doc) return false;

    await db.begin(async (tx) => {
      // Only edges FROM an idea are cleared. A meeting that gathered this
      // document is a different statement and must survive being reassigned.
      await tx`
        DELETE FROM thread_gathers g
        USING threads i
        WHERE g.target_thread_id = ${documentId}
          AND g.relation = 'gathers'
          AND i.id = g.thread_id
          AND i.kind = 'idea'
      `;
      if (ideaId) {
        await tx`
          INSERT INTO thread_gathers (id, thread_id, target_type, target_thread_id, relation)
          SELECT ${nanoid()}, ${ideaId}, 'thread', ${documentId}, 'gathers'
          WHERE EXISTS (
            SELECT 1 FROM threads t
            WHERE t.id = ${ideaId} AND t.org_id = ${orgId} AND t.kind = 'idea'
          )
          ON CONFLICT DO NOTHING
        `;
      }
    });
    return true;
  } catch (error) {
    console.error(`[org-documents] assign(${orgId}, ${documentId}):`, error);
    return false;
  }
}
