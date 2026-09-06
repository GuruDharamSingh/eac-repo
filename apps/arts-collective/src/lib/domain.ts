/**
 * Host-header helpers shared by the middleware (Edge runtime) and the server
 * code that reads/writes org_domains.
 *
 * Everything here is pure string work with no imports on purpose: middleware
 * runs on the Edge runtime, so anything it touches must not drag in `pg`,
 * `node:*`, or the rest of @elkdonis/db.
 *
 * The network host itself comes from NEXT_PUBLIC_NETWORK_HOST (host, optional
 * port — `arts-collective.com` in production, `localhost:3007` in dev). It is
 * a NEXT_PUBLIC_ var so the same value is inlined into middleware, server
 * components, and client code alike; changing it needs a recompile, not just
 * an env reload.
 */

const DEFAULT_NETWORK_HOST = "localhost:3007";

/** Network host as configured, port included when there is one. */
export function networkHostWithPort(): string {
  return (process.env.NEXT_PUBLIC_NETWORK_HOST || DEFAULT_NETWORK_HOST)
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/\/.*$/, "");
}

/** Network host with the port stripped — what a Host header compares to. */
export function networkHost(): string {
  return networkHostWithPort().split(":")[0];
}

/**
 * Reduce a Host header to the form stored in org_domains.domain:
 * lowercase, no scheme, no port, no trailing dot, no path.
 *
 * Returns null for anything that can't be a public domain — an empty host, a
 * bare hostname with no dot (`localhost`, a Docker service name), or an IP
 * literal. Callers treat null as "not a custom domain, leave the request
 * alone", which is what keeps container-to-container and health-check traffic
 * working when it arrives on an unrecognised host.
 */
export function normalizeDomain(hostHeader: string | null | undefined): string | null {
  if (!hostHeader) return null;

  let host = hostHeader.trim().toLowerCase();
  if (!host) return null;

  // Strip a scheme if someone passed a full URL.
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Strip path/query.
  host = host.split("/")[0].split("?")[0];

  // Bracketed IPv6 literal — never a custom domain.
  if (host.startsWith("[")) return null;

  // Strip port.
  host = host.split(":")[0];
  // Strip a single trailing dot (fully-qualified form).
  host = host.replace(/\.$/, "");

  if (!host) return null;
  // Must have a dot: rules out `localhost` and Docker service hostnames.
  if (!host.includes(".")) return null;
  // Rule out IPv4 literals.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  // Basic sanity — labels of alphanumerics and hyphens.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;

  return host;
}

/**
 * Suffixes whose subdomains are resolved by slug rather than by lookup.
 * A host under one of these is handled by the existing subdomain path and is
 * never treated as a custom domain.
 */
export function networkSuffixes(): string[] {
  const host = networkHost();
  return host === "localhost" ? ["localhost"] : [host, "localhost"];
}

export function isNetworkHost(domain: string): boolean {
  return networkSuffixes().some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`)
  );
}

/**
 * Hosts that ARE the network itself — the apex and its www — as opposed to an
 * org's subdomain of it. Requests on these never carry an org slug.
 */
export function networkRootHosts(): Set<string> {
  const host = networkHost();
  const roots = new Set(["localhost", "127.0.0.1"]);
  if (host !== "localhost") {
    roots.add(host);
    roots.add(`www.${host}`);
  }
  return roots;
}
