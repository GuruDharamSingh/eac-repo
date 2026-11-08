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

/**
 * An item's own page on the org's network subdomain: `https://<org>.<network>/<item slug>`.
 * Checked over HTTP on 2026-11-08 for offerings (oad, hidden-enneagram) and series (sunjay,
 * ifac): every one answered 200 there, while `<custom domain>/<slug>` answered 404 on all
 * three custom domains (their own apps route items under feeds or /series). The subdomain is
 * always served by this app, whose `/[contentSlug]` route renders any public thread. When a
 * site record (ContentHost) can say where an org prefers its items, use that instead.
 */
export function networkItemUrl(orgSlug: string, itemSlug: string): string {
  return `${getOrgHomeUrl({ slug: orgSlug })}/${itemSlug}`;
}

export function getOrgHomeUrl(org: {
  slug: string;
  primaryDomain?: string | null;
}): string {
  if (org.primaryDomain) return `https://${org.primaryDomain}`;
  const host = networkHostWithPort();
  return `${protocolFor(host)}://${org.slug}.${host}`;
}
