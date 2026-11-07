/**
 * The registry over HTTP (2026-11-06): route handlers any host mounts, in the
 * style of `centerRoutes` (packages/services/src/center-routes.ts), so a dock,
 * a script or another app can list, read and perform entries without its own
 * server action. A host does:
 *
 *   const routes = actionRoutes({ who, links, publicOrigin });
 *   export const GET = routes.catalogue.GET;      // app/api/actions/route.ts
 *   export const GET = routes.entry.GET;          // app/api/actions/[id]/route.ts
 *   export const POST = routes.entry.POST;
 *
 *   GET  /api/actions              every catalogue entry; runnable ones carry `input` (JSON Schema). Public.
 *   GET  /api/actions/<id>?org=&subject=   { id, org, subject, status } — actionStatus for the signed-in person. Never writes.
 *   POST /api/actions/<id>                 body { input?, org?, subject? } → the ActionResult, as JSON.
 *
 * `subject` names what a subject-scoped entry acts on: for scope 'thread' (thread-edit,
 * thread-publish, thread-pin) a post's threads.id. performAction loads the post and
 * takes the org from its row, so `org` is not resolved for those entries (actionOrgId
 * returns null for every scope but 'org'); a missing subject answers 400, an unknown
 * one 404. Publishing, pinning and editing a published post are refused through this
 * door (`via: 'http'`, code 'forbidden'); a draft can be edited from here.
 *
 * POST answers, in the order they are checked:
 *   404 unknown id · 405 no runner (Allow: GET) · 415 not application/json ·
 *   403 foreign Origin · 401 signed out · 429 over the rate limit (Retry-After) ·
 *   413 body over 64 KiB (declared or streamed) · 400 not a JSON object;
 *   then performAction's result: 200 ok, else by `code` — auth 401, unknown 404,
 *   input 400, forbidden 403, failed 500 — and 422 with no code (the entry
 *   itself refused, e.g. "That address is taken"). Errors are `{ ok: false, error, code? }`.
 *
 * The actor comes only from `who` (the host's verified session), never from
 * the body or query: these routes serve every entry. `org` is a claim that
 * `actionOrgId` honours only for an owner or guide (./org.ts), the same rule
 * as a host's `runAction`. `subject` is a claim too: the entry's own check
 * decides whether this person may act on that post.
 *
 * The session is a cookie, so POST is guarded against cross-site requests: it
 * needs `Content-Type: application/json` (a cross-site form cannot send it
 * without a CORS preflight, and no CORS headers are sent) and, when the
 * browser sends `Origin`, that origin must equal the request's public origin.
 * Cross-origin callers (a dock on an org's own domain) are not served yet.
 *
 * The rate limit is a sliding window per signed-in person, kept in memory in
 * this process: each container (and each dev-server reload) has its own window,
 * and a restart clears it. GET is not limited.
 */
import { ACTION_CATALOGUE, actionMeta } from '../catalogue';
import type { ActionFailure, ActionLinks, ActionMeta, ActionResult } from '../types';
import { actionStatus } from './status';
import { performAction, RUNNABLE_IDS } from './run';
import { actionJsonSchema } from './schema';
import { actionOrgId } from './org';

export interface ActionRouteActor {
  /** users.id */
  userId: string;
  email: string;
}

export interface ActionRateLimit {
  /** Length of the sliding window. Default 60 000 (60 s). */
  windowMs?: number;
  /** POSTs one person may make in a window; the next answers 429. Default 30. */
  posts?: number;
}

export interface ActionRoutesOptions {
  /** The signed-in person from the host's verified session (getServerSession), or null. */
  who: () => Promise<ActionRouteActor | null>;
  /** Where finished things live on this host (the same object its task boxes use). */
  links: ActionLinks;
  /**
   * The origin the browser used, for the POST `Origin` check. Hosts pass
   * `(req) => publicOriginFrom(req.headers)` from `@elkdonis/checkout/booking`;
   * the default applies the same rule (forwarded host, never 0.0.0.0).
   */
  publicOrigin?: (req: Request) => string;
  /** POST rate limit per person, in memory per process. */
  rateLimit?: ActionRateLimit;
}

/** A catalogue row as the catalogue route serves it. */
export type ActionCatalogueRow = ActionMeta & {
  /** Runnable entries only: the input's JSON Schema, or null when the entry takes none. */
  input?: Record<string, unknown> | null;
};

type IdContext = { params: Promise<{ id: string }> };

/** Request bodies are a few fields; anything larger is refused, before parsing and without reading it in full. */
const MAX_BODY = 64 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_POSTS = 30;
/** Above this many tracked people, every POST sweeps out the ones with nothing left in the window. */
const RATE_SWEEP_AT = 500;

/** HTTP status for a refused ActionResult, by its code; no code (the entry's own refusal) is 422. */
const FAILURE_STATUS: Record<ActionFailure, number> = { auth: 401, unknown: 404, input: 400, forbidden: 403, failed: 500, limit: 429 };

const resultStatus = (r: ActionResult): number => (r.ok === false ? (r.code ? FAILURE_STATUS[r.code] ?? 422 : 422) : 200);

