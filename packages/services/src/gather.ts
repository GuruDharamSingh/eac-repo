import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { listOrgDocuments } from './org-documents';
import { getOrgDeckBoard } from './org-deck';
import { createOrgFolder, listOrgFiles, resolveOrgPath } from './org-storage';

// ============================================================================
// What a thread holds — the read and write halves of `thread_gathers`.
//
// A group's week produces a meeting, the document written in it, the terms
// defined out of that document, the discussion that followed and a couple of
// board cards. Those were five surfaces with nothing joining them. This is
// the join: the meeting thread GATHERS the rest, and its page shows them as
// one occasion.
//
// There is no container object and no new `kind`. The occasion already exists
// as a row, so the thread IS the page — which is also what keeps the forum the
// single index of everything, since a gathering is a forum topic for free.
//
// See migration 131 for why this is not `thread_references` (that table is
// DERIVED from prose and wiped on every save; this one is deliberate) and why
// the target is polymorphic (Deck cards and living documents are not rows in
// this database yet, and this edge is written to survive them becoming rows).
// ============================================================================

export type GatherRelation = 'gathers' | 'produced' | 'talk' | 'cites';

export type GatherTargetType =
  | 'thread'
  | 'document'
  | 'deck_card'
  | 'deck_label'
  | 'file'
  | 'quote'
  | 'link';

/** Who is looking. Same shape as `ForumViewer`, so a route passes one object. */
export interface GatherViewer {
  userId: string | null;
  /** org_id → role, from user_organizations. Empty when signed out. */
  roles: Record<string, string>;
  isGlobalAdmin?: boolean;
}

export const GATHER_ANONYMOUS: GatherViewer = { userId: null, roles: {} };

/**
 * Where a thread's dropped files live: `<org>/Gatherings/<threadId>/`.
 *
 * Attachment by FOLDER rather than by edge, and the difference is the point.
 * An edge is a decision somebody made; a folder is a place you put things, and
 * "drop it in and it shows up" is the right affordance for files. Nothing is
 * written to the database for these — the folder listing IS the record, so
 * adding, renaming and removing a file all work from Nextcloud directly, with
 * no way for an index to drift from what is actually there.
 *
 * A folder cannot hold a forum topic or a definition, which is why it is the
 * ingest and not the model.
 */
export function gatheringFolder(orgId: string, threadId: string): string {
  // Thread ids are nanoids; anything else is a caller bug, and resolveOrgPath
  // would reject a traversal anyway.
  return resolveOrgPath(orgId, `Gatherings/${threadId}`);
}

/**
 * Make the drop folder, so a host can offer an upload target for one thread.
 *
 * Both levels, in order: MKCOL does not create intermediate collections, and
 * `Gatherings/` does not exist in an org's tree until the first thread needs
 * it. Creating only the leaf silently returns false against a fresh org and
 * every later upload fails with nothing to point at.
 *
 * Idempotent — an existing folder reports false from MKCOL (405), which is not
 * an error here, so success is judged by the leaf existing afterwards rather
 * than by either call's return.
 */
export async function ensureGatheringFolder(
  orgId: string,
  threadId: string
): Promise<boolean> {
  await createOrgFolder(orgId, 'Gatherings');
  await createOrgFolder(orgId, `Gatherings/${threadId}`);
  // listOrgFiles answers [] for a missing folder and never throws, so this is
  // the cheapest honest check that the path is now there.
  const parent = await listOrgFiles(orgId, 'Gatherings');
  return parent.some((e) => e.isFolder && e.name === threadId);
}

/**
 * A person's full role map, for the visibility predicate.
 *
 * Every host needs this and none of it is host-specific, so it lives here
 * rather than as a third copy in a third `lib/gather.ts`. A hub's own viewer
 * answers one question — are you in THIS org — but a gathering legitimately
 * holds rows from another: every definition is a `wiki_page` under org
 * `elkdonis` (migration 122). Attaching a term to a meeting would be refused
 * as invisible if only the local role were known.
 */
