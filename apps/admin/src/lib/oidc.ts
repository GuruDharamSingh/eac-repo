import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

// Configuration - use same default as docker-compose.yml
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-token-with-at-least-32-characters');

export interface OidcClient {
  id: string;
  secret: string;
  redirectUris: string[];
  name: string;
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

// Hardcoded clients for now (can be moved to DB later)
export const CLIENTS: Record<string, OidcClient> = {
  'nextcloud': {
    id: 'nextcloud',
    secret: process.env.NEXTCLOUD_OIDC_SECRET || 'nextcloud-secret',
    redirectUris: [
      'http://localhost:8080/apps/sociallogin/custom_oidc/elkdonis',
      'http://localhost:8080/apps/sociallogin/custom_oidc/nextcloud',
      'http://localhost:8080/apps/sociallogin/custom_oauth2/elkdonis',
      'http://localhost:8080/apps/sociallogin/custom_oauth2/nextcloud',
      'http://192.168.0.179:8080/apps/sociallogin/custom_oidc/elkdonis',
      'http://192.168.0.179:8080/apps/sociallogin/custom_oidc/nextcloud',
      'http://192.168.0.179:8080/apps/sociallogin/custom_oauth2/elkdonis',
      'http://192.168.0.179:8080/apps/sociallogin/custom_oauth2/nextcloud',
      'http://nextcloud-nginx:80/apps/sociallogin/custom_oidc/elkdonis',
      'http://nextcloud-nginx:80/apps/sociallogin/custom_oauth2/elkdonis',
      'https://cloud.elkdonis.com/apps/sociallogin/custom_oidc/elkdonis',
      'https://cloud.elkdonis.com/apps/sociallogin/custom_oauth2/elkdonis'
    ],
    name: 'Nextcloud'
  }
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