const json = (body: unknown, status = 200, extra?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

const fail = (error: string, status: number, code?: ActionFailure, extra?: Record<string, string>) =>
  json(code ? { ok: false, error, code } : { ok: false, error }, status, extra);

/** Same rule as @elkdonis/checkout's publicOriginFrom; this package does not depend on checkout. */
function forwardedOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host');
  if (host && !host.startsWith('0.0.0.0')) {
    const proto =
      h.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
}

/** Compared as parsed origins, so case and a default port do not matter; anything unparsable is a mismatch. */
function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function mediaType(req: Request): string {
  return (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
}

type BodyRead = { ok: true; value: Record<string, unknown> } | { ok: false; status: 400 | 413 };

/**
 * The POST body as an object; an empty body is `{}`. Read from the stream with
 * a running byte count, so a chunked body with no Content-Length stops at
 * `max` instead of being read in full.
 */
async function readBody(req: Request, max: number): Promise<BodyRead> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.trim()) return { ok: true, value: {} };
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? { ok: true, value: v as Record<string, unknown> } : { ok: false, status: 400 };
  } catch {
    return { ok: false, status: 400 };
  }
}

/**
 * A sliding window per key (the precedent: app/api/pureland/log/route.ts).
 * Returns 0 when the call may go ahead (and counts it), else the seconds until
 * the oldest call in the window leaves it. A refused call is not counted. The
 * map is swept of people with nothing left in the window once per window, and
 * on every call while it holds more than RATE_SWEEP_AT, so it stays bounded by
 * the people active in about the last two windows.
 */
function slidingWindow(windowMs: number, posts: number) {
  const recent = new Map<string, number[]>();
  let sweptAt = Date.now();
  return (key: string): number => {
    const now = Date.now();
    if (recent.size > RATE_SWEEP_AT || now - sweptAt >= windowMs) {
      for (const [k, v] of recent) if (!v.length || now - v[v.length - 1] >= windowMs) recent.delete(k);
      sweptAt = now;
    }
    const list = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= posts) {
      recent.set(key, list);
      return Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
    }
    list.push(now);
    recent.set(key, list);
    return 0;
  };
}

/** A thrown error answers 500 without detail; the log keeps it. */
function guarded<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(`[actions] route ${name}:`, err);
      return fail('Something went wrong.', 500, 'failed');
    }
  };
}

/** A subject claim as a trimmed id, or null; performAction and the checks look it up. */
const subjectOf = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 64) : null);

const positive = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback);

export function actionRoutes(opts: ActionRoutesOptions) {
  const originOf = opts.publicOrigin ?? forwardedOrigin;
  const idOf = async (ctx: IdContext) => String((await ctx.params)?.id ?? '');
  // One window per mounted instance; a host mounts one (lib/actions/routes.ts), so one per process.
  const limited = slidingWindow(positive(opts.rateLimit?.windowMs, RATE_WINDOW_MS), positive(opts.rateLimit?.posts, RATE_POSTS));

  return {
    catalogue: {
      GET: guarded('catalogue', async (_req: Request) => {
        const actions: ActionCatalogueRow[] = ACTION_CATALOGUE.map((m) => {
          // `runnable` is what this door will perform (the runner table), not only what the catalogue declares.
          const runnable = RUNNABLE_IDS.includes(m.id);
          return runnable ? { ...m, runnable, input: actionJsonSchema(m.id) } : { ...m, runnable };
        });
        return json({ actions });
      }),
    },

    entry: {
      // Status of one entry for the signed-in person. Reads only; not rate-limited.
      GET: guarded('status', async (req: Request, ctx: IdContext) => {
        const id = await idOf(ctx);
        if (!actionMeta(id)) return fail('No such action.', 404, 'unknown');
        const actor = await opts.who();
        if (!actor?.userId) return fail('Sign in first.', 401, 'auth');
        const q = new URL(req.url).searchParams;
        const orgId = await actionOrgId(id, actor.userId, q.get('org'));
        const subjectId = subjectOf(q.get('subject'));
        // The step's choices (e.g. org-publish ?kind=event); actionParams in the check drops anything undeclared.
        const params = Object.fromEntries([...q.entries()].filter(([k]) => k !== 'org' && k !== 'subject'));
        const status = await actionStatus(id, { userId: actor.userId, orgId, subjectId, links: opts.links, params });
        return json({ id, org: orgId, subject: subjectId, status });
      }),

      // Perform one entry.
      POST: guarded('run', async (req: Request, ctx: IdContext) => {
        const id = await idOf(ctx);
        if (!actionMeta(id)) return fail('No such action.', 404, 'unknown');
        if (!RUNNABLE_IDS.includes(id)) return fail('This cannot be done from here.', 405, 'unknown', { allow: 'GET' });
        if (mediaType(req) !== 'application/json') return fail('Send JSON (Content-Type: application/json).', 415, 'input');
        const origin = req.headers.get('origin');
        if (origin !== null && !sameOrigin(origin, originOf(req))) return fail('Not allowed from this origin.', 403, 'forbidden');
        const actor = await opts.who();
        if (!actor?.userId) return fail('Sign in first.', 401, 'auth');
        // Counted once the person is known, before the body is read: an oversized or malformed POST counts too.
        const wait = limited(actor.userId);
        if (wait > 0) return fail('Too many requests. Wait a moment and try again.', 429, 'limit', { 'retry-after': String(wait) });
        const declared = Number(req.headers.get('content-length') ?? 0);
        if (declared > MAX_BODY) return fail('That request is too large.', 413, 'input');
        const body = await readBody(req, MAX_BODY);
        if (body.ok === false) {
          return body.status === 413
            ? fail('That request is too large.', 413, 'input')
            : fail('Send a JSON object: { "input": …, "org": … }.', 400, 'input');
        }
        const raw = body.value;
        // null for a 'thread' entry: performAction takes its org from the post.
        const orgId = await actionOrgId(id, actor.userId, typeof raw.org === 'string' ? raw.org : null);
        const subjectId = subjectOf(raw.subject);
        const result = await performAction(id, { userId: actor.userId, email: actor.email, orgId, subjectId, via: 'http' }, raw.input);
        return json(result, resultStatus(result));
      }),
    },
  };
}
