/**
 * Four route handlers that every single-org site carried as a byte-identical
 * copy (2026-11-16): follow, quotes, the cycle-event write and the whiteboard.
 * Services owns the handler; the app passes its org and who the viewer is, the
 * same shape as `createGatherRoutes` and `uploadRoutes`.
 *
 *   // apps/<app>/src/app/api/center/follow/route.ts
 *   export const dynamic = "force-dynamic";
 *   export const { POST, DELETE } = followRoutes({
 *     orgId: siteConfig.orgId,
 *     who: async () => { const v = await getViewer(); return v ? { userId: v.userId, role: v.role } : null; },
 *   });
 */
import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import { followOrg, unfollowOrg } from './org-membership';
import { QUOTE_MAX_BODY, submitQuote } from './quotes';
import { getWhiteboard, saveWhiteboard, type WhiteboardScene } from './whiteboard';

type Role = string | null;

export interface SiteViewer {
  userId: string;
  /** the viewer's role in the site's org; null when they have none */
  role?: Role;
  canEdit?: boolean;
}

/** Follow / unfollow this org from /center. A follow is a `viewer` row; unfollow only ever removes one. */
export function followRoutes(opts: { orgId: string; who: () => Promise<SiteViewer | null> }) {
  async function POST() {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });
    if (viewer.role !== null && viewer.role !== undefined) return Response.json({ ok: true, role: viewer.role });
    await followOrg(viewer.userId, opts.orgId);
    return Response.json({ ok: true, role: 'viewer' });
  }
  async function DELETE() {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });
    if (viewer.role !== null && viewer.role !== undefined && viewer.role !== 'viewer') {
      return Response.json({ error: 'Members leave from the hub, not here' }, { status: 409 });
    }
    await unfollowOrg(viewer.userId, opts.orgId);
    return Response.json({ ok: true, role: null });
  }
  return { POST, DELETE };
}

/**
 * Add a line to the rotating band on /center. Anyone signed in; it lands
 * `pending` unless an owner or guide of this org adds it. Filed under THIS org.
 */
export function quoteRoutes(opts: { orgId: string; who: () => Promise<SiteViewer | null> }) {
  async function POST(request: Request) {
    const viewer = await opts.who();
    if (!viewer) return Response.json({ error: 'Sign in first' }, { status: 401 });

    const body = (await request.json().catch(() => null)) as {
      body?: unknown;
      attribution?: unknown;
      source?: unknown;
    } | null;
    if (!body || typeof body.body !== 'string') return Response.json({ error: 'Bad request' }, { status: 400 });
    if (body.body.trim().length < 8 || body.body.length > QUOTE_MAX_BODY * 2) {
      return Response.json({ error: 'A line needs a few more words than that.' }, { status: 422 });
    }

    const canPublish = viewer.role === 'owner' || viewer.role === 'guide';
    const quote = await submitQuote({
      orgId: opts.orgId,
      body: body.body,
      attribution: typeof body.attribution === 'string' ? body.attribution : null,
      source: typeof body.source === 'string' ? body.source : null,
      submittedBy: viewer.userId,
      status: canPublish ? 'published' : 'pending',
    });
    if (!quote) return Response.json({ error: 'Could not file that.' }, { status: 500 });
    return Response.json({ ok: true, status: quote.status });
  }
  return { POST };
}

/**
 * Confirm or cancel the current occurrence of a recurring gathering: an
 * append-only row in `thread_cycle_events`. `who` must resolve owner/guide only.
 */
export function cycleRoutes(opts: { orgId: string; who: () => Promise<{ userId: string } | null> }) {
  async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const editor = await opts.who();
    if (!editor) return Response.json({ error: 'Not allowed' }, { status: 403 });

    // 'confirmed' / 'cancelled' is the vocabulary the CHECK constraint enforces;
    // the bare verbs are accepted too.
    const raw = (await request.json().catch(() => ({}))) as { action?: unknown };
    const action =
      raw.action === 'confirm' || raw.action === 'confirmed'
        ? 'confirmed'
        : raw.action === 'cancel' || raw.action === 'cancelled'
          ? 'cancelled'
          : null;
    if (!action) return Response.json({ error: "action must be 'confirmed' or 'cancelled'" }, { status: 400 });

    const [thread] = await db<{ id: string }[]>`
      SELECT id FROM threads WHERE id = ${id} AND org_id = ${opts.orgId} LIMIT 1
    `;
    if (!thread) return Response.json({ error: 'Not found' }, { status: 404 });

    await db`
      INSERT INTO thread_cycle_events (id, thread_id, user_id, action)
      VALUES (${nanoid()}, ${id}, ${editor.userId}, ${action})
    `;
    return Response.json({ ok: true, action });
  }
  return { POST };
}

/** The group's shared whiteboard: one scene per org. `who` resolves any member (no editor gate). */
export function whiteboardRoutes(opts: { orgId: string; who: () => Promise<{ userId: string } | null> }) {
  const forbidden = () => Response.json({ error: 'Members only' }, { status: 403 });
  async function GET() {
    if (!(await opts.who())) return forbidden();
    return Response.json({ scene: await getWhiteboard(opts.orgId) });
  }
  async function PUT(request: Request) {
    if (!(await opts.who())) return forbidden();
    let payload: { scene?: WhiteboardScene };
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'Expected JSON' }, { status: 400 });
    }
    if (!payload.scene || !Array.isArray(payload.scene.elements)) {
      return Response.json({ error: 'scene.elements is required' }, { status: 400 });
    }
    await saveWhiteboard(opts.orgId, payload.scene);
    return Response.json({ ok: true });
  }
  return { GET, PUT };
}