export async function gatherViewerFor(
  userId: string | null,
  opts: { isGlobalAdmin?: boolean } = {}
): Promise<GatherViewer> {
  if (!userId) return GATHER_ANONYMOUS;
  const rows = await db<Array<{ org_id: string; role: string }>>`
    SELECT org_id, role FROM user_organizations WHERE user_id = ${userId}
  `;
  const roles: Record<string, string> = {};
  for (const row of rows) roles[row.org_id] = row.role;
  return { userId, roles, isGlobalAdmin: opts.isGlobalAdmin };
}

export interface GatheredItem {
  /** The edge's id — what `ungather` takes, not the target's id. */
  id: string;
  relation: GatherRelation;
  targetType: GatherTargetType;
  position: number;
  addedAt: string;
  addedByName: string | null;

  /** The row's own label when it has one, else the target's title. */
  title: string;
  /** A line under it: the kind, the feed, the stack, the date. */
  subtitle: string | null;
  /**
   * Where it opens. NULL is a legitimate answer and the UI must handle it —
   * a document whose link is withheld from this viewer still LISTS, because
   * knowing the group wrote minutes is not the same as being able to open
   * them. See `documentLinks` below.
   */
  href: string | null;
  /** Opens outside the app (Nextcloud, Deck, an arbitrary link). */
  external: boolean;

  // Thread targets only.
  threadId: string | null;
  kind: string | null;
  slug: string | null;
  orgId: string | null;
}

export interface GatheredBy {
  /** The host thread that gathered this one. */
  id: string;
  slug: string;
  title: string;
  kind: string;
  orgId: string;
  /** Carried because most hosts route by feed; without it there is no URL. */
  section: string | null;
  relation: GatherRelation;
  addedAt: string;
}

// ── Reading ─────────────────────────────────────────────────────────────────

interface EdgeRow {
  id: string;
  target_type: GatherTargetType;
  target_thread_id: string | null;
  target_ref: string | null;
  relation: GatherRelation;
  label: string | null;
  position: number;
  added_at: Date | string;
  added_by_name: string | null;
}

/**
 * Can this viewer see this thread?
 *
 * Deliberately NOT `forum.visibleTo`. That predicate excludes `wiki_page` for
 * every viewer including admins, because a wiki page is never a forum topic —
 * but a definition gathered onto a meeting is the single most important thing
 * this feature shows, so excluding it here would empty the band of its point.
 *
 * Wiki pages are INVITE_ONLY by migration 123 and readable by any signed-in
 * user through the wiki, so that is exactly the rule applied to them: signed
 * in, yes; signed out, no.
 */
export function visibleToGatherer(viewer: GatherViewer) {
  if (viewer.isGlobalAdmin) return db`t.status = 'published'`;
  const orgs = Object.keys(viewer.roles);
  const uid = viewer.userId;
  return db`
    t.status = 'published' AND (
      t.visibility = 'PUBLIC'
      OR (t.visibility = 'ORGANIZATION' AND t.org_id = ANY(${orgs}))
      OR (t.kind = 'wiki_page' AND ${uid}::uuid IS NOT NULL)
      OR (${uid}::uuid IS NOT NULL AND t.author_id = ${uid}::uuid)
    )
  `;
}

