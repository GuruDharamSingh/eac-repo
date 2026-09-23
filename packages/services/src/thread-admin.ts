import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { canModerate } from './forum-write';
import { getViewerRoles, type ForumViewer, viewerIdentityIds } from './forum';
import { getIdentityIds } from './identities';
import { removeThreadFromCalendar, setStandingMeeting } from './org-calendar';
import { pushModerationToNextcloud } from './nc-forum';

// ============================================================================
// Two things a person may do to a thread from wherever it shows — its popup,
// its page on the org site, its row on the forum — stated once:
//
//   remove   the AUTHOR (under any of their names) or an org moderator may
//            take a thread down. Archived, never deleted: replies, RSVPs and
//            gather edges keep their keys, and a manage console can restore.
//   feature  an EDITOR may name a meeting the org's standing (weekly) meeting,
//            or stop featuring it — the flag `getStandingMeeting` reads first.
//
// `createThreadAdminRoutes` is the host's whole route for both: DELETE and
// PATCH on `/api/hub/threads/:id`, framework-agnostic (Request → Response),
// the same shape as createGatherRoutes. A host supplies its org and its
// viewer; the rule lives here.
// ============================================================================

export type RemoveResult =
  | { ok: true; orgId: string; kind: string; section: string | null; already: boolean }
  | { ok: false; error: string };

/**
 * Take a thread down as this viewer. Author (any identity) or moderator;
 * `editor: true` is a host's own editor tier, granted the same as a
 * moderator because on the template sites that is what it means.
 */
export async function removeThread(
  viewer: ForumViewer,
  threadId: string,
  opts: { editor?: boolean } = {}
): Promise<RemoveResult> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  const [t] = await db<Array<{ org_id: string; author_id: string; status: string; kind: string; section: string | null }>>`
    SELECT org_id, author_id, status, kind, section FROM threads WHERE id = ${threadId}
  `;
  if (!t) return { ok: false, error: 'No such thread.' };
  const mine = viewerIdentityIds(viewer).includes(t.author_id);
  const mod = canModerate(viewer, t.org_id) || Boolean(opts.editor);
  if (!mine && !mod) return { ok: false, error: 'Only its author or a moderator can remove this.' };
  if (t.status === 'archived') return { ok: true, orgId: t.org_id, kind: t.kind, section: t.section, already: true };

  await db`UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = ${threadId}`;
  // Off everyone's calendar now, not at the next sync. Best-effort: the
  // reconciler (org-calendar-sync.ts) removes it anyway if this fails.
  await removeThreadFromCalendar(t.org_id, threadId).catch(() => {});
  try {
    await db`
      INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data, created_at)
      VALUES (${nanoid()}, ${t.org_id}, ${viewer.userId}, 'content_hidden', 'post', ${threadId},
              ${db.json({ via: mine ? 'author' : 'moderator', action: 'delete' })}, NOW())
    `;
  } catch (err) {
    // The act already happened; losing its log line must not undo it.
    console.error('[thread-admin] log remove:', err);
  }
  // A topic shared with Nextcloud comes down there too.
  await pushModerationToNextcloud(threadId, 'delete').catch((err) => console.error('[thread-admin] nc remove:', err));
  return { ok: true, orgId: t.org_id, kind: t.kind, section: t.section, already: false };
}

/** The same, from a bare account id — resolves roles and pen names itself. */
export async function removeThreadAs(
  userId: string,
  threadId: string,
  opts: { editor?: boolean } = {}
): Promise<RemoveResult> {
  const [roles, identityIds] = await Promise.all([
    getViewerRoles(userId),
    getIdentityIds(userId).catch(() => [userId]),
  ]);
  return removeThread({ userId, roles, identityIds }, threadId, opts);
}

export type FeatureResult = { ok: true; standing: boolean } | { ok: false; error: string };

/** Name a meeting the org's standing one, or stop featuring it. Editors only. */
export async function featureMeeting(orgId: string, threadId: string, on: boolean): Promise<FeatureResult> {
  const [t] = await db<Array<{ kind: string; status: string }>>`
    SELECT kind, status FROM threads WHERE id = ${threadId} AND org_id = ${orgId}
  `;
  if (!t) return { ok: false, error: 'No such thread.' };
  if (on && t.kind !== 'meeting' && t.kind !== 'event') return { ok: false, error: 'Only a meeting or event can be the weekly meeting.' };
  if (on && t.status !== 'published') return { ok: false, error: 'Publish it first.' };
  await setStandingMeeting(orgId, on ? threadId : null);
  return { ok: true, standing: on };
}

type RouteCtx = { params: Promise<{ id: string }> };
export type ThreadAdminHandler = (request: Request, ctx: RouteCtx) => Promise<Response>;

export interface ThreadAdminRouteHandlers {
  DELETE: ThreadAdminHandler;
  PATCH: ThreadAdminHandler;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * A host's DELETE (remove) and PATCH ({ standing: boolean }) for
 * `/api/hub/threads/:id`. The host says who is asking and which org it is;
 * nothing else is host-specific.
 */
export function createThreadAdminRoutes(opts: {
  orgId: string;
  viewer: () => Promise<{ userId: string; canEdit: boolean } | null>;
}): ThreadAdminRouteHandlers {
  return {
    async DELETE(_request, ctx) {
      const { id } = await ctx.params;
      const viewer = await opts.viewer().catch(() => null);
      if (!viewer) return json({ error: 'Sign in first.' }, 401);
      const r = await removeThreadAs(viewer.userId, id, { editor: viewer.canEdit });
      if (r.ok === false) return json({ error: r.error }, r.error.startsWith('No such') ? 404 : 403);
      return json({ ok: true, section: r.section, kind: r.kind, already: r.already });
    },
    async PATCH(request, ctx) {
      const { id } = await ctx.params;
      const viewer = await opts.viewer().catch(() => null);
      if (!viewer) return json({ error: 'Sign in first.' }, 401);
      if (!viewer.canEdit) return json({ error: 'Editors only.' }, 403);
      let body: any;
      try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
      if (typeof body?.standing !== 'boolean') return json({ error: 'Nothing to change.' }, 400);
      const r = await featureMeeting(opts.orgId, id, body.standing);
      if (r.ok === false) return json({ error: r.error }, 400);
      return json({ ok: true, standing: r.standing });
    },
  };
}
