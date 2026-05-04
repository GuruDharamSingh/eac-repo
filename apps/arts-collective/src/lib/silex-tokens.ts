import { nanoid } from "nanoid";
import {
  consumeOneTimeToken,
  ONE_TIME_TOKEN_DEFAULT_TTL,
  peekOneTimeToken,
  storeOneTimeToken,
} from "@elkdonis/redis";

/**
 * Silex auth-bridge tokens (plan.md §Q3 option i).
 *
 * A signed-in owner requests a token from POST /api/silex/token; the token
 * carries the artist's per-user Nextcloud credentials in Redis under a short
 * TTL. The Silex connector later redeems it once via GET /api/silex/auth to
 * obtain creds + project/published paths, then talks to Nextcloud directly
 * as that user.
 *
 * Tokens are single-use. `peekSilexToken` is for diagnostics only.
 * Domain type stays app-local; the generic one-time-token mechanism lives
 * in @elkdonis/redis.
 */

const TOKEN_PREFIX = "silex";
export const SILEX_TOKEN_TTL_SECONDS = ONE_TIME_TOKEN_DEFAULT_TTL;

export interface SilexTokenPayload {
  userId: string;
  orgId: string;
  slug: string;
  ncUser: string;
  ncPass: string;
  nextcloudFolderPath: string;
  issuedAt: number;
}

export async function mintSilexToken(
  payload: Omit<SilexTokenPayload, "issuedAt">,
  ttlSeconds: number = SILEX_TOKEN_TTL_SECONDS
): Promise<string> {
  const token = nanoid(32);
  await storeOneTimeToken<SilexTokenPayload>(
    TOKEN_PREFIX,
    token,
    { ...payload, issuedAt: Date.now() },
    ttlSeconds
  );
  return token;
}

/** Consume (read + delete) a token. Returns null if missing or already used. */
export async function consumeSilexToken(
  token: string
): Promise<SilexTokenPayload | null> {
  return consumeOneTimeToken<SilexTokenPayload>(TOKEN_PREFIX, token);
}

/** Diagnostics only — does NOT delete. */
export async function peekSilexToken(
  token: string
): Promise<SilexTokenPayload | null> {
  return peekOneTimeToken<SilexTokenPayload>(TOKEN_PREFIX, token);
}
