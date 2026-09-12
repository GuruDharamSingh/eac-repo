// ============================================================================
// The client-side half of the network's SSO — pure string-building, no
// server import (this package ships to the browser). The server half
// (verifying and setting cookies) lives in @elkdonis/auth-server's
// handoff.ts; this file only builds the URLs a real login flow follows.
//
// The trick: a fresh sign-in on one site should also leave a session on the
// network host, so a LATER visit to a different site can find it. Rather
// than writing a third code path, this composes the existing handoff twice:
// leave here for the network host (which, once signed in there too,
// immediately hands back) — see mirrorLoginHref.
// ============================================================================

/** The network host's origin (e.g. https://arts-collective.com), or null if unset. */
export function networkOrigin(): string | null {
  const host = process.env.NEXT_PUBLIC_NETWORK_HOST;
  if (!host) return null;
  const bare = host.split(':')[0];
  const proto = bare === 'localhost' || bare === '127.0.0.1' ? 'http' : 'https';
  return `${proto}://${host}`;
}

/** A relative link that leaves THIS site carrying the session — see handleHandoffStart. */
export function handoffHref(to: string, next: string): string {
  const q = new URLSearchParams({ to, next });
  return `/api/auth/handoff?${q.toString()}`;
}

/**
 * Where a fresh sign-in should land so the session is mirrored onto the
 * network host on the way there: this site → network host (now signed in
 * there too) → immediately back here, at `finalPath`. Falls back to
 * `finalPath` unchanged when there is no network host configured, or this
 * already is it.
 */
export function mirrorLoginHref(hereOrigin: string, finalPath: string): string {
  const central = networkOrigin();
  if (!central || hereOrigin.replace(/\/$/, '') === central.replace(/\/$/, '')) return finalPath;
  const back = handoffHref(hereOrigin, finalPath); // relative — safe as the outer `next`
  return handoffHref(central, back);
}
