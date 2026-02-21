import { NextRequest, NextResponse } from 'next/server';
import { CLIENTS, createAuthCode } from '@/lib/oidc';
import { db } from '@elkdonis/db';
import { getServerAuth } from '@elkdonis/auth-server';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

function getExternalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope') || '';
  const nonce = searchParams.get('nonce') || undefined;
  const codeChallenge = searchParams.get('code_challenge') || undefined;
  const codeChallengeMethod = searchParams.get('code_challenge_method') || undefined;
  const loginHint = searchParams.get('login_hint') || undefined;

  // Try to get JWT from cookie (set by inner-gathering)
  const cookieJwt = req.cookies.get('eac_user_jwt')?.value;

  // Try to extract JWT from state parameter (legacy approach)
  let jwtFromState: string | undefined;
  let originalState: string | undefined = state;
  let redirectUrlFromState: string | undefined;

  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      if (stateData.jwt) {
        jwtFromState = stateData.jwt;
        redirectUrlFromState = stateData.redirect_url;
        originalState = undefined;
        console.log('[oidc/authorize] Extracted JWT from state parameter');
      }
    } catch {
      // Not our custom state format, treat as regular OAuth state
    }
  }

  const userJwt = cookieJwt || jwtFromState || loginHint;

  if (userJwt) {
    console.log('[oidc/authorize] Found JWT via:', cookieJwt ? 'cookie' : jwtFromState ? 'state' : 'login_hint');
  }
  
  // 1. Validate Request
  if (!clientId || !CLIENTS[clientId]) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }

  if (responseType !== 'code') {
    return NextResponse.json({ error: 'unsupported_response_type' }, { status: 400 });
  }

  if (!scope.split(' ').includes('openid')) {
    return NextResponse.json({ error: 'invalid_scope' }, { status: 400 });
  }

  const client = CLIENTS[clientId];

  if (!redirectUri) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri is required' }, { status: 400 });
  }

  if (!client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  // 2. Check Authentication - support both JWT and session
  let userId: string;

  if (userJwt) {
    // Verify JWT from inner-gathering
    try {
      const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);

      const { payload } = await jwtVerify(userJwt, secret, {
        issuer: 'inner-gathering',
        audience: 'admin-oidc',
      });

      userId = payload.userId as string;

      console.log('[oidc/authorize] ✅ Authenticated via JWT for user:', userId);
    } catch (err) {
      console.error('[oidc/authorize] ❌ JWT verification failed:', err);
      return NextResponse.json({
        error: 'invalid_login_hint',
        error_description: 'JWT verification failed'
      }, { status: 401 });
    }
  } else {
    // Fall back to session check (standard OAuth flow)
    const supabase = await getServerAuth();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Redirect to login page with return URL
      const origin = getExternalOrigin(req);
      const loginUrl = new URL('/login', origin);
      const returnTo = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, origin);
      loginUrl.searchParams.set('returnTo', returnTo.toString());
      return NextResponse.redirect(loginUrl);
    }

    userId = session.user.id;
    console.log('[oidc/authorize] Authenticated via session for user:', userId);
  }

  // 3. Get User ID from public.users
  const [byId] = await db`SELECT id FROM users WHERE id = ${userId}`;
  let user = byId;

  if (!user) {
    try {
      const [byAuthUserId] = await db`
        SELECT id FROM users WHERE auth_user_id = ${userId}
      `;
      user = byAuthUserId;
    } catch (_err) {
      // Ignore if auth_user_id column doesn't exist.
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // 4. Generate Auth Code
  const code = await createAuthCode(user.id, clientId, redirectUri, {
    nonce,
    codeChallenge,
    codeChallengeMethod,
  });

  // 5. Redirect back to Client
  let finalRedirectUrl: string;

  if (redirectUrlFromState) {
    // We bypassed Social Login, so redirect directly to the Talk room
    // after Nextcloud completes the token exchange
    finalRedirectUrl = redirectUri;
    const callbackUrl = new URL(finalRedirectUrl);
    callbackUrl.searchParams.set('code', code);
    // Pass the Talk URL in state so Social Login can redirect after token exchange
    callbackUrl.searchParams.set('redirect_url', redirectUrlFromState);
    if (originalState) callbackUrl.searchParams.set('state', originalState);

    console.log('[oidc/authorize] ✅ Redirecting to Social Login callback with Talk URL');
    return NextResponse.redirect(callbackUrl);
  } else {
    // Standard OAuth flow
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', code);
    if (originalState) callbackUrl.searchParams.set('state', originalState);

    return NextResponse.redirect(callbackUrl);
  }
}
