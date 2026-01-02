import { NextRequest, NextResponse } from 'next/server';
import { CLIENTS, validateAuthCode, generateIdToken } from '@/lib/oidc';
import { db } from '@elkdonis/db';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  // Handle both JSON and Form Data (OIDC spec uses Form Data)
  let body;
  const contentType = req.headers.get('content-type') || '';

  console.log('[token] Content-Type:', contentType);

  if (contentType.includes('application/json')) {
    body = await req.json();
  } else {
    const formData = await req.formData();
    body = Object.fromEntries(formData);
  }

  const { code, client_id, client_secret, redirect_uri, grant_type, code_verifier } = body;

  console.log('[token] Request body:', {
    client_id,
    client_secret: client_secret ? client_secret.substring(0, 10) + '...' : 'none',
    redirect_uri,
    grant_type,
    code: code ? 'present' : 'missing',
  });

  // 1. Validate Client
  const client = CLIENTS[client_id];
  console.log('[token] Client found:', !!client);
  console.log('[token] Expected secret:', client?.secret ? client.secret.substring(0, 10) + '...' : 'none');
  console.log('[token] Secret match:', client?.secret === client_secret);

  if (!client || client.secret !== client_secret) {
    console.log('[token] Client validation failed');
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  if (grant_type !== 'authorization_code') {
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  // 2. Validate Code
  const validated = await validateAuthCode(code, client_id, redirect_uri);
  if (!validated) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // 2.1 Validate PKCE (if present on auth code)
  if (validated.codeChallenge) {
    if (!code_verifier || typeof code_verifier !== 'string') {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const method = (validated.codeChallengeMethod || 'plain').toLowerCase();
    if (method === 's256') {
      const hash = createHash('sha256').update(code_verifier).digest();
      const computed = base64UrlEncode(hash);
      if (computed !== validated.codeChallenge) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }
    } else if (method === 'plain') {
      if (code_verifier !== validated.codeChallenge) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
  }

  // 3. Get User Details
  const [byId] = await db`
    SELECT id, email, display_name FROM users WHERE id = ${validated.userId}
  `;
  let user = byId;
  if (!user) {
    try {
      const [byAuthUserId] = await db`
        SELECT id, email, display_name FROM users WHERE auth_user_id = ${validated.userId}
      `;
      user = byAuthUserId;
    } catch (_err) {
      // ignore if auth_user_id column doesn't exist
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 400 });
  }

  // 4. Generate Tokens
  const issuer = req.nextUrl.origin.replace(/\/$/, '');
  const idToken = await generateIdToken(user, client_id, issuer, validated.nonce);

  // For simplicity, we use the ID token as the access token too
  // In a full implementation, access_token would be opaque or a different JWT
  return NextResponse.json({
    access_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken
  });
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
