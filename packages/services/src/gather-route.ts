import { db } from '@elkdonis/db';
import {
  GatherError,
  gatherOnto,
  getGathered,
  gatherViewerFor,
  reorderGathered,
  ungather,
  type GatherRelation,
  type GatherTargetType,
} from './gather';
import { getOrgDeckBoard } from './org-deck';

// ============================================================================
// The gather API, as one handler set every host mounts.
//
// Nothing in here is site-specific except the org id, how a host names its
// viewer, and where a thread lives on it — so those three are arguments and
// the rest is written once. The alternative was a third near-identical copy of
// a 250-line route, which is how this repo already ended up with fifteen media
// readers and eleven upload routes.
//
// Framework-agnostic on purpose: plain `Request` in, plain `Response` out. A
// Next route file re-exports these four and adds nothing.
//
//   export const { GET, POST, DELETE, PATCH } = createGatherRoutes({ … });
//
// ── The two gates ──────────────────────────────────────────────────────────
//
// MEMBERSHIP is the floor for every verb, the read included, because this
// route resolves living-document links and those shares are public and
// writable. The band on a public page is served by the host's own thread
// route instead, which withholds them.
//
// EDITING is `canEdit`. Gathering decides what an occasion IS on a page every
// member reads, so it is the same gate as publishing — not the looser one that
// lets any member start a document or draw on the whiteboard.
// ============================================================================

const RELATIONS: GatherRelation[] = ['gathers', 'produced', 'talk', 'cites'];
const TARGET_TYPES: GatherTargetType[] = [
  'thread',
  'document',
  'deck_card',
  'deck_label',
  'file',
  'quote',
  'link',
];

/** What a candidate search offers, and exactly what `attach` takes back. */
export interface GatherCandidate {
  targetType: GatherTargetType;
  targetThreadId?: string | null;
  targetRef?: string | null;
  title: string;
  subtitle?: string | null;
}

export interface GatherRouteViewer {
  userId: string;
  /** Owner or guide: may change what a thread holds. */
  canEdit: boolean;
  isGlobalAdmin?: boolean;
}

export interface GatherRouteOptions {
  orgId: string;
  /** The host's membership check. Null means "not a member of this org". */
  viewer: () => Promise<GatherRouteViewer | null>;
  /** Where a thread lives on this site. */
  hrefFor: (t: {
    orgId: string;
    kind: string;
    slug: string;
    id: string;
    section: string | null;
  }) => string | null;
  /**
   * Search the org's Deck board for cards to attach. Off by default: it costs
   * a Nextcloud round trip, and a host without a board should not pay for one.
   */
  deck?: boolean;
  /** 403 body. Hosts differ on wording; the status does not. */
  forbidden?: (message: string) => Response;
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * One Next route handler.
 *
 * Spelled out rather than inferred: without an explicit annotation the
 * declaration build cannot name the global `Response` without reaching into
 * `undici-types` inside .pnpm, and fails as non-portable (TS2742).
 */
export type GatherRouteHandler = (request: Request, ctx: Ctx) => Promise<Response>;

export interface GatherRouteHandlers {
  GET: GatherRouteHandler;
  POST: GatherRouteHandler;
  DELETE: GatherRouteHandler;
  PATCH: GatherRouteHandler;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body as Record<string, unknown>, { status });
}

