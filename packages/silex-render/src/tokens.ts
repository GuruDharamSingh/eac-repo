import { nanoid } from "nanoid";
import {
  consumeOneTimeToken,
  ONE_TIME_TOKEN_DEFAULT_TTL,
  peekOneTimeToken,
  storeOneTimeToken,
} from "@elkdonis/redis";

/**
 * Silex auth-bridge tokens.
 *
 * A signed-in owner requests a token (POST /api/silex/token on whichever app
 * they are standing in); the token carries the service account's Nextcloud
 * credentials and the org's folder in Redis under a short TTL. The Silex
 * connector redeems it exactly once via arts-collective's GET /api/silex/auth
 * and talks to Nextcloud directly from then on.
 *
 * Lives in the shared Silex package rather than in one app because MINTING
 * and REDEEMING happen in different places: any per-org app can mint (a
 * hidden-enneagram editor opens the editor from hiddenenneagram.com), while
 * the connector always redeems against arts-collective. Redis is the bridge,
 * and the prefix below is the contract — a token minted here by one app is
 * readable by the redeem route on another only because both use this file.
 *
 * Tokens are single-use. `peekSilexToken` is for diagnostics only.
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
