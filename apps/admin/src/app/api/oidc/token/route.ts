import { NextRequest, NextResponse } from 'next/server';
import {
  CLIENTS,
  validateAuthCode,
  generateIdToken,
  generateDelegatedToken,
  DELEGATION_TTL_SECONDS,
} from '@/lib/oidc';
import { db } from '@elkdonis/db';
import { createHash } from 'crypto';

/** RFC 8693's grant name, reused rather than invented. */
const DELEGATION_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const DEFAULT_DELEGATION_SCOPE = 'agent.post';

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

  const {
    code,
    client_id,
    client_secret,
    redirect_uri,
    grant_type,
    code_verifier,
    subject_email,
    scope,
  } = body;

  console.log('[token] Request body:', {
    client_id,
    redirect_uri,
    grant_type,
    code: code ? 'present' : 'missing',
  });

  // 1. Validate Client
  const client = CLIENTS[client_id];
  if (!client || client.secret !== client_secret) {
    console.log('[token] Client validation failed for:', client_id);
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  // Delegation: a courier asking for a token that speaks for a named human who
  // is not at a browser. Gated on the client registry's allowDelegation, so
  // adding an SSO client never accidentally adds this power.
  if (grant_type === DELEGATION_GRANT) {
    if (!client.allowDelegation) {
      console.log('[token] delegation refused for client:', client_id);
      return NextResponse.json({ error: 'unauthorized_client' }, { status: 403 });
    }
    if (!subject_email || typeof subject_email !== 'string') {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    // The email is the join key: whoever the courier verified must already be
    // a user here. It grants nothing on its own — roles are read per request
    // by whatever the token is then presented to.
    const [subject] = await db`
      SELECT id, email, display_name FROM users WHERE lower(email) = lower(${subject_email})
    `;
    if (!subject) {
      return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
    }

    const delegationIssuer = req.nextUrl.origin.replace(/\/$/, '');
    const delegated = await generateDelegatedToken(
      subject,
      client_id,
      delegationIssuer,
      typeof scope === 'string' && scope ? scope : DEFAULT_DELEGATION_SCOPE
    );

    return NextResponse.json({
      access_token: delegated,
      token_type: 'Bearer',
      expires_in: DELEGATION_TTL_SECONDS,
    });
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
