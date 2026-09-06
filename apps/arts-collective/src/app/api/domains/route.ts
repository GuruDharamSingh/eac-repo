import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";

/**
 * domain → org slug map, consumed by src/middleware.ts.
 *
 * Middleware runs on the Edge runtime and cannot open a Postgres connection,
 * so it fetches this route instead and caches the result in module scope. That
 * is the whole reason this endpoint exists; it is not a general-purpose API.
 *
 * The response is intentionally minimal — domain and slug only. Both are
 * already public knowledge for any live site (you learn them by visiting it),
 * so this is not an information-disclosure boundary. It does let someone
 * enumerate which domains the network serves; if that ever matters, put a
 * shared-secret header on it and set the same value in the middleware fetch.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db<Array<{ domain: string; slug: string }>>`
      SELECT d.domain, o.slug
      FROM org_domains d
      JOIN organizations o ON o.id = d.org_id
    `;

    const domains: Record<string, string> = {};
    for (const row of rows) domains[row.domain] = row.slug;

    return NextResponse.json(
      { domains },
      {
        headers: {
          // Middleware keeps its own 60s cache; this mainly helps any
          // intermediate proxy avoid hammering Postgres.
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    // Pre-migration databases have no org_domains table. Returning an empty
    // map means middleware simply finds no custom domains and every request
    // falls through to the existing subdomain behaviour, rather than 500ing
    // the entire site.
    return NextResponse.json(
      { domains: {} },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