export interface GatheredOptions {
  viewer?: GatherViewer;
  /**
   * The org whose documents and Deck board may be resolved. Without it,
   * `document`, `deck_card` and `deck_label` rows list by their stored label
   * alone, since there is nowhere to look them up.
   */
  orgId?: string;
  /**
   * Whether this viewer may be handed a living document's URL.
   *
   * DEFAULTS TO FALSE, and that default is the security of this function.
   * `createOrgDocument` shares each document by a PUBLIC WRITABLE Nextcloud
   * link — an unauthenticated URL that grants edit and delete to anyone
   * holding it. Every existing caller hands it out only past a membership
   * guard. A gathering page can be PUBLIC, so the thread's own visibility is
   * the wrong gate entirely: a public meeting page that embedded that link
   * would publish write access to the group's minutes. The caller must assert
   * membership explicitly, which is why this cannot be inferred here.
   */
  documentLinks?: boolean;
  /**
   * Resolve Deck targets against the org's board. Off by default because it
   * costs a Nextcloud round trip on every thread read; a page that shows the
   * board turns it on.
   */
  withDeck?: boolean;
  /**
   * Also list whatever has been dropped in this thread's folder. MEMBERS
   * ONLY — the org tree is served through a host's /api/media route behind a
   * membership check, so handing the paths to anyone else would advertise
   * files they cannot fetch. See `gatheringFolder`.
   */
  folderFiles?: boolean;
  /**
   * Where a thread lives on the host site.
   *
   * `section` is passed because most hosts route by feed (`/{section}/{slug}`)
   * rather than by id, and a thread with no section — a document, a wiki page —
   * has no such URL. Returning null is a legitimate answer: the row lists
   * without opening, which is right for a definition on a site that has no
   * wiki to open it in.
   */
  hrefFor?: (t: {
    orgId: string;
    kind: string;
    slug: string;
    id: string;
    section: string | null;
  }) => string | null;
}

/**
 * Everything one thread holds, in the order someone put it in.
 *
 * Targets the viewer may not see are DROPPED rather than shown as withheld:
 * a row reading "something you cannot open" on a public page would confirm
 * that a private thread exists and roughly what it is about. A target that
 * has been deleted drops the same way, so the two are indistinguishable from
 * outside, which is the point.
 */
