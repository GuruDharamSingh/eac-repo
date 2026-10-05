import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { getServerSession, getSupabaseServer } from './index';
import { createRouteSupabaseClient } from './api-routes';
import { ARRIVAL_COOKIE, SSO_COOKIE, networkOriginFromEnv, ssoCookieValue } from './sso-state';

// ============================================================================
// Site-to-site session handoff — the network's SSO hop.
//
// One GoTrue, one `users` table, one auth package in every app: a person is
// the same person on amritcanada.ca and arts-collective.com. What the browser
// will not do is send one site's cookie to the other, so the sign-in has to
// be carried across in a redirect, the way the Nextcloud bridge already
// carries it (INTER_APP_JWT_SECRET, a short-lived token, one hop).
//
//   GET /api/auth/handoff?to=<absolute url>&next=<path on that site>[&via=<origin>]
//     Signed in here → sign a 60-second token bound to the destination's
//     origin → redirect to <dest>/api/auth/handoff/accept?token=…&next=…
//     Not signed in, or an origin we don't know → just go there, signed out.
//     `via` names the site the person was really coming from when this hop
//     is the network host answering another site's arrival check
//     (sso-proxy.ts); it rides in the token for the arrival record.
//     `plain=1` → only the redirect, and only to an allowed origin: the last
//     leg of a mirror (sso-proxy.ts), which must not mint a second session.
//
//   GET /api/auth/handoff/accept?token=…&next=…
//     Verify the token (secret, expiry, audience = this site) → ask GoTrue,
//     with the service key, for a one-time magic-link token for that account
//     → verify it server-side, which yields a session → set THIS site's
//     cookies → land on `next`. Already signed in here as the same person:
//     keep that session. Records the arrival (network_arrivals) when the
//     app passes its org (createHandoffAcceptHandler).
//
// The magic-link token is single-use and the JWT lives 60 seconds, so a
// leaked handoff URL is worth very little. Destinations are limited to the
// origins GoTrue itself may redirect to (ADDITIONAL_REDIRECT_URLS) plus the
// network host and its subdomains. HS256 is done with Node's crypto so this
// package takes on no dependency.
// ============================================================================

const HANDOFF_TTL_SECONDS = 60;

const networkOriginServer = networkOriginFromEnv;

/** This request's own public origin, from next/headers — for server components. */
export async function currentOrigin(): Promise<string> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const fwdProto = h.get('x-forwarded-proto') ?? 'http';
  const fwdHost = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  return `${fwdProto.split(',')[0].trim()}://${fwdHost.split(',')[0].trim()}`;
}

/**
 * Where a `/login` page should redirect ONCE, before showing the form, to
 * try a silent sign-in from the network host — the other half of
 * mirrorLoginHref in @elkdonis/auth-client. `loginPath` must already carry a
 * marker (e.g. `sso=1`) so the login page skips this check on the way back,
 * whether or not a session was found; the chain always terminates in at most
 * two hops (this function is never called again once the marker is set).
 * Returns null when there is no network host, or this already is it.
 */
