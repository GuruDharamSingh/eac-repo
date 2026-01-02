import { NextRequest, NextResponse } from 'next/server';
import { CLIENTS, createAuthCode } from '@/lib/oidc';
import { db } from '@elkdonis/db';
import { getServerAuth } from '@elkdonis/auth-server';

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

  // 2. Check Authentication
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

  // 3. Get User ID from public.users
  const [byId] = await db`SELECT id FROM users WHERE id = ${session.user.id}`;
  let user = byId;

  if (!user) {
    try {
      const [byAuthUserId] = await db`
        SELECT id FROM users WHERE auth_user_id = ${session.user.id}
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
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl);
}
