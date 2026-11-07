import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Session as SupabaseSession, SupabaseClient } from '@supabase/supabase-js';

/**
 * Session verification (2026-11-01).
 *
 * `supabase.auth.getSession()` reads the session out of the cookie and hands
 * it back as-is: nothing checks the access token's signature, so anyone can
 * write a cookie naming any user id and be that user. This module is the one
 * door every server-side "who is this?" goes through instead.
 *
 * With JWT_SECRET set (the secret GoTrue signs with), the access token is
 * verified locally: HS256 signature, expiry, audience, subject. Without it,
 * the token is sent to GoTrue (`auth.getUser(token)`), which costs a round
 * trip but is just as strict. Either way an unverifiable token is no session.
 */

/** Any Supabase client (server, route or admin); only its auth API is used. */
type AuthCarrier = Pick<SupabaseClient, 'auth'>;

const AUDIENCE = process.env.GOTRUE_JWT_AUD || 'authenticated';
/** Tolerated clock skew, seconds. */
const LEEWAY = 30;

export interface VerifiedClaims {
  /** Supabase Auth user id. */
  sub: string;
  email?: string;
  role?: string;
  exp: number;
  iat?: number;
  session_id?: string;
}

export interface VerifiedSession {
  session: SupabaseSession;
  claims: VerifiedClaims;
}

let warnedNoSecret = false;

function sessionSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (!warnedNoSecret) {
    warnedNoSecret = true;
    console.warn('[auth-server] JWT_SECRET is not set; verifying sessions through GoTrue instead (one request per check)');
  }
  return null;
}

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Verify a GoTrue access token against the shared secret. Returns its claims,
 * or null when the token is malformed, not HS256, wrongly signed, expired,
 * for another audience, or has no subject (the anon and service-role keys).
 */
export function verifyAccessToken(token: string, secret: string): VerifiedClaims | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;

  const header = decodeSegment(head);
  if (!header || header.alg !== 'HS256') return null;

  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const payload = decodeSegment(body);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + LEEWAY <= now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf - LEEWAY > now) return null;

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(AUDIENCE)) return null;

  if (typeof payload.sub !== 'string' || !payload.sub) return null;

  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    exp: payload.exp,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    session_id: typeof payload.session_id === 'string' ? payload.session_id : undefined,
  };
}

/** Ask GoTrue whether the token is good; used only when JWT_SECRET is absent. */
async function verifyWithGoTrue(supabase: AuthCarrier, token: string): Promise<VerifiedClaims | null> {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    const unverified = decodeSegment(token.split('.')[1] ?? '') ?? {};
    return {
      sub: data.user.id,
      email: data.user.email ?? undefined,
      role: data.user.role ?? undefined,
      exp: typeof unverified.exp === 'number' ? unverified.exp : 0,
      iat: typeof unverified.iat === 'number' ? unverified.iat : undefined,
      session_id: typeof unverified.session_id === 'string' ? unverified.session_id : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The cookie's session, only if its access token is genuine and belongs to
 * the user the cookie names. Use this wherever server code would otherwise
 * call `supabase.auth.getSession()` to decide who someone is.
 *
 * getSession() still runs first because it refreshes an expired token with
 * the refresh token (a GoTrue call that a forged cookie cannot pass).
 */
export async function getVerifiedSession(supabase: AuthCarrier): Promise<VerifiedSession | null> {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.access_token || !session.user?.id) return null;

  const secret = sessionSecret();
  const claims = secret
    ? verifyAccessToken(session.access_token, secret)
    : await verifyWithGoTrue(supabase, session.access_token);

  if (!claims || claims.sub !== session.user.id) return null;
  return { session, claims };
}
