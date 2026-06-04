import { NextRequest, NextResponse } from 'next/server';
import { CLIENTS, createAuthCode } from '@/lib/oidc';
import { db } from '@elkdonis/db';
import { getServerAuth } from '@elkdonis/auth-server';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

// Use x-forwarded-* headers to build the correct public-facing origin.
// Without this, req.nextUrl.origin returns the internal Docker address.
function getExternalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const clientId = sp.get('client_id');
  const redirectUri = sp.get('redirect_uri');
  const responseType = sp.get('response_type');
  const state = sp.get('state');
  const scope = sp.get('scope') || '';
  const nonce = sp.get('nonce') || undefined;
  const codeChallenge = sp.get('code_challenge') || undefined;
  const codeChallengeMethod = sp.get('code_challenge_method') || undefined;
  const loginHint = sp.get('login_hint') || undefined;

  // JWT from cookie (set by talk/join on this same domain — no cross-origin issue)
  const cookieJwt = req.cookies.get('eac_user_jwt')?.value;

  // JWT embedded in state (legacy/fallback from old talk/join implementation)
  let jwtFromState: string | undefined;
  let originalState: string | undefined = state || undefined;
  let redirectUrlFromState: string | undefined;

  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      if (stateData.jwt) {
        jwtFromState = stateData.jwt;
        redirectUrlFromState = stateData.redirect_url;
        originalState = undefined;
        console.log('[oidc/authorize] JWT found in state');
      }
    } catch {
      // Normal OAuth state — pass through unchanged
    }
  }

  const userJwt = cookieJwt || jwtFromState || loginHint;
  if (userJwt) {
    console.log('[oidc/authorize] JWT present via:', cookieJwt ? 'cookie' : jwtFromState ? 'state' : 'login_hint');
  }

  // Validate OAuth request
  if (!clientId || !CLIENTS[clientId]) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }
  if (responseType !== 'code') {
    return NextResponse.json({ error: 'unsupported_response_type' }, { status: 400 });
  }
  if (!scope.split(' ').includes('openid')) {
    return NextResponse.json({ error: 'invalid_scope' }, { status: 400 });
  }
  if (!redirectUri) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri is required' }, { status: 400 });
  }
  if (!CLIENTS[clientId].redirectUris.includes(redirectUri)) {
    console.error('[oidc/authorize] redirect_uri not in allowlist:', redirectUri);
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  // Authenticate the user
  let userId: string;

  if (userJwt) {
    // Path 1: short-lived inter-app JWT (set by talk/join)
    try {
      const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);
      const { payload } = await jwtVerify(userJwt, secret, {
        issuer: ['inner-gathering', 'arts-collective'],
        audience: 'admin-oidc',
      });
      userId = payload.userId as string;
      console.log('[oidc/authorize] ✅ Authenticated via JWT for user:', userId);
    } catch (err) {
      console.error('[oidc/authorize] ❌ JWT verification failed:', err);
      return NextResponse.json({ error: 'invalid_login_hint' }, { status: 401 });
    }
  } else {
    // Path 2: Supabase session — user is already logged into IG
    const supabase = await getServerAuth();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Not logged in — send to IG login page, preserve the full authorize URL as returnTo
      const origin = getExternalOrigin(req);
      const loginUrl = new URL('/login', origin);
      const returnTo = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, origin);
      loginUrl.searchParams.set('returnTo', returnTo.toString());
      return NextResponse.redirect(loginUrl);
    }

    userId = session.user.id;
    console.log('[oidc/authorize] ✅ Authenticated via Supabase session for user:', userId);
  }

  // Resolve to public.users record
  const [byId] = await db`SELECT id FROM users WHERE id = ${userId}`;
  let user = byId;
  if (!user) {
    try {
      const [byAuth] = await db`SELECT id FROM users WHERE auth_user_id = ${userId}`;
      user = byAuth;
    } catch { /* column may not exist */ }
  }
  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const code = await createAuthCode(user.id, clientId, redirectUri, {
    nonce,
    codeChallenge,
    codeChallengeMethod,
  });

  // Build callback URL for Nextcloud's sociallogin
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (originalState) callbackUrl.searchParams.set('state', originalState);
  // If talk/join embedded a redirect URL in state, forward it so sociallogin
  // can redirect to the Talk room after completing token exchange
  if (redirectUrlFromState) callbackUrl.searchParams.set('redirect_url', redirectUrlFromState);

  console.log('[oidc/authorize] ✅ Issuing code, redirecting to:', callbackUrl.toString());
  const authorizeResponse = NextResponse.redirect(callbackUrl);
  // Mark that the user has completed an SSO flow. talk/join reads this to skip
  // re-running sociallogin when a Nextcloud session already exists (avoids
  // "this account is already connected" error on repeat clicks).
  authorizeResponse.cookies.set('eac_nc_session', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours — matches typical Nextcloud session length
    path: '/',
  });
  return authorizeResponse;
}
