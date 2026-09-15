import { db } from '@elkdonis/db';
import { createCollaborativeDocument } from './nextcloud';
import { davGetText } from './dav';

// ============================================================================
// The group's living documents.
//
// Lifted out of apps/ifac, which was the only place in the repo where this
// tile was real — both template apps had it marked `available: false` and the
// shared catalogue offered it to nobody. Nothing here is IFAC-shaped; the org
// id is an argument.
//
// WHERE THE FILES LIVE. `EAC_Network/<orgId>/Media/Documents/`, the org's own
// folder, shared by a public WRITABLE link. That link is what makes a document
// collaborative for the majority of members, who have no Nextcloud account —
// and it is why the URL is only ever handed out behind a membership guard.
//
// This deployment has no Nextcloud Team folders (groupfolders): all fifteen
// orgs are plain Nextcloud users, so the org's own tree IS the team folder,
// and a document written here appears in exactly the place the org's media
// already does. Moving to real groupfolders later would change this file and
// nothing above it.
//
// WHY THE INDEX IS IN POSTGRES. The files are named `<timestamp>-<id>.md`, so
// a PROPFIND of the folder recovers dates but NOT titles. A title has to be
// recorded at creation or it is gone. `site_config` already held exactly this
// for a single document (inner-gathering's about-document), so a list needs no
// migration.
// ============================================================================

const KEY = 'living_documents';

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

function rowsOf(value: unknown): OrgDocument[] {
  if (!Array.isArray(value)) return [];
  return (value as OrgDocument[])
    .filter((d) => d && typeof d.editUrl === 'string')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
 */
export async function listOrgDocuments(
  orgId: string,
  opts: { withSnippets?: number } = {}
): Promise<OrgDocument[]> {
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${KEY}
    `;
    const docs = rowsOf(row?.value);

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

    // Titles for assigned ideas, resolved here so the caller gets one shape.
    const ideaIds = [...new Set(docs.map((d) => d.ideaId).filter(Boolean))] as string[];
    if (ideaIds.length) {
      const titles = await db<Array<{ id: string; title: string }>>`
        SELECT id, title FROM threads WHERE id = ANY(${ideaIds})
      `;
      const byId = new Map(titles.map((t) => [t.id, t.title]));
      for (const doc of docs) {
        if (doc.ideaId) doc.ideaTitle = byId.get(doc.ideaId) ?? null;
      }
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

/**
 * Start one.
 *
 * Omitting `title` asks for a SCRAP document: it is named by date and seeded
 * empty, because naming a document is a decision about a thing you have not
 * written yet and it is the step at which most notes never get taken.
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

  // A synthetic id is the honest thing to pass: `createCollaborativeDocument`
  // is meeting-shaped from its first caller and only ever puts this in the
  // filename.
  const documentId = `doc_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // The seed is passed for EVERY document, never left to default.
  // `createCollaborativeDocument`'s fallback body is a meeting agenda
  // ("Agenda / Discussion Points / Action Items") from its first caller, which
  // a proposal or a shared list opens to and has to delete before writing.
  const created = await createCollaborativeDocument(
    orgId,
    title,
    documentId,
    `# ${title}\n\n`
  );
  if (!created) return null;

  const entry: OrgDocument = {
    id: documentId,
    title,
    path: created.path,
    url: created.url,
    editUrl: created.editUrl,
    createdAt: new Date().toISOString(),
    createdBy: input.authorName ?? null,
    ideaId: input.ideaId ?? null,
  };

  // Append inside the statement rather than read-modify-write: two members
  // starting a document at once would otherwise have one silently overwrite
  // the other's entry.
  await db`
    INSERT INTO site_config (org_id, key, value)
    VALUES (${orgId}, ${KEY}, ${db.json([entry] as never)})
    ON CONFLICT (org_id, key) DO UPDATE
      SET value = COALESCE(site_config.value, '[]'::jsonb) || ${db.json([entry] as never)},
          updated_at = NOW()
  `;

  return entry;
}

/**
 * Say which idea a document belongs to, or pass null to unassign.
 *
 * Read-modify-write here, unlike the append above, because there is no jsonb
 * operator for "patch the element whose id matches" — and the losing half of a
 * simultaneous reassign is one member's dropdown, not a lost document.
 */
export async function assignOrgDocument(
  orgId: string,
  documentId: string,
  ideaId: string | null
): Promise<boolean> {
  try {
    const [row] = await db<Array<{ value: unknown }>>`
      SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${KEY}
    `;
    const docs = rowsOf(row?.value);
    if (!docs.some((d) => d.id === documentId)) return false;

    const next = docs.map((d) => (d.id === documentId ? { ...d, ideaId } : d));
    await db`
      UPDATE site_config SET value = ${db.json(next as never)}, updated_at = NOW()
      WHERE org_id = ${orgId} AND key = ${KEY}
    `;
    return true;
  } catch (error) {
    console.error(`[org-documents] assign(${orgId}, ${documentId}):`, error);
    return false;
  }
}