export async function getGathered(
  threadId: string,
  options: GatheredOptions = {}
): Promise<GatheredItem[]> {
  const viewer = options.viewer ?? GATHER_ANONYMOUS;

  const edges = await db<EdgeRow[]>`
    SELECT g.id, g.target_type, g.target_thread_id, g.target_ref,
           g.relation, g.label, g.position, g.added_at,
           u.display_name AS added_by_name
    FROM thread_gathers g
    LEFT JOIN users u ON u.id = g.added_by
    WHERE g.thread_id = ${threadId}
    ORDER BY g.position ASC, g.added_at ASC
  `;
  if (edges.length === 0) return [];

  // ── resolve thread targets ────────────────────────────────────────────────
  const threadIds = edges
    .map((e) => e.target_thread_id)
    .filter((id): id is string => Boolean(id));

  type TargetRow = {
    id: string;
    slug: string;
    title: string;
    kind: string;
    org_id: string;
    section: string | null;
    /** Only ever set on kind='document'. Withheld below unless asked for. */
    doc_url: string | null;
  };
  const threadsById = new Map<string, TargetRow>();

  if (threadIds.length > 0) {
    const rows = await db<TargetRow[]>`
      SELECT t.id, t.slug, t.title, t.kind, t.org_id, t.section,
             CASE WHEN t.kind = 'document' THEN t.nextcloud_doc_url END AS doc_url
      FROM threads t
      WHERE t.id = ANY(${threadIds}) AND ${visibleToGatherer(viewer)}
    `;
    for (const row of rows) threadsById.set(row.id, row);
  }

  // ── resolve external targets, each at most once ───────────────────────────
  const wants = (type: GatherTargetType) => edges.some((e) => e.target_type === type);

  const documents =
    options.orgId && wants('document')
      ? await listOrgDocuments(options.orgId).catch(() => [])
      : [];

  const board =
    options.orgId && options.withDeck && (wants('deck_card') || wants('deck_label'))
      ? await getOrgDeckBoard(options.orgId).catch(() => null)
      : null;

  const quoteIds = edges.filter((e) => e.target_type === 'quote').map((e) => e.target_ref!);
  const quotes = quoteIds.length
    ? await db<Array<{ id: string; body: string; attribution: string | null }>>`
        SELECT id::text, body, attribution FROM quotes WHERE id = ANY(${quoteIds}::uuid[])
      `.catch(() => [])
    : [];

  const out: GatheredItem[] = [];

  for (const edge of edges) {
    const base = {
      id: edge.id,
      relation: edge.relation,
      targetType: edge.target_type,
      position: edge.position,
      addedAt: iso(edge.added_at),
      addedByName: edge.added_by_name,
    };

    if (edge.target_type === 'thread') {
      const t = edge.target_thread_id ? threadsById.get(edge.target_thread_id) : null;
      if (!t) continue; // gone, or not for this viewer

      // A document became a thread in migration 133, but the thing that opens
      // it did not change: a public WRITABLE Nextcloud share. Being a row now
      // does not make it safe to hand over, so it keeps its own gate rather
      // than going through `hrefFor` with everything else. Being visible and
      // being openable stayed two separate questions on purpose.
      const isDocument = t.kind === 'document';
      const href = isDocument
        ? options.documentLinks
          ? t.doc_url
          : null
        : (options.hrefFor?.({
            orgId: t.org_id,
            kind: t.kind,
            slug: t.slug,
            id: t.id,
            section: t.section,
          }) ?? null);

      out.push({
        ...base,
        title: edge.label ?? t.title,
        subtitle: KIND_LABELS[t.kind] ?? t.kind,
        href,
        // A document opens in Nextcloud; every other thread is a page here.
        external: isDocument,
        threadId: t.id,
        kind: t.kind,
        slug: t.slug,
        orgId: t.org_id,
      });
      continue;
    }

    const external = { ...base, threadId: null, kind: null, slug: null, orgId: null, external: true };

    switch (edge.target_type) {
      case 'document': {
        // VESTIGIAL since migration 133, which re-pointed every one of these
        // at the real row. Kept because the target type is still legal and an
        // edge written before the migration ran on another database would
        // otherwise render as nothing at all.
        const doc = documents.find((d) => d.id === edge.target_ref);
        // An unresolvable document still lists under its stored label, because
        // the edge is evidence that the group wrote one even when this process
        // cannot reach the index.
        if (!doc && !edge.label) continue;
        out.push({
          ...external,
          title: edge.label ?? doc!.title,
          subtitle: 'Shared document',
          // Withheld unless the caller has asserted membership. See the
          // `documentLinks` note above — this link grants write access.
          href: options.documentLinks && doc ? doc.editUrl : null,
        });
        break;
      }

      case 'deck_card': {
        // `cards` is ABSENT, not empty, on a stack with none — see DeckStack
        // in packages/nextcloud/src/deck.ts.
        const card = board?.stacks
          .flatMap((s) => (s.cards ?? []).map((c) => ({ card: c, stack: s })))
          .find((x) => String(x.card.id) === edge.target_ref);
        if (!card && !edge.label) continue;
        out.push({
          ...external,
          title: edge.label ?? card!.card.title,
          subtitle: card ? `Board · ${card.stack.title}` : 'Board card',
          href: null,
        });
        break;
      }

      case 'deck_label': {
        // A whole slice of the board rather than one card: the gathering names
        // a label and the page shows whatever currently carries it, so the
        // board stays the source of truth and no per-card row is written.
        const matching = board?.stacks.flatMap((s) =>
          (s.cards ?? []).filter((c) =>
            (c.labels ?? []).some((l) => String(l.id) === edge.target_ref)
          )
        );
        out.push({
          ...external,
          title: edge.label ?? 'Board cards',
          subtitle: matching ? `${matching.length} on the board` : 'Board',
          href: null,
        });
        break;
      }

      case 'quote': {
        const quote = quotes.find((q) => q.id === edge.target_ref);
        if (!quote) continue;
        out.push({
          ...external,
          title: edge.label ?? quote.body,
          subtitle: quote.attribution,
          href: null,
          external: false,
        });
        break;
      }

      case 'file': {
        out.push({
          ...external,
          title: edge.label ?? basename(edge.target_ref ?? ''),
          subtitle: 'File',
          href: null,
        });
        break;
      }

      case 'link': {
        const url = edge.target_ref ?? '';
        out.push({
          ...external,
          title: edge.label ?? url,
          subtitle: hostOf(url),
          href: url,
        });
        break;
      }
    }
  }

  // ── dropped files ────────────────────────────────────────────────────────
  // Appended after the curated rows, always, because a hand-arranged order is
  // a statement and files arriving later should not push into the middle of
  // it. They carry no edge id, so theirs is derived from the path — stable
  // across reloads, which is all the UI needs it for.
  if (options.folderFiles && options.orgId) {
    const files = await listOrgFiles(options.orgId, `Gatherings/${threadId}`).catch(() => []);
    let position = out.length;
    for (const file of files) {
      if (file.isFolder) continue;
      out.push({
        id: `file:${file.path}`,
        relation: 'gathers',
        targetType: 'file',
        position: position++,
        addedAt: file.lastModified ? iso(file.lastModified) : '',
        addedByName: null,
        title: file.name,
        subtitle: 'Dropped in',
        // davList already builds the host's own proxy URL for this.
        href: file.url,
        external: false,
        threadId: null,
        kind: null,
        slug: null,
        orgId: options.orgId,
      });
    }
  }

  return out;
}

