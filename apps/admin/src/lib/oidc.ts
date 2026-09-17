import { db } from '@elkdonis/db';
import { SignJWT, jwtVerify } from 'jose';

// Configuration - JWT_SECRET is required, no fallbacks for security
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

export interface OidcClient {
  id: string;
  secret: string;
  redirectUris: string[];
  name: string;
  /**
   * May this client use the delegation grant — asking for a token that speaks
   * for a named human without that human being present at a browser?
   *
   * Only a courier needs it (OpenClaw relaying a DMARC-verified email). An
   * ordinary SSO client must never have it, because it turns a leaked client
   * secret from "can log people in" into "can act as anyone".
   */
  allowDelegation?: boolean;
}

export interface CreateAuthCodeContext {
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface ValidatedAuthCode {
  userId: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/**
 * The courier's secret. Absent means the client is simply not registered — a
 * box with no agent connected should not carry a usable credential, and the
 * delegation grant should not exist until someone deliberately turns it on.
 */
function getOpenclawOidcSecret(): string | null {
  return process.env.OPENCLAW_OIDC_SECRET || null;
}

// Get OIDC secret - required, no fallbacks for security
function getNextcloudOidcSecret(): string {
  const secret = process.env.NEXTCLOUD_OIDC_SECRET;
  if (!secret) {
    throw new Error('NEXTCLOUD_OIDC_SECRET environment variable is required');
  }
  return secret;
}

// Build OIDC redirect URIs dynamically from env vars
function getOidcRedirectUris(): string[] {
  const publicUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';
  const internalUrl = process.env.NEXTCLOUD_URL || '';
  const prodUrl = process.env.NEXTCLOUD_PRODUCTION_URL || '';

  const urls = [publicUrl, internalUrl, prodUrl].filter(Boolean);
  const paths = [
    '/apps/sociallogin/custom_oidc/elkdonis',
    '/apps/sociallogin/custom_oidc/nextcloud',
    '/apps/sociallogin/custom_oauth2/elkdonis',
    '/apps/sociallogin/custom_oauth2/nextcloud',
  ];

  return urls.flatMap((url) => paths.map((path) => `${url}${path}`));
}

// OIDC clients configuration (can be moved to DB later)
export const CLIENTS: Record<string, OidcClient> = {
  'nextcloud': {
    id: 'nextcloud',
    secret: getNextcloudOidcSecret(),
    redirectUris: getOidcRedirectUris(),
    name: 'Nextcloud'
  },
  // An external agent relaying requests from verified humans. It has no
  // redirect URIs because it never runs a browser flow — it uses the
  // delegation grant in /api/oidc/token instead.
  ...(getOpenclawOidcSecret()
    ? {
        openclaw: {
          id: 'openclaw',
          secret: getOpenclawOidcSecret()!,
          redirectUris: [],
          name: 'OpenClaw',
          allowDelegation: true,
        } satisfies OidcClient,
      }
    : {}),
};

/**
 * Generate an Authorization Code
 */
export async function createAuthCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  ctx?: CreateAuthCodeContext
) {
  const code = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await db`
      INSERT INTO oidc_codes (
        code,
        user_id,
        client_id,
        redirect_uri,
        expires_at,
        nonce,
        code_challenge,
        code_challenge_method
      )
      VALUES (
        ${code},
        ${userId},
        ${clientId},
        ${redirectUri},
        ${expiresAt},
        ${ctx?.nonce ?? null},
        ${ctx?.codeChallenge ?? null},
        ${ctx?.codeChallengeMethod ?? null}
      )
    `;
  } catch (_err) {
    // Backwards-compatible with older schema (no PKCE/nonce columns).
    await db`
      INSERT INTO oidc_codes (code, user_id, client_id, redirect_uri, expires_at)
      VALUES (${code}, ${userId}, ${clientId}, ${redirectUri}, ${expiresAt})
    `;
  }

  return code;
}

/**
 * Validate and consume an Authorization Code
 */