export function ssoCheckUrl(hereOrigin: string, loginPath: string): string | null {
  const central = networkOriginServer();
  if (!central || hereOrigin.replace(/\/$/, '') === central.replace(/\/$/, '')) return null;
  const q = new URLSearchParams({ to: hereOrigin, next: loginPath });
  return `${central}/api/auth/handoff?${q.toString()}`;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyHs256(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** The origin the browser sees, behind the proxy. */
function publicOriginOf(request: NextRequest): string {
  const url = new URL(request.url);
  const fwdProto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const fwdHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${fwdProto.split(',')[0].trim()}://${fwdHost.split(',')[0].trim()}`;
}

/**
 * Origins a handoff may target: what GoTrue may redirect to, the network host
 * and any of its subdomains, and localhost in development.
 */
export function isAllowedHandoffOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') return true;
  const network = (process.env.NEXT_PUBLIC_NETWORK_HOST ?? '').split(':')[0].toLowerCase();
  if (network && (host === network || host.endsWith(`.${network}`))) return true;
  const allow = (process.env.ADDITIONAL_REDIRECT_URLS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/\*\*$/, '').replace(/\/$/, ''))
    .filter(Boolean);
  for (const entry of allow) {
    try {
      if (new URL(entry).hostname.toLowerCase() === host) return true;
    } catch {
      /* ignore malformed entries */
    }
  }
  const site = process.env.SITE_URL;
  if (site) {
    try {
      if (new URL(site).hostname.toLowerCase() === host) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Build a link that carries the sign-in to another site. Pure; safe anywhere. */
export function handoffUrl(to: string, next?: string): string {
  const q = new URLSearchParams({ to });
  if (next) q.set('next', next);
  return `/api/auth/handoff?${q.toString()}`;
}

/** Safe relative path for `next`: same-site only, no protocol-relative tricks. */
function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

/** GET /api/auth/handoff — leave this site carrying the session. */
export async function handleHandoffStart(request: NextRequest): Promise<NextResponse> {
  const to = request.nextUrl.searchParams.get('to');
  if (!to) return NextResponse.json({ error: 'Missing to' }, { status: 400 });
  let dest: URL;
  try {
    dest = new URL(to);
  } catch {
    return NextResponse.json({ error: 'Bad to' }, { status: 400 });
  }
  // `next` is a path on the destination; a `to` with its own path means the same.
  const nextParam = request.nextUrl.searchParams.get('next');
  const nextPath = nextParam ? safeNextPath(nextParam) : `${dest.pathname}${dest.search}` || '/';
  const landing = `${dest.origin}${nextPath}`;

  const here = publicOriginOf(request);

  if (request.nextUrl.searchParams.get('plain') === '1') {
    return NextResponse.redirect(isAllowedHandoffOrigin(dest.origin) ? landing : `${here}/`);
  }

  const secret = process.env.INTER_APP_JWT_SECRET;
  const session = await getServerSession().catch(() => ({ user: null }));

  // Same site, no session, unknown destination, or no secret: go there plainly.
  if (dest.origin === here || !session.user || !secret || !isAllowedHandoffOrigin(dest.origin)) {
    return NextResponse.redirect(landing);
  }

  const now = Math.floor(Date.now() / 1000);
  const via = viaOrigin(request.nextUrl.searchParams.get('via'));
  const token = signHs256(
    {
      sub: session.user.db_user_id ?? session.user.id,
      email: session.user.email,
      iss: here,
      aud: dest.origin,
      jti: randomUUID(),
      iat: now,
      exp: now + HANDOFF_TTL_SECONDS,
      ...(via ? { via } : {}),
    },
    secret
  );
  const q = new URLSearchParams({ token, next: nextPath });
  // The destination's BASE, not just its origin: an app served under a
  // sub-path answers /<base>/api/auth/handoff/accept, and this host cannot
  // know that unless the caller's `to` carries it. Only when `next` is given:
  // without it, a path on `to` is the landing page (see nextPath above), and
  // center pages and the network login pass full page URLs that way.
  const destBase = nextParam ? `${dest.origin}${dest.pathname.replace(/\/+$/, '')}` : dest.origin;
  return NextResponse.redirect(`${destBase}/api/auth/handoff/accept?${q.toString()}`);
}

/** An origin from the `via` parameter, or null. Any site may be named: it is only recorded. */
function viaOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin.slice(0, 255);
  } catch {
    return null;
  }
}

export interface HandoffAcceptOptions {
  /** This site's org. With it, each arrival is recorded for the org's people page. */
  orgId?: string;
}

/** handleHandoffAccept with the site's org bound — `export const GET = createHandoffAcceptHandler({ orgId })`. */
export function createHandoffAcceptHandler(options: HandoffAcceptOptions) {
  return (request: NextRequest) => acceptHandoff(request, options);
}

/** GET /api/auth/handoff/accept — arrive on this site carrying the session. */
export async function handleHandoffAccept(request: NextRequest): Promise<NextResponse> {
  return acceptHandoff(request, {});
}

async function acceptHandoff(request: NextRequest, options: HandoffAcceptOptions): Promise<NextResponse> {
  const here = publicOriginOf(request);
  const nextPath = safeNextPath(request.nextUrl.searchParams.get('next'));
  const fail = (reason: string) => {
    console.warn(`[handoff] refused: ${reason}`);
    const q = new URLSearchParams({ next: nextPath, error: 'handoff' });
    return NextResponse.redirect(`${here}/login?${q.toString()}`);
  };

  const token = request.nextUrl.searchParams.get('token');
  const secret = process.env.INTER_APP_JWT_SECRET;
  if (!token || !secret) return fail('missing token or secret');

  const payload = verifyHs256(token, secret);
  if (!payload) return fail('bad signature or expired');
  if (payload.aud !== here) return fail(`audience ${String(payload.aud)} is not ${here}`);
  if (typeof payload.iss !== 'string' || !isAllowedHandoffOrigin(payload.iss)) return fail('unknown issuer');
  const email = typeof payload.email === 'string' ? payload.email : null;
  if (!email) return fail('no email');

  // One shot: the magic-link token below is single-use, but the JWT itself
  // would otherwise be good for another session for as long as it lives.
  // Remember its id for the token's lifetime; a second arrival is refused.
  // Redis being down degrades to "replayable for 60 seconds" with a warning
  // rather than a broken network, the same posture the session cache takes.
  const jti = typeof payload.jti === 'string' ? payload.jti : null;
  if (!jti) return fail('no token id');
  try {
    const { getRedisClient } = await import('@elkdonis/redis');
    const claimed = await getRedisClient().set(
      `handoff:jti:${jti}`,
      '1',
      'EX',
      HANDOFF_TTL_SECONDS + 30,
      'NX'
    );
    if (claimed !== 'OK') return fail('token already used');
  } catch (err) {
    console.warn('[handoff] Redis unavailable, token replay not tracked:', (err as Error).message);
  }

  const secure = here.startsWith('https:');
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  const via = typeof payload.via === 'string' ? payload.via : null;
  const finish = async (response: NextResponse) => {
    response.cookies.set(SSO_COOKIE, ssoCookieValue('m'), { path: '/', sameSite: 'lax', httpOnly: true, secure });
    if (sub && options.orgId && here !== networkOriginServer()) {
      const arrivalId = await recordArrival({
        userId: sub,
        orgId: options.orgId,
        host: new URL(here).host,
        path: nextPath,
        from: via ?? (payload.iss !== networkOriginServer() ? (payload.iss as string) : null),
      });
      if (arrivalId) {
        // Readable by the page: the notice (cms-ui ArrivalNotice) fetches only
        // when it is present. The id is useless to anyone but this user.
        response.cookies.set(ARRIVAL_COOKIE, arrivalId, { path: '/', sameSite: 'lax', httpOnly: false, secure, maxAge: 60 * 30 });
      }
    }
    return response;
  };

  // Already signed in here as the same person (a mirror hop, or a second
  // tab): keep that session rather than minting another GoTrue session.
  const current = await getServerSession().catch(() => ({ user: null }));
  if (current.user && (current.user.db_user_id === sub || current.user.email?.toLowerCase() === email.toLowerCase())) {
    return finish(NextResponse.redirect(`${here}${nextPath}`));
  }

  // A one-time magic-link token for this account, verified here on the
  // server, is what turns "we trust this person arrived" into a session on
  // this host. The person never sees the link.
  let hashedToken: string;
  try {
    const admin = getSupabaseServer();
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !data?.properties?.hashed_token) return fail(`generateLink: ${error?.message ?? 'no token'}`);
    hashedToken = data.properties.hashed_token;
  } catch (err) {
    return fail(`generateLink threw: ${(err as Error).message}`);
  }

  const { supabase, applyCookies } = createRouteSupabaseClient(request);
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashedToken,
  });
  if (verifyError || !verified.session) return fail(`verifyOtp: ${verifyError?.message ?? 'no session'}`);

  const response = NextResponse.redirect(`${here}${nextPath}`);
  await applyCookies(response);
  return finish(response);
}