/**
 * The reverse read: which threads gathered THIS one.
 *
 * This is the provenance half, and it is the same edge read from the other
 * end — the term page answering "every occasion I was defined at", the
 * document answering "written at". Follows `getWikiBacklinks`, which has been
 * doing exactly this over `thread_references` since migration 031.
 */
export async function getGatheredBy(
  threadId: string,
  options: { viewer?: GatherViewer } = {}
): Promise<GatheredBy[]> {
  const viewer = options.viewer ?? GATHER_ANONYMOUS;
  const rows = await db<
    Array<{
      id: string;
      slug: string;
      title: string;
      kind: string;
      org_id: string;
      section: string | null;
      relation: GatherRelation;
      added_at: Date | string;
    }>
  >`
    SELECT t.id, t.slug, t.title, t.kind, t.org_id, t.section, g.relation, g.added_at
    FROM thread_gathers g
    JOIN threads t ON t.id = g.thread_id
    WHERE g.target_thread_id = ${threadId} AND ${visibleToGatherer(viewer)}
    ORDER BY g.added_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    kind: r.kind,
    orgId: r.org_id,
    section: r.section,
    relation: r.relation,
    addedAt: iso(r.added_at),
  }));
}

/**
 * Everything a thread holds, in the three shapes a surface renders.
 *
 * One call because every host needs all three at once and because the
 * `documentLinks` decision — the security-critical one on this whole feature —
 * should be made in exactly one place rather than restated at each call site.
 * It is derived here from `isMember` and from nothing else: not from the
 * thread's visibility, not from whether the viewer is signed in, and not from
 * whether the page happens to be a hub page. A living document's share is a
 * public WRITABLE Nextcloud link, and org membership is the only thing that
 * has ever gated it.
 */
export interface Gathering {
  gathered: GatheredItem[];
  gatheredBy: Array<GatheredBy & { href: string | null }>;
  terms: Array<ReferencedTerm & { href: string | null }>;
}

export async function getGathering(
  threadId: string,
  opts: {
    /** Null when signed out. */
    viewerUserId: string | null;
    /** A role in the org this thread belongs to. Gates document links. */
    isMember: boolean;
    orgId: string;
    isGlobalAdmin?: boolean;
    hrefFor: GatheredOptions['hrefFor'];
    /** Where this site keeps the wiki. Omit on a site that has none. */
    termHref?: (slug: string) => string | null;
    /** Resolve Deck targets. Costs a Nextcloud round trip. */
    withDeck?: boolean;
    /**
     * List the thread's drop folder too. Costs a PROPFIND, and is gated on
     * membership by the same `isMember` that gates document links — the org
     * tree is members-only however a file got into it.
     */
    withFolder?: boolean;
  }
): Promise<Gathering> {
  const viewer = await gatherViewerFor(opts.viewerUserId, {
    isGlobalAdmin: opts.isGlobalAdmin,
  });

  // Independently caught: a Nextcloud timeout resolving a board should cost
  // the band, not the terms beside it.
  const [gathered, terms, gatheredBy] = await Promise.all([
    getGathered(threadId, {
      viewer,
      orgId: opts.orgId,
      documentLinks: opts.isMember,
      withDeck: opts.withDeck,
      folderFiles: opts.withFolder && opts.isMember,
      hrefFor: opts.hrefFor,
    }).catch(() => [] as GatheredItem[]),
    getReferencedTerms(threadId, { viewer }).catch(() => [] as ReferencedTerm[]),
    getGatheredBy(threadId, { viewer }).catch(() => [] as GatheredBy[]),
  ]);

  return {
    gathered,
    terms: terms.map((t) => ({ ...t, href: opts.termHref?.(t.slug) ?? null })),
    gatheredBy: gatheredBy.map((g) => ({
      ...g,
      href:
        opts.hrefFor?.({
          orgId: g.orgId,
          kind: g.kind,
          slug: g.slug,
          id: g.id,
          section: g.section,
        }) ?? null,
    })),
  };
}

export interface ReferencedTerm {
  id: string;
  slug: string;
  title: string;
}

/**
 * The terms defined out of this thread.
 *
 * No new data: `defineTerm` has been writing this edge into
 * `thread_references` since the dictionary was built (see wiki.ts), it was
 * simply never displayed anywhere but the wiki. Derived from the prose rather
 * than curated, which is why it is a separate read from `getGathered` and
 * renders as its own band.
 *
 * Signed-out viewers get nothing: wiki pages are INVITE_ONLY and the titles
 * alone would leak the vocabulary of a private group.
 */
export async function getReferencedTerms(
  threadId: string,
  options: { viewer?: GatherViewer } = {}
): Promise<ReferencedTerm[]> {
  const viewer = options.viewer ?? GATHER_ANONYMOUS;
  if (!viewer.userId && !viewer.isGlobalAdmin) return [];
  return db<ReferencedTerm[]>`
    SELECT t.id, t.slug, t.title
    FROM thread_references r
    JOIN threads t ON t.id = r.references_thread_id
    WHERE r.thread_id = ${threadId}
      AND t.kind = 'wiki_page'
      AND t.status = 'published'
    ORDER BY t.title ASC
  `;
}

// ── Writing ─────────────────────────────────────────────────────────────────

export interface GatherInput {
  targetType: GatherTargetType;
  /** Required when `targetType` is 'thread'. */
  targetThreadId?: string | null;
  /** Required for every other type. */
  targetRef?: string | null;
  relation?: GatherRelation;
  label?: string | null;
  addedBy?: string | null;
}

export class GatherError extends Error {}

/**
 * Attach something to a thread.
 *
 * Authorisation belongs to the caller — the route knows whether this viewer
 * may edit this thread — but VISIBILITY is checked here for thread targets,
 * because gathering is the one operation that can pull a row from one org onto
 * a page in another. Someone may only attach a thread they can already see.
 *
 * Idempotent: attaching the same target twice under the same relation returns
 * the existing edge rather than failing, so a double-submit is harmless.
 */
export async function gatherOnto(
  threadId: string,
  input: GatherInput,
  options: { viewer?: GatherViewer } = {}
): Promise<string> {
  const relation: GatherRelation = input.relation ?? 'gathers';
  const isThread = input.targetType === 'thread';

  if (isThread && !input.targetThreadId) {
    throw new GatherError('A thread target needs targetThreadId');
  }
  if (!isThread && !input.targetRef) {
    throw new GatherError(`A ${input.targetType} target needs targetRef`);
  }
  if (isThread && input.targetThreadId === threadId) {
    throw new GatherError('A thread cannot gather itself');
  }

  const [host] = await db<Array<{ id: string }>>`
    SELECT id FROM threads WHERE id = ${threadId}
  `;
  if (!host) throw new GatherError('No such thread');

  if (isThread) {
    const viewer = options.viewer ?? GATHER_ANONYMOUS;
    const [target] = await db<Array<{ id: string }>>`
      SELECT t.id FROM threads t
      WHERE t.id = ${input.targetThreadId} AND ${visibleToGatherer(viewer)}
    `;
    // Same wording for "gone" and "not yours to see", as everywhere else.
    if (!target) throw new GatherError('No such thread');
  }

  const id = nanoid();
  // Appended, not inserted: a new attachment goes to the end of whatever
  // order someone has arranged, never silently to the top.
  const [row] = await db<Array<{ id: string }>>`
    INSERT INTO thread_gathers
      (id, thread_id, target_type, target_thread_id, target_ref, relation, label, position, added_by)
    SELECT ${id}, ${threadId}, ${input.targetType},
           ${isThread ? input.targetThreadId! : null},
           ${isThread ? null : input.targetRef!},
           ${relation}, ${input.label ?? null},
           COALESCE((SELECT MAX(position) + 1 FROM thread_gathers WHERE thread_id = ${threadId}), 0),
           ${input.addedBy ?? null}
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  if (row) return row.id;

  // ON CONFLICT DO NOTHING covers both unique indexes; recover whichever one
  // matched so the caller gets an edge id either way. Two shapes of key, so
  // two reads rather than one clause that has to branch inside SQL.
  const [existing] = isThread
    ? await db<Array<{ id: string }>>`
        SELECT id FROM thread_gathers
        WHERE thread_id = ${threadId}
          AND relation = ${relation}
          AND target_thread_id = ${input.targetThreadId!}
      `
    : await db<Array<{ id: string }>>`
        SELECT id FROM thread_gathers
        WHERE thread_id = ${threadId}
          AND relation = ${relation}
          AND target_type = ${input.targetType}
          AND target_ref = ${input.targetRef!}
      `;
  if (existing) return existing.id;
  throw new GatherError('Could not attach');
}

/** Take one attachment off. The target itself is never touched. */
export async function ungather(threadId: string, edgeId: string): Promise<boolean> {
  const rows = await db`
    DELETE FROM thread_gathers
    WHERE id = ${edgeId} AND thread_id = ${threadId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Rearrange. Ids not named keep their relative order after the ones that are,
 * so a partial list from a drag is safe.
 */
export async function reorderGathered(threadId: string, edgeIds: string[]): Promise<void> {
  if (edgeIds.length === 0) return;
  await db.begin(async (tx) => {
    for (let i = 0; i < edgeIds.length; i++) {
      await tx`
        UPDATE thread_gathers SET position = ${i}
        WHERE id = ${edgeIds[i]} AND thread_id = ${threadId}
      `;
    }
    await tx`
      UPDATE thread_gathers SET position = position + ${edgeIds.length}
      WHERE thread_id = ${threadId} AND id <> ALL(${edgeIds})
    `;
  });
}

// ── small helpers ───────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  post: 'Writing',
  writing: 'Writing',
  meeting: 'Meeting',
  event: 'Event',
  workshop: 'Workshop',
  wiki_page: 'Definition',
  document: 'Shared document',
  idea: 'Idea',
  service: 'Service',
  product: 'Product',
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
