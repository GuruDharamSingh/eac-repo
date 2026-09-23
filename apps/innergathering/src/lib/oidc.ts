import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@elkdonis/db";

/**
 * The network's OpenID provider for Nextcloud ("Sign in with Elkdonis").
 *
 * Nextcloud's sociallogin points at https://elkdonis-arts.org/api/oidc/*.
 * These routes lived in apps/inner-gathering; when elkdonis-arts.org moved to
 * this app (2026-09-16) they 404'd, and with them the ONE place a person's
 * users.nextcloud_user_id gets recorded — so nobody new could be added to an
 * org's Nextcloud circle. Ported 2026-09-18 with the same behaviour and the
 * same uids ("elkdonis-<users.id>"), so existing Nextcloud accounts are untouched.
 *
 * Two deliberate differences from the original, both to avoid new packages on
 * the live site: HS256 JWTs are signed/verified with node:crypto instead of
 * `jose`, and userinfo's 60-second cache is in memory instead of Redis. The
 * tokens are byte-compatible with what `jose` produced.
 *
 * Secrets are read on first use, not at import, so `next build` doesn't need them.
 */

export interface OidcClient {
  id: string;
  secret: string;
  redirectUris: string[];
}

export interface ValidatedAuthCode {
  userId: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} environment variable is required for /api/oidc`);
  return v;
}

// Redirect URIs are all on the Nextcloud side — they must match what
// Nextcloud's sociallogin sends as redirect_uri during the code exchange.
function redirectUris(): string[] {
  const bases = [
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL,
    process.env.NEXTCLOUD_URL,
    process.env.NEXTCLOUD_PRODUCTION_URL,
  ].filter((u): u is string => Boolean(u));
  const paths = [
    "/apps/sociallogin/custom_oidc/elkdonis",
    "/apps/sociallogin/custom_oauth2/elkdonis",
    "/apps/sociallogin/custom_oidc/nextcloud",
    "/apps/sociallogin/custom_oauth2/nextcloud",
  ];
  return bases.flatMap((b) => paths.map((p) => `${b.replace(/\/$/, "")}${p}`));
}

/** The one client. `null` for anything else. */
export function getClient(clientId: string | null | undefined): OidcClient | null {
  if (clientId !== "nextcloud") return null;
  return { id: "nextcloud", secret: requireEnv("NEXTCLOUD_OIDC_SECRET"), redirectUris: redirectUris() };
}

/** Constant-time string compare, for the client secret. */
export function secretsMatch(a: string | undefined, b: string): boolean {
  if (typeof a !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The public origin, from the proxy's headers — not the container's address. */
export function externalOrigin(req: Request & { nextUrl?: URL }): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

// ── HS256 JWT ────────────────────────────────────────────────────────────────

const b64url = (buf: Buffer) => buf.toString("base64url");

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signHs256(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(Buffer.from(JSON.stringify({ alg: "HS256" })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${head}.${body}.${b64url(hmac(secret, `${head}.${body}`))}`;
}

/**
 * Verify an HS256 JWT: signature, exp/nbf, and (when given) issuer/audience.
 * Throws on any failure, like jose's jwtVerify.
 */
export function verifyHs256(
  token: string,
  secret: string,
  opts: { issuer?: string[]; audience?: string } = {}
): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [head, body, sig] = parts;
  const header = JSON.parse(Buffer.from(head, "base64url").toString());
  if (header.alg !== "HS256") throw new Error("unexpected alg");
  const expected = hmac(secret, `${head}.${body}`);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error("bad signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) throw new Error("expired");
  if (typeof payload.nbf === "number" && payload.nbf > now) throw new Error("not yet valid");
  if (opts.issuer && !opts.issuer.includes(String(payload.iss))) throw new Error("bad issuer");
  if (opts.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(opts.audience)) throw new Error("bad audience");
  }
  return payload;
}

export function jwtSecret(): string {
  return requireEnv("JWT_SECRET");
}

export function interAppSecret(): string {
  return requireEnv("INTER_APP_JWT_SECRET");
}

// ── auth codes (table oidc_codes) ────────────────────────────────────────────

export async function createAuthCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  ctx: { nonce?: string; codeChallenge?: string; codeChallengeMethod?: string } = {}
): Promise<string> {
  const code = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db`
    INSERT INTO oidc_codes (code, user_id, client_id, redirect_uri, expires_at,
                            nonce, code_challenge, code_challenge_method)
    VALUES (${code}, ${userId}, ${clientId}, ${redirectUri}, ${expiresAt},
            ${ctx.nonce ?? null}, ${ctx.codeChallenge ?? null}, ${ctx.codeChallengeMethod ?? null})
  `;
  return code;
}

/** Single use: a valid code is deleted as it is read. */
export async function validateAuthCode(
  code: string,
  client: OidcClient,
  redirectUri: string | undefined | null
): Promise<ValidatedAuthCode | null> {
  if (!code || !redirectUri || !client.redirectUris.includes(redirectUri)) return null;
  const [record] = await db<Array<{
    user_id: string; redirect_uri: string | null; nonce: string | null;
    code_challenge: string | null; code_challenge_method: string | null;
  }>>`
    DELETE FROM oidc_codes
    WHERE code = ${code} AND client_id = ${client.id} AND expires_at > NOW()
    RETURNING user_id, redirect_uri, nonce, code_challenge, code_challenge_method
  `;
  if (!record) return null;
  if (record.redirect_uri && record.redirect_uri !== redirectUri) return null;
  return {
    userId: record.user_id,
    nonce: record.nonce ?? undefined,
    codeChallenge: record.code_challenge ?? undefined,
    codeChallengeMethod: record.code_challenge_method ?? undefined,
  };
}

export async function findUser(id: string) {
  const [user] = await db<Array<{ id: string; email: string | null; display_name: string | null }>>`
    SELECT id, email, display_name FROM users WHERE id = ${id} OR auth_user_id = ${id} LIMIT 1
  `;
  return user ?? null;
}

export function generateIdToken(
  user: { id: string; email: string | null; display_name: string | null },
  clientId: string,
  issuer: string,
  nonce?: string
): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs256(
    {
      sub: user.id,
      name: user.display_name || user.email,
      email: user.email,
      email_verified: true,
      ...(nonce ? { nonce } : {}),
      iat: now,
      iss: issuer,
      aud: clientId,
      exp: now + 3600,
    },
    jwtSecret()
  );
}

// ── userinfo cache ───────────────────────────────────────────────────────────
// Hybridauth (inside sociallogin) sometimes sends a second userinfo request
// with no token. The original answered it from a 60s Redis cache keyed by the
// caller's IP; this app is one container, so a Map does the same job.

const CACHE_MS = 60_000;
const cache = new Map<string, { value: unknown; at: number }>();

export function cachePut(key: string, value: unknown) {
  cache.set(key, { value, at: Date.now() });
  if (cache.size > 500) {
    for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k);
  }
}

export function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit.value as T;
}
