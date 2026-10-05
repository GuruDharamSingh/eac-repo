import { NextResponse, type NextRequest } from 'next/server';
import { recordCollect, type CollectOptions } from './collect';
import type { CollectPayload } from './index';

/**
 * Collector route handler. Mount it once per app:
 *
 *   // src/app/api/pulse/route.ts
 *   import { createCollectHandler } from "@elkdonis/analytics/route";
 *   export const POST = createCollectHandler({ defaultOrgId: "amrit_canada" });
 *
 * Always answers 204: a failure to record must never reach the visitor, and a
 * bot or opted-out visitor should learn nothing. Failures are logged at most
 * once a minute.
 */
export function createCollectHandler(options: CollectOptions = {}) {
  let lastLog = 0;
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const done = () => new NextResponse(null, { status: 204 });
    try {
      if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return done();

      const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
        .split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
      if (!host) return done();

      // Only the site's own pages report to it.
      const origin = req.headers.get('origin');
      if (origin) {
        let originHost = '';
        try { originHost = new URL(origin).hostname.toLowerCase(); } catch { /* ignore */ }
        if (originHost !== host) return done();
      }

      const text = await req.text();
      if (text.length > 4096) return done();
      const payload = JSON.parse(text) as CollectPayload;

      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip');

      let userId: string | null = null;
      try {
        const { getServerSession } = await import('@elkdonis/auth-server');
        const { user } = await getServerSession();
        userId = user?.db_user_id ?? user?.id ?? null; // users.id equals the GoTrue id
      } catch {
        userId = null;
      }

      await recordCollect(
        { payload, host, ip, userAgent: req.headers.get('user-agent') ?? '', userId },
        options
      );
    } catch (err) {
      if (Date.now() - lastLog > 60_000) {
        lastLog = Date.now();
        console.warn('[analytics] collect failed:', (err as Error).message);
      }
    }
    return done();
  };
}
