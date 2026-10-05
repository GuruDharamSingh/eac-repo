import { NextResponse, type NextRequest } from 'next/server';
import {
  SSO_COOKIE,
  isSignedOutEverywhere,
  networkOriginFromEnv,
  parseSsoCookie,
  ssoCookieValue,
} from './sso-state';

// ============================================================================
// Network SSO on arrival — call from each app's proxy.ts (Next 16, Node runtime).
//
// Each site keeps its own session cookie; the network host (arts-collective.com)
// is the one place every sign-in is mirrored to. On the first page view of a
// visit this makes the two agree, whichever way they differ:
//
//   signed out here → ask the network host once (/api/auth/handoff on the
//     network host). Signed in there: it hands a token back and this site
//     gets its own session. Signed out there: it sends the browser straight
//     back. Either way the person lands on the page they asked for.
//
//   signed in here, not yet mirrored this visit → leave through this site's
//     own /api/auth/handoff to the network host and straight back, so the
//     network host holds the sign-in for the next site. Covers every way a
//     session starts: password, Google, signup, magic link, a handoff.
//
// The `eac_sso` cookie (sso-state.ts) keeps this to once per visit. A
// signed-out check is repeated after ANON_RECHECK_SECONDS, or sooner when the
// visitor arrives from another site (they may have signed in there since).
// Only top-level GET page navigations are redirected; API calls, prefetches,
// RSC fetches, assets and crawlers pass untouched.
// ============================================================================

const ANON_RECHECK_SECONDS = 10 * 60;
/** A cross-site arrival re-asks only if the last check is older than this — the check's own return trip carries the original Referer. */
const REFERER_RECHECK_SECONDS = 30;

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests|headless/i;
const SKIP_PREFIXES = ['/api', '/_next', '/login', '/signup', '/auth', '/logout'];
const STATIC_EXT = /\.(?:ico|png|jpe?g|gif|webp|avif|svg|css|js|map|txt|xml|json|woff2?|ttf|otf|mp4|webm|mp3|pdf)$/i;

export interface SsoProxyOptions {
  /** Extra paths (after basePath) to leave alone, e.g. a webhook page. */
  skip?: (pathname: string) => boolean;
}

function publicOrigin(req: NextRequest): string {
  const proto = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')).split(',')[0].trim();
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host).split(',')[0].trim();
  return `${proto}://${host}`;
}

function storageKey(): string {
  return process.env.SUPABASE_AUTH_STORAGE_KEY || 'sb-eac-auth';
}

/** This host's session cookie names (single or chunked), in chunk order. */
function sessionCookieNames(req: NextRequest): string[] {
  const key = storageKey();
  const names = req.cookies.getAll().map((c) => c.name);
  if (names.includes(key)) return [key];
  const chunks: string[] = [];
  for (let i = 0; names.includes(`${key}.${i}`); i++) chunks.push(`${key}.${i}`);
  return chunks;
}

/** The access token in this host's session cookie, without verifying it. */
function accessTokenFromCookie(req: NextRequest, names: string[]): string | null {
  try {
    let raw = names.map((n) => req.cookies.get(n)?.value ?? '').join('');
    if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice(7), 'base64url').toString('utf8');
    else raw = decodeURIComponent(raw);
    const parsed = JSON.parse(raw) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' ? parsed.access_token : null;
  } catch {
    return null;
  }
}

function isPageNavigation(req: NextRequest): boolean {
  if (req.method !== 'GET') return false;
  const h = req.headers;
  if (h.get('rsc') || h.get('next-router-prefetch') || h.get('next-router-state-tree')) return false;
  const purpose = h.get('sec-purpose') ?? h.get('purpose') ?? '';
  if (/prefetch|prerender/i.test(purpose)) return false;
  const dest = h.get('sec-fetch-dest');
  if (dest) return dest === 'document';
  return (h.get('accept') ?? '').includes('text/html');
}

function refererOrigin(req: NextRequest): string | null {
  const ref = req.headers.get('referer');
  if (!ref) return null;
  try {
    return new URL(ref).origin;
  } catch {
    return null;
  }
}

/**
 * Returns a redirect when this navigation should pass through the network
 * host first, or null to carry on. Compose it at the top of proxy.ts:
 *
 *   const sso = await ssoProxy(req); if (sso) return sso;
 */
export async function ssoProxy(req: NextRequest, options: SsoProxyOptions = {}): Promise<NextResponse | null> {
  const central = networkOriginFromEnv();
  if (!central || !process.env.INTER_APP_JWT_SECRET) return null;
  if (!isPageNavigation(req)) return null;
  if (BOT_UA.test(req.headers.get('user-agent') ?? '')) return null;

  const path = req.nextUrl.pathname; // without basePath
  if (SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  if (STATIC_EXT.test(path)) return null;
  if (options.skip?.(path)) return null;

  const here = publicOrigin(req);
  if (here === central) return null;

  const basePath = req.nextUrl.basePath || '';
  const fullPath = `${basePath}${path}${req.nextUrl.search}`;
  const now = Math.floor(Date.now() / 1000);
  const mark = parseSsoCookie(req.cookies.get(SSO_COOKIE)?.value);
  const cookieNames = sessionCookieNames(req);

  let signedIn = cookieNames.length > 0;
  let clearStale = false;
  // A session ended by a sign-out on another site: drop its leftover cookie
  // and treat this visit as signed out, so the person can be signed in again
  // from the network host if they have signed in somewhere since.
  if (signedIn && (await isSignedOutEverywhere(accessTokenFromCookie(req, cookieNames)))) {
    signedIn = false;
    clearStale = true;
  }

  if (signedIn) {
    if (mark?.state === 'm') return null;
    // Out to the network host and straight back: `plain=1` makes the network
    // host's /api/auth/handoff a plain, allow-listed redirect.
    const back = new URLSearchParams({ to: `${here}${fullPath}`, plain: '1' });
    const q = new URLSearchParams({ to: central, next: `/api/auth/handoff?${back.toString()}` });
    const res = NextResponse.redirect(`${here}${basePath}/api/auth/handoff?${q.toString()}`);
    res.cookies.set(SSO_COOKIE, ssoCookieValue('m'), { path: '/', sameSite: 'lax', httpOnly: true, secure: here.startsWith('https:') });
    return res;
  }

  const ref = refererOrigin(req);
  // The check's own return trip keeps the original Referer (redirects do not
  // change it), which REFERER_RECHECK_SECONDS absorbs.
  const fromElsewhere = ref !== null && ref !== here;
  if (mark?.state === 'a') {
    const age = now - mark.at;
    const due = age > ANON_RECHECK_SECONDS || (fromElsewhere && age > REFERER_RECHECK_SECONDS);
    if (!due) return null;
  }

  const q = new URLSearchParams({ to: `${here}${basePath}`, next: fullPath });
  if (fromElsewhere && ref) q.set('via', ref);
  const res = NextResponse.redirect(`${central}/api/auth/handoff?${q.toString()}`);
  res.cookies.set(SSO_COOKIE, ssoCookieValue('a'), { path: '/', sameSite: 'lax', httpOnly: true, secure: here.startsWith('https:'), maxAge: 60 * 60 * 24 });
  if (clearStale) for (const name of cookieNames) res.cookies.delete(name);
  return res;
}
