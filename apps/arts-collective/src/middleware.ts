import { NextRequest, NextResponse } from "next/server";

const ROOT_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "artscollective.com",
  "www.artscollective.com",
]);

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "hub",
  "app",
]);

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
]);

function extractSubdomain(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const hostNoPort = hostHeader.split(":")[0].toLowerCase();
  if (ROOT_HOSTS.has(hostNoPort)) return null;

  const parts = hostNoPort.split(".");
  if (parts.length < 2) return null;

  if (hostNoPort.endsWith(".localhost")) {
    const sub = parts.slice(0, -1).join(".");
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  if (parts.length >= 3 && parts.slice(-2).join(".") === "artscollective.com") {
    const sub = parts.slice(0, -2).join(".");
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  return null;
}

export function middleware(req: NextRequest) {
  const subdomain = extractSubdomain(req.headers.get("host"));
  if (!subdomain) return NextResponse.next();

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname === "/" || pathname === "") {
    url.pathname = `/sites/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // Rewrite content slug paths on subdomains.
  // Single-segment paths like /my-workshop → /sites/acme/my-workshop
  // so the per-thread route can handle them.
  // Multi-segment paths (/_next, /api, etc.) are already excluded by the matcher.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1 && !PASSTHROUGH_PATHS.has(segments[0])) {
    url.pathname = `/sites/${subdomain}/${segments[0]}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
