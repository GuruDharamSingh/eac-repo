/**
 * Where to send someone for an org — pure, client-safe.
 *
 * An org with a verified primary custom domain lives there (whether that is
 * served by arts-collective or by the org's own app). Otherwise it lives at
 * its network subdomain. Nothing here touches the database: callers get
 * `primaryDomain` from @elkdonis/services (`listOrgHomes`, `getOrgHomeBySlug`)
 * or the server composer in ./org-url.server.ts.
 */

import { networkHostWithPort } from "@/lib/domain";

function protocolFor(host: string): "http" | "https" {
  return /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
}

/** `https://arts-collective.com` (or `http://localhost:3007` in dev). */
export function networkUrl(): string {
  const host = networkHostWithPort();
  return `${protocolFor(host)}://${host}`;
}

/** Bare network host for copy like "yourname.arts-collective.com". */
export function networkHostLabel(): string {
  return networkHostWithPort();
}

export function getOrgHomeUrl(org: {
  slug: string;
  primaryDomain?: string | null;
}): string {
  if (org.primaryDomain) return `https://${org.primaryDomain}`;
  const host = networkHostWithPort();
  return `${protocolFor(host)}://${org.slug}.${host}`;
}