export async function validateAuthCode(
  code: string,
  clientId: string,
  redirectUri: string | undefined | null
): Promise<ValidatedAuthCode | null> {
  const client = CLIENTS[clientId];
  if (!client) return null;

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return null;
  }

  let record:
    | {
        user_id: string;
        client_id: string;
        redirect_uri: string | null;
        nonce?: string | null;
        code_challenge?: string | null;
        code_challenge_method?: string | null;
      }
    | undefined;

  try {
    const [r] = await db`
      SELECT
        user_id,
        client_id,
        redirect_uri,
        nonce,
        code_challenge,
        code_challenge_method
      FROM oidc_codes
      WHERE code = ${code}
        AND client_id = ${clientId}
        AND expires_at > NOW()
    `;
    record = (r as any) ?? undefined;
  } catch (_err) {
    const [r] = await db`
      SELECT user_id, client_id, redirect_uri
      FROM oidc_codes
      WHERE code = ${code}
        AND client_id = ${clientId}
        AND expires_at > NOW()
    `;
    record = (r as any) ?? undefined;
  }

  if (!record) return null;
  if (record.redirect_uri && record.redirect_uri !== redirectUri) return null;
  
  // Delete code so it can't be used again (replay attack protection)
  await db`DELETE FROM oidc_codes WHERE code = ${code}`;

  return {
    userId: record.user_id,
    nonce: record.nonce ?? undefined,
    codeChallenge: record.code_challenge ?? undefined,
    codeChallengeMethod: record.code_challenge_method ?? undefined,
  };
}

/**
 * Generate ID Token (JWT)
 */
export async function generateIdToken(
  user: any,
  clientId: string,
  issuer: string,
  nonce?: string
) {
  const now = Math.floor(Date.now() / 1000);

  const token = new SignJWT({
    sub: user.id,
    name: user.display_name || user.email,
    email: user.email,
    email_verified: true,
    ...(nonce ? { nonce } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setIssuer(issuer)
    .setAudience(clientId)
    .setExpirationTime(now + 3600); // 1 hour

  return await token.sign(JWT_SECRET);
}

export interface DelegatedClaims {
  /** users.id of the human the token speaks for. */
  userId: string;
  email: string;
  /** The courier that carried it — `act.sub`. */
  clientId: string;
  scope: string;
}

/**
 * Verify a token minted by generateDelegatedToken.
 *
 * Verification lives here, beside the minting, so no other package needs to
 * hold JWT_SECRET or know the token's shape. It deliberately REQUIRES `act` —
 * an ordinary SSO id_token, which this provider also signs with the same key,
 * must not be accepted as authority for an agent write.
 */
export async function verifyDelegatedToken(
  token: string,
  requiredScope: string
): Promise<DelegatedClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const act = payload.act as { sub?: string } | undefined;
    if (!act?.sub) return null;

    const client = CLIENTS[act.sub];
    if (!client?.allowDelegation) return null;

    // The audience is the courier, matching how the token was minted.
    const aud = payload.aud;
    const audiences = Array.isArray(aud) ? aud : aud ? [aud] : [];
    if (!audiences.includes(act.sub)) return null;

    const scopes = String(payload.scope ?? '').split(/\s+/).filter(Boolean);
    if (!scopes.includes(requiredScope)) return null;

    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;

    return {
      userId: payload.sub,
      email: payload.email,
      clientId: act.sub,
      scope: scopes.join(' '),
    };
  } catch {
    return null;
  }
}

/** How long a delegated token lives. Short: it is minted per action, not held. */
export const DELEGATION_TTL_SECONDS = 300;

/**
 * Mint a token that speaks FOR a user, carried BY a client.
 *
 * Shaped after RFC 8693 delegation: `sub` is the human, `act.sub` is the
 * courier that spoke on their behalf. Both halves stay legible downstream, so
 * a resource server can require "issued to a courier" rather than accepting
 * any token the provider ever signed.
 *
 * Same issuer, same signing key, same client registry as the browser flow —
 * this is an additional grant on the existing provider, not a second auth
 * system.
 */
export async function generateDelegatedToken(
  user: any,
  clientId: string,
  issuer: string,
  scope: string
) {
  const now = Math.floor(Date.now() / 1000);

  const token = new SignJWT({
    sub: user.id,
    name: user.display_name || user.email,
    email: user.email,
    email_verified: true,
    act: { sub: clientId },
    scope,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setIssuer(issuer)
    .setAudience(clientId)
    .setExpirationTime(now + DELEGATION_TTL_SECONDS);

  return await token.sign(JWT_SECRET);
}