/**
 * Record an arrival in network_arrivals and return its id — only when it says
 * something: the person came from a known site, or this is their first
 * arrival on this host. A sign-in mirrored back to the site it started on
 * (no source, not new) is not an arrival. Soft-fails: a missing table or a
 * database error must not break the sign-in.
 */
async function recordArrival(a: {
  userId: string;
  orgId: string;
  host: string;
  path: string;
  from: string | null;
}): Promise<string | null> {
  try {
    const { db } = await import('@elkdonis/db');
    let fromHost: string | null = null;
    if (a.from) {
      try {
        fromHost = new URL(a.from).host.toLowerCase();
      } catch {
        fromHost = null;
      }
    }
    if (fromHost === a.host.toLowerCase()) fromHost = null;
    if (!fromHost) {
      const [seen] = await db<{ n: number }[]>`
        SELECT 1 AS n FROM network_arrivals WHERE user_id = ${a.userId} AND host = ${a.host} LIMIT 1
      `;
      if (seen) return null;
    }
    const fromDomain = fromHost ? fromHost.split(':')[0].replace(/^www\./, '') : null;
    const [row] = await db<{ id: string }[]>`
      INSERT INTO network_arrivals (user_id, org_id, host, path, from_host, from_org_id)
      VALUES (
        ${a.userId}, ${a.orgId}, ${a.host}, ${a.path.slice(0, 500)}, ${fromHost},
        ${fromDomain ? db`(SELECT org_id FROM org_domains WHERE domain IN (${fromDomain}, ${'www.' + fromDomain}) LIMIT 1)` : null}
      )
      RETURNING id
    `;
    return row?.id ?? null;
  } catch (err) {
    console.warn('[handoff] arrival not recorded:', (err as Error).message);
    return null;
  }
}