export function createGatherRoutes(opts: GatherRouteOptions): GatherRouteHandlers {
  const deny = opts.forbidden ?? ((message: string) => json({ error: message }, 403));

  /** GET — what is attached, or `?q=` to search for something to attach. */
  async function GET(request: Request, ctx: Ctx) {
    const viewer = await opts.viewer();
    if (!viewer) return deny('Members only');
    const { id } = await ctx.params;

    const url = new URL(request.url);
    if (!url.searchParams.has('q')) {
      return json({
        gathered: await getGathered(id, {
          viewer: await gatherViewerFor(viewer.userId, {
            isGlobalAdmin: viewer.isGlobalAdmin,
          }),
          orgId: opts.orgId,
          // Safe here and only here: membership is already established, which
          // is the gate these links have always sat behind.
          documentLinks: true,
          withDeck: opts.deck,
          hrefFor: opts.hrefFor,
        }),
        canEdit: viewer.canEdit,
      });
    }

    return json({ candidates: await candidatesFor(id, url.searchParams.get('q')?.trim() ?? '') });
  }

  /** POST — attach one thing. */
  async function POST(request: Request, ctx: Ctx) {
    const viewer = await opts.viewer();
    if (!viewer) return deny('Members only');
    if (!viewer.canEdit) return deny('Only owners and guides can arrange this.');
    const { id } = await ctx.params;

    let payload: {
      targetType?: string;
      targetThreadId?: string;
      targetRef?: string;
      relation?: string;
      label?: string;
    };
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Expected JSON' }, 400);
    }

    const targetType = payload.targetType as GatherTargetType;
    if (!TARGET_TYPES.includes(targetType)) {
      return json({ error: 'Unknown target type' }, 400);
    }
    const relation = (payload.relation ?? 'gathers') as GatherRelation;
    if (!RELATIONS.includes(relation)) {
      return json({ error: 'Unknown relation' }, 400);
    }

    try {
      // Visibility of a THREAD target is checked inside `gatherOnto` against
      // the viewer, not here against the org: the network wiki is another
      // org's rows and is legitimately attachable.
      const edgeId = await gatherOnto(
        id,
        {
          targetType,
          targetThreadId: payload.targetThreadId ?? null,
          targetRef: payload.targetRef ?? null,
          relation,
          label: payload.label?.trim() || null,
          addedBy: viewer.userId,
        },
        {
          viewer: await gatherViewerFor(viewer.userId, {
            isGlobalAdmin: viewer.isGlobalAdmin,
          }),
        }
      );
      return json({ ok: true, id: edgeId });
    } catch (error) {
      if (error instanceof GatherError) return json({ error: error.message }, 400);
      throw error;
    }
  }

  /** DELETE `?edgeId=` — detach. The target itself is never touched. */
  async function DELETE(request: Request, ctx: Ctx) {
    const viewer = await opts.viewer();
    if (!viewer) return deny('Members only');
    if (!viewer.canEdit) return deny('Only owners and guides can arrange this.');
    const { id } = await ctx.params;

    const edgeId = new URL(request.url).searchParams.get('edgeId');
    if (!edgeId) return json({ error: 'edgeId required' }, 400);

    const removed = await ungather(id, edgeId);
    return removed ? json({ ok: true }) : json({ error: 'Not found' }, 404);
  }

  /** PATCH — the arrangement. */
  async function PATCH(request: Request, ctx: Ctx) {
    const viewer = await opts.viewer();
    if (!viewer) return deny('Members only');
    if (!viewer.canEdit) return deny('Only owners and guides can arrange this.');
    const { id } = await ctx.params;

    let payload: { edgeIds?: unknown };
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Expected JSON' }, 400);
    }
    const edgeIds = Array.isArray(payload.edgeIds)
      ? payload.edgeIds.filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [];
    if (edgeIds.length === 0) return json({ error: 'edgeIds required' }, 400);

    await reorderGathered(id, edgeIds);
    return json({ ok: true });
  }

  /**
   * What can be attached.
   *
   * Threads come from this org AND the network wiki, because a definition is
   * the most useful thing to attach to a meeting and the wiki is org
   * `elkdonis` (migration 122), not the host's. Living documents are threads
   * as of migration 133 and arrive in the same query — there is no separate
   * pass for them and no second way to address one.
   *
   * Nothing unpublished is offered: the band is read by every member and a
   * draft has not been decided on yet.
   */
  async function candidatesFor(hostId: string, q: string): Promise<GatherCandidate[]> {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

    const threads = await db<
      Array<{ id: string; title: string; kind: string; section: string | null }>
    >`
      SELECT t.id, t.title, t.kind, t.section
      FROM threads t
      WHERE t.id <> ${hostId}
        AND t.status = 'published'
        AND (t.org_id = ${opts.orgId} OR t.kind = 'wiki_page')
        AND (${q} = '' OR t.title ILIKE ${like})
      ORDER BY t.last_activity_at DESC NULLS LAST, t.created_at DESC
      LIMIT 12
    `;

    const out: GatherCandidate[] = threads.map((t) => ({
      targetType: 'thread' as const,
      targetThreadId: t.id,
      title: t.title,
      subtitle: CANDIDATE_LABEL[t.kind] ?? t.section ?? t.kind,
    }));

    // The board is a Nextcloud round trip, so it is searched only once someone
    // has actually typed something.
    if (q && opts.deck) {
      const board = await getOrgDeckBoard(opts.orgId).catch(() => null);
      for (const stack of board?.stacks ?? []) {
        // Deck OMITS `cards` on an empty stack rather than sending [] — see
        // the note on DeckStack in packages/nextcloud/src/deck.ts.
        for (const card of stack.cards ?? []) {
          if (!card.title.toLowerCase().includes(q.toLowerCase())) continue;
          out.push({
            targetType: 'deck_card',
            targetRef: String(card.id),
            title: card.title,
            subtitle: `Board · ${stack.title}`,
          });
        }
      }
    }

    return out.slice(0, 40);
  }

  return { GET, POST, DELETE, PATCH };
}

const CANDIDATE_LABEL: Record<string, string> = {
  wiki_page: 'Definition',
  document: 'Shared document',
};
