/**
 * The middleware's (host, path) → outcome table, run against the real
 * src/middleware.ts with /api/domains stubbed. No server, no DB.
 *
 *   cd apps/arts-collective && node ../../node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/tenant-paths-check.ts
 *
 * Exits 1 on any mismatch.
 */
process.env.NEXT_PUBLIC_NETWORK_HOST = "arts-collective.com";

import { NextRequest } from "next/server";

const DOMAINS: Record<string, string> = { "shellorg.example": "tara" };
globalThis.fetch = (async (input: unknown) => {
  const url = String(input instanceof URL ? input.href : input);
  if (url.endsWith("/api/domains")) return new Response(JSON.stringify({ domains: DOMAINS }), { status: 200 });
  throw new Error(`unexpected fetch ${url}`);
}) as typeof fetch;

type Expect =
  | { next: true }
  | { rewrite: string }
  | { redirect: string; status?: number }
  | { status: number };

const C = "https://arts-collective.com";
const SUB = "tara.arts-collective.com";
const DOM = "shellorg.example";

const CASES: Array<[host: string, path: string, expect: Expect, headers?: Record<string, string>]> = [
  // ── <org>.arts-collective.com ──
  [SUB, "/", { rewrite: "/sites/tara" }],
  [SUB, "/hub", { rewrite: "/sites/tara/hub" }],
  [SUB, "/hub/members", { rewrite: "/sites/tara/hub/members" }],
  [SUB, "/hub/members?tab=people", { rewrite: "/sites/tara/hub/members?tab=people" }],
  [SUB, "/hub/review", { rewrite: "/sites/tara/hub/review" }],
  [SUB, "/hub/organization", { redirect: `${C}/hub/organization?org=tara` }],
  [SUB, "/hub/admin", { redirect: `${C}/hub/admin?org=tara` }],
  [SUB, "/hub/sites/ifac/design", { redirect: `${C}/hub/sites/ifac/design?org=tara` }],
  [SUB, "/login", { next: true }],
  [SUB, "/login?next=/hub", { next: true }],
  [SUB, "/signup", { next: true }],
  [SUB, "/account", { next: true }],
  [SUB, "/bookings/tok123", { next: true }],
  [SUB, "/api/x", { next: true }],
  [SUB, "/_next/x", { next: true }],
  [SUB, "/channel", { redirect: `${C}/channel?org=tara` }],
  [SUB, "/channel/queue?org=tara", { redirect: `${C}/channel/queue?org=tara` }],
  [SUB, "/studio", { redirect: `${C}/studio?org=tara` }],
  [SUB, "/studio?kind=post", { redirect: `${C}/studio?kind=post&org=tara` }],
  [SUB, "/email", { redirect: `${C}/email?org=tara` }],
  [SUB, "/directory", { redirect: `${C}/directory` }],
  [SUB, "/directory/people", { redirect: `${C}/directory/people` }],
  [SUB, "/artists", { redirect: `${C}/artists` }],
  [SUB, "/wizard", { redirect: `${C}/wizard` }],
  [SUB, "/learn/x", { redirect: `${C}/learn/x` }],
  [SUB, "/sites", { status: 404 }],
  [SUB, "/sites/ifac", { status: 404 }],
  [SUB, "/sites/ifac/hub", { status: 404 }],
  [SUB, "/sites/tara/offering", { redirect: `https://${SUB}/offering`, status: 308 }],
  [SUB, "/manage", { redirect: `https://${SUB}/hub` }],
  [SUB, "/manage/people", { redirect: `https://${SUB}/hub` }],
  [SUB, "/center", { rewrite: "/sites/tara/center" }],
  [SUB, "/my-post", { rewrite: "/sites/tara/my-post" }],
  [SUB, "/workshop/w1", { rewrite: "/sites/tara/workshop/w1" }],
  // ── custom domain (org_domains → tara) ──
  [DOM, "/", { rewrite: "/sites/tara" }],
  [DOM, "/hub", { rewrite: "/sites/tara/hub" }],
  [DOM, "/hub/members", { rewrite: "/sites/tara/hub/members" }],
  [DOM, "/hub/organization", { redirect: `${C}/hub/organization?org=tara` }],
  [DOM, "/login", { next: true }],
  [DOM, "/api/x", { next: true }],
  [DOM, "/_next/x", { next: true }],
  [DOM, "/channel", { redirect: `${C}/channel?org=tara` }],
  [DOM, "/studio", { redirect: `${C}/studio?org=tara` }],
  [DOM, "/directory", { redirect: `${C}/directory` }],
  [DOM, "/sites/ifac", { status: 404 }],
  // ── unknown custom domain: untouched ──
  ["unknown.example", "/hub", { next: true }],
  // ── canonical host: everything is the network's ──
  ["arts-collective.com", "/", { next: true }],
  ["arts-collective.com", "/hub", { next: true }],
  ["arts-collective.com", "/hub/members", { next: true }],
  ["arts-collective.com", "/login", { next: true }],
  ["arts-collective.com", "/api/x", { next: true }],
  ["arts-collective.com", "/_next/x", { next: true }],
  ["arts-collective.com", "/channel", { next: true }],
  ["arts-collective.com", "/studio", { next: true }],
  ["arts-collective.com", "/directory", { next: true }],
  ["www.arts-collective.com", "/hub", { next: true }],
  ["arts-collective.com", "/sites/tara/hub", { next: true }, { "x-org-slug": "tara" }],
];

