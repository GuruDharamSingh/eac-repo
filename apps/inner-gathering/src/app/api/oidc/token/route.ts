import { NextRequest, NextResponse } from 'next/server';
import { CLIENTS, validateAuthCode, generateIdToken } from '@/lib/oidc';
import { db } from '@elkdonis/db';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

function getExternalOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  let body: Record<string, string>;

  if (contentType.includes('application/json')) {
    body = await req.json();
  } else {
    const formData = await req.formData();
    body = Object.fromEntries(formData) as Record<string, string>;
  }

  const { code, client_id, client_secret, redirect_uri, grant_type, code_verifier } = body;

  const client = CLIENTS[client_id];
  if (!client || client.secret !== client_secret) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }
  if (grant_type !== 'authorization_code') {
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const validated = await validateAuthCode(code, client_id, redirect_uri);
  if (!validated) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // PKCE validation
  if (validated.codeChallenge) {
    if (!code_verifier) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    const method = (validated.codeChallengeMethod || 'plain').toLowerCase();
    if (method === 's256') {
      const computed = createHash('sha256').update(code_verifier).digest()
        .toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      if (computed !== validated.codeChallenge) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }
    } else if (method === 'plain' && code_verifier !== validated.codeChallenge) {
      return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
    }
  }

  const [byId] = await db`SELECT id, email, display_name FROM users WHERE id = ${validated.userId}`;
  let user = byId;
  if (!user) {
    try {
      const [byAuth] = await db`SELECT id, email, display_name FROM users WHERE auth_user_id = ${validated.userId}`;
      user = byAuth;
    } catch { /* ignore */ }
  }
  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 400 });
  }

  const issuer = getExternalOrigin(req).replace(/\/$/, '');
  const idToken = await generateIdToken(user, client_id, issuer, validated.nonce);

  return NextResponse.json({
    access_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken,
  });
}
