/**
 * The HTTP side of generated word art, mounted by each site that offers it, so
 * a site calls its own origin with the visitor's session (no cross-origin key):
 *
 *   app/api/wordart/generate/route.ts       export const { GET, POST } = wordArtRoutes({ who }).generate
 *   app/api/wordart/generate/[id]/route.ts  export const { GET } = wordArtRoutes({ who }).job
 *
 * GET  /api/wordart/generate        { targets, fonts, looks, frames, jobs } for the signed-in person
 * POST /api/wordart/generate        { orgId, text, pins? } → 202 { jobId, job }; same-origin JSON only
 * GET  /api/wordart/generate/<id>   { job } (status queued | running | done | failed, and the file when done)
 *
 * `who` resolves the signed-in person from the session; nothing in the request names them.
 */

import { WORDART_FRAME_SIZES, WORDART_GENERATED_FONTS, WORDART_LOOKS } from './wordart-catalog';
import { getWordArtJob, listWordArtJobs, listWordArtTargets, queueWordArt } from './wordart-generate';

const MAX_BODY = 4 * 1024;
const JOB_ID = /^[A-Za-z0-9_-]{12}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** The Origin header must name the host the request came in on (forwarded headers behind the edge). */
function fromThisSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === new URL(`https://${host}`).host;
  } catch {
    return false;
  }
}

export function wordArtRoutes(opts: { who: () => Promise<string | null> }) {
  const viewer = () => opts.who().catch(() => null);

  return {
    generate: {
      async GET(): Promise<Response> {
        const userId = await viewer();
        if (!userId) return json({ error: 'Sign in first' }, 401);
        const [targets, jobs] = await Promise.all([listWordArtTargets(userId), listWordArtJobs(userId)]);
        return json({
          targets,
          jobs,
          fonts: WORDART_GENERATED_FONTS.map(({ id, label }) => ({ id, label })),
          looks: WORDART_LOOKS.map(({ id, label }) => ({ id, label })),
          frames: Object.keys(WORDART_FRAME_SIZES),
        });
      },
      async POST(request: Request): Promise<Response> {
        if (!fromThisSite(request)) return json({ error: 'Cross-site requests are refused' }, 403);
        if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') {
          return json({ error: 'Send JSON' }, 415);
        }
        const userId = await viewer();
        if (!userId) return json({ error: 'Sign in first' }, 401);
        if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'Too large' }, 413);
        const text = await request.text();
        if (text.length > MAX_BODY) return json({ error: 'Too large' }, 413);
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          return json({ error: 'Bad request' }, 400);
        }
        const queued = await queueWordArt(userId, body);
        if (queued.ok === false) return json({ error: queued.error }, queued.status);
        return json({ jobId: queued.job.id, job: queued.job }, 202);
      },
    },
    job: {
      async GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
        const userId = await viewer();
        if (!userId) return json({ error: 'Sign in first' }, 401);
        const { id } = await context.params;
        const job = JOB_ID.test(id) ? await getWordArtJob(userId, id) : null;
        return job ? json({ job }) : json({ error: 'Not found' }, 404);
      },
    },
  };
}