function describe(res: Response): string {
  const rw = res.headers.get("x-middleware-rewrite");
  if (rw) {
    const u = new URL(rw);
    return `rewrite ${u.pathname}${u.search}`;
  }
  const loc = res.headers.get("location");
  if (loc) return `redirect ${res.status} ${loc}`;
  if (res.headers.get("x-middleware-next")) return "next";
  return `status ${res.status}`;
}

function expected(e: Expect): string {
  if ("next" in e) return "next";
  if ("rewrite" in e) return `rewrite ${e.rewrite}`;
  if ("redirect" in e) return `redirect ${e.status ?? 307} ${e.redirect}`;
  return `status ${e.status}`;
}

async function main() {
  const { middleware } = await import("../src/middleware");
  let fail = 0;
  const rows: string[] = [];
  for (const [host, path, exp, extra] of CASES) {
    const req = new NextRequest(`https://${host}${path}`, {
      headers: { host, "x-forwarded-proto": "https", ...(extra ?? {}) },
    });
    const res = await middleware(req);
    let got = describe(res);
    const want = expected(exp);
    // Org headers: set to the host's org on tenant rewrites, never passed through from a client.
    const slugHdr = res.headers.get("x-middleware-request-x-org-slug");
    if ("rewrite" in exp && slugHdr !== "tara") got += ` [x-org-slug=${slugHdr}]`;
    if (host === "arts-collective.com" && slugHdr) got += ` [leaked x-org-slug=${slugHdr}]`;
    const ok = got === want;
    if (!ok) fail++;
    rows.push(`${ok ? "PASS" : "FAIL"}  ${host.padEnd(26)} ${path.padEnd(28)} ${got}${ok ? "" : `   (want ${want})`}`);
  }
  // A client-sent x-org-slug on a tenant host is replaced by the host's org.
  {
    const req = new NextRequest(`https://${SUB}/hub`, { headers: { host: SUB, "x-org-slug": "ifac" } });
    const res = await middleware(req);
    const v = res.headers.get("x-middleware-request-x-org-slug");
    const ok = v === "tara";
    if (!ok) fail++;
    rows.push(`${ok ? "PASS" : "FAIL"}  spoofed x-org-slug:ifac on ${SUB}/hub → x-org-slug=${v}`);
  }
  console.log(rows.join("\n"));
  console.log(`\n${CASES.length + 1 - fail}/${CASES.length + 1} passed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
