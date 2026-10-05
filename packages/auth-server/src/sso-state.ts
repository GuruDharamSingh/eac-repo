// ============================================================================
// Network sign-in state shared by the handoff routes, getServerSession and
// the per-app proxy (sso-proxy.ts). No next/headers import: sso-proxy.ts
// bundles this file on its own.
//
// Two pieces of state:
//
// - `eac_sso` cookie, host-only, one per site. Records what the proxy last did
//   on this host so it runs at most once per visit:
//     a.<epoch>  signed out here; asked the network host at <epoch>
//     m.<epoch>  signed in here; the network host was brought up to date
//
// - Redis `sso:signed-out:<authUserId>` = epoch seconds of the person's last
//   sign-out on any site. Any access token issued before it is treated as
//   signed out on every site, which is what makes a sign-out network-wide:
//   GoTrue's global sign-out revokes refresh tokens, but access tokens held in
//   other sites' cookies stay valid until they expire (up to an hour).
// ============================================================================

export const SSO_COOKIE = 'eac_sso';
/** Arrival notice: id of the network_arrivals row the notice describes. */
export const ARRIVAL_COOKIE = 'eac_arrival';

const SIGNED_OUT_PREFIX = 'sso:signed-out:';
/** Longer than any refresh-token-backed session is kept, so a stale cookie cannot outlive it. */
const SIGNED_OUT_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SsoCookieState = { state: 'a' | 'm'; at: number } | null;

export function parseSsoCookie(value: string | undefined): SsoCookieState {
  if (!value) return null;
  const [state, at] = value.split('.');
  const n = Number(at);
  if ((state !== 'a' && state !== 'm') || !Number.isFinite(n)) return null;
  return { state, at: n };
}

export function ssoCookieValue(state: 'a' | 'm'): string {
  return `${state}.${Math.floor(Date.now() / 1000)}`;
}

/** The network host's origin (e.g. https://arts-collective.com), or null if unset. */
export function networkOriginFromEnv(): string | null {
  const host = process.env.NEXT_PUBLIC_NETWORK_HOST;
  if (!host) return null;
  const bare = host.split(':')[0];
  const proto = bare === 'localhost' || bare === '127.0.0.1' ? 'http' : 'https';
  return `${proto}://${host}`;
}

/** Payload of a JWT, unverified. Only for reading `sub`/`iat` of a token already trusted elsewhere. */
export function jwtPayload(token: string | undefined | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Record a sign-out that applies on every site. Soft-fails without Redis. */
export async function markSignedOutEverywhere(authUserId: string): Promise<void> {
  try {
    const { getRedisClient } = await import('@elkdonis/redis');
    await getRedisClient().set(
      `${SIGNED_OUT_PREFIX}${authUserId}`,
      String(Math.floor(Date.now() / 1000)),
      'EX',
      SIGNED_OUT_TTL_SECONDS
    );
  } catch (err) {
    console.warn('[sso] could not record network sign-out:', (err as Error).message);
  }
}

/**
 * True when this access token was issued before the person's last sign-out
 * anywhere on the network. Redis unavailable → false (the session stands),
 * the same posture the session cache takes.
 */
export async function isSignedOutEverywhere(accessToken: string | undefined | null): Promise<boolean> {
  const payload = jwtPayload(accessToken);
  const sub = typeof payload?.sub === 'string' ? payload.sub : null;
  const iat = typeof payload?.iat === 'number' ? payload.iat : null;
  if (!sub || iat === null) return false;
  try {
    const { getRedisClient } = await import('@elkdonis/redis');
    const at = await getRedisClient().get(`${SIGNED_OUT_PREFIX}${sub}`);
    return at !== null && iat < Number(at);
  } catch {
    return false;
  }
}
