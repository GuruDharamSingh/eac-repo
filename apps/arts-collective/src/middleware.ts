import { NextRequest, NextResponse } from "next/server";
import { RESERVED_SLUGS } from "@elkdonis/utils/reserved-slugs";
import {
  isNetworkHost,
  networkHost,
  networkRootHosts,
  normalizeDomain,
} from "@/lib/domain";

/**
 * Subdomains of the network host that are infrastructure, not orgs —
 * `artdirect.arts-collective.com` is a separate app, `www` is the network
 * itself. Shares the one reserved list with users.slug and organizations.slug
 * (packages/utils/src/reserved-slugs.ts), imported by subpath so the Edge
 * bundle takes only that pure module and none of the sanitizers.
 */
const RESERVED_SUBDOMAINS = RESERVED_SLUGS;

// Top-level app routes that must never be rewritten to /sites/[slug]/[path].
// These paths exist at the root of the Next.js app and should render as-is
// even when accessed from a subdomain host.
const PASSTHROUGH_PATHS = new Set([
  "login",
  "signup",
  "hub",
  "account",
  "wizard",
  "inner-temple",
  "preview",
  "edit",
  "auth",
  "complete",
  "artists",
  "commitments",
  "sites",
  "directory",
]);

function extractSubdomain(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const hostNoPort = hostHeader.split(":")[0].toLowerCase();
  if (networkRootHosts().has(hostNoPort)) return null;

  const parts = hostNoPort.split(".");
  if (parts.length < 2) return null;

  if (hostNoPort.endsWith(".localhost")) {
    const sub = parts.slice(0, -1).join(".");
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  const network = networkHost();
  if (network !== "localhost" && hostNoPort.endsWith(`.${network}`)) {
    const sub = hostNoPort.slice(0, -(network.length + 1));
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  return null;
}

/**
 * domain → org slug, fetched from /api/domains and cached in module scope.
 *
 * Middleware is Edge runtime, so it cannot query Postgres directly. A single
 * Edge instance serves many requests, so this cache means one lookup per
 * instance per TTL rather than one per request.
 *
 * On any fetch failure the previous map is reused, and if there is no previous
 * map the request falls through untouched. A custom domain briefly serving the
 * network landing page is a far better failure than every request 500ing.
 */
const DOMAIN_TTL_MS = 60_000;
let domainCache: Record<string, string> | null = null;
let domainCacheAt = 0;
let inflight: Promise<Record<string, string> | null> | null = null;

async function getDomainMap(origin: string): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (domainCache && now - domainCacheAt < DOMAIN_TTL_MS) return domainCache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(new URL("/api/domains", origin), {
        headers: { accept: "application/json" },
        // Middleware keeps its own cache; don't let the data layer add another.
        cache: "no-store",
      });
      if (!res.ok) return domainCache;
      const body = (await res.json()) as { domains?: Record<string, string> };
      if (!body?.domains) return domainCache;
      domainCache = body.domains;
      domainCacheAt = Date.now();
      return domainCache;
    } catch {
      return domainCache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * `customDomain` is set when the request arrived on the org's own domain (as
 * opposed to its network subdomain). It is forwarded as `x-org-domain` so
 * /sites/[slug] knows the visitor is already at the org's home and must not
 * redirect them there again.
 */
function rewriteForOrg(
  req: NextRequest,
  slug: string,
  customDomain?: string
): NextResponse {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  const requestHeaders = new Headers(req.headers);
  if (customDomain) requestHeaders.set("x-org-domain", customDomain);
  const init = { request: { headers: requestHeaders } };

  if (pathname === "/" || pathname === "") {
    url.pathname = `/sites/${slug}`;
    return NextResponse.rewrite(url, init);
  }

  // Rewrite org-host paths onto the org's site tree:
  //   /my-workshop            → /sites/acme/my-workshop        (a thread)
  //   /workshop/my-workshop   → /sites/acme/workshop/my-workshop (its workspace)
  //
  // Keyed on the FIRST segment only. Restricting this to single-segment paths
  // (as it was) meant every nested org page 404'd on its own subdomain — the
  // workshop workspace is the first one to need two.
  //
  // /api, /_next and file requests never reach here; the matcher excludes them.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && !PASSTHROUGH_PATHS.has(segments[0])) {
    url.pathname = `/sites/${slug}/${segments.join("/")}`;
    return NextResponse.rewrite(url, init);
  }

  return NextResponse.next(init);
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host");

  // 1. Network subdomain (acme.arts-collective.com) — slug is in the hostname.
  const subdomain = extractSubdomain(host);
  if (subdomain) return rewriteForOrg(req, subdomain);

  // 2. Custom full domain (amritcanada.ca) — slug comes from org_domains.
  const domain = normalizeDomain(host);
  if (!domain || isNetworkHost(domain)) return NextResponse.next();

  const map = await getDomainMap(req.nextUrl.origin);
  const slug = map?.[domain];
  if (!slug) return NextResponse.next();

  return rewriteForOrg(req, slug, domain);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
