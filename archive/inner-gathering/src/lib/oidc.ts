import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

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

function getNextcloudOidcSecret(): string {
  const secret = process.env.NEXTCLOUD_OIDC_SECRET;
  if (!secret) throw new Error('NEXTCLOUD_OIDC_SECRET environment variable is required');
  return secret;
}

// Redirect URIs are all on the Nextcloud side — these must match what Nextcloud's
// sociallogin app sends as redirect_uri during the OAuth code exchange.
function getOidcRedirectUris(): string[] {
  const ncPublic = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';
  const ncInternal = process.env.NEXTCLOUD_URL || '';
  const ncProd = process.env.NEXTCLOUD_PRODUCTION_URL || '';
  const urls = [ncPublic, ncInternal, ncProd].filter(Boolean);
  const paths = [
    '/apps/sociallogin/custom_oidc/elkdonis',
    '/apps/sociallogin/custom_oauth2/elkdonis',
    '/apps/sociallogin/custom_oidc/nextcloud',
    '/apps/sociallogin/custom_oauth2/nextcloud',
  ];
  return urls.flatMap((url) => paths.map((p) => `${url}${p}`));
}

export const CLIENTS: Record<string, OidcClient> = {
  nextcloud: {
    id: 'nextcloud',
    secret: getNextcloudOidcSecret(),
    redirectUris: getOidcRedirectUris(),
    name: 'Nextcloud',
  },
};

export async function createAuthCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  ctx?: CreateAuthCodeContext
) {
  const code = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  try {
    await db`
      INSERT INTO oidc_codes (
        code, user_id, client_id, redirect_uri, expires_at,
        nonce, code_challenge, code_challenge_method
      ) VALUES (
        ${code}, ${userId}, ${clientId}, ${redirectUri}, ${expiresAt},
        ${ctx?.nonce ?? null}, ${ctx?.codeChallenge ?? null}, ${ctx?.codeChallengeMethod ?? null}
      )
    `;
  } catch {
    await db`
      INSERT INTO oidc_codes (code, user_id, client_id, redirect_uri, expires_at)
      VALUES (${code}, ${userId}, ${clientId}, ${redirectUri}, ${expiresAt})
    `;
  }
  return code;
}

export async function validateAuthCode(
  code: string,
  clientId: string,
  redirectUri: string | undefined | null
): Promise<ValidatedAuthCode | null> {
  const client = CLIENTS[clientId];
  if (!client) return null;
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) return null;

  let record: any;
  try {
    const [r] = await db`
      SELECT user_id, client_id, redirect_uri, nonce, code_challenge, code_challenge_method
      FROM oidc_codes
      WHERE code = ${code} AND client_id = ${clientId} AND expires_at > NOW()
    `;
    record = r;
  } catch {
    const [r] = await db`
      SELECT user_id, client_id, redirect_uri
      FROM oidc_codes
      WHERE code = ${code} AND client_id = ${clientId} AND expires_at > NOW()
    `;
    record = r;
  }

  if (!record) return null;
  if (record.redirect_uri && record.redirect_uri !== redirectUri) return null;

  await db`DELETE FROM oidc_codes WHERE code = ${code}`;

  return {
    userId: record.user_id,
    nonce: record.nonce ?? undefined,
    codeChallenge: record.code_challenge ?? undefined,
    codeChallengeMethod: record.code_challenge_method ?? undefined,
  };
}

export async function generateIdToken(
  user: any,
  clientId: string,
  issuer: string,
  nonce?: string
) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
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
    .setExpirationTime(now + 3600)
    .sign(JWT_SECRET);
}
