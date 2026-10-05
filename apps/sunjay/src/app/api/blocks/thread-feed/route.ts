import { NextResponse } from "next/server";
import { loadThreadFeed } from "@elkdonis/blocks/server";
import { siteConfig } from "@/config/site";

/**
 * Rows for a thread-feed block, for the editor.
 *
 * Deliberately ungated. `loadThreadFeed` filters to this org's PUBLISHED,
 * PUBLIC threads and writes those clauses itself rather than letting a caller
 * compose them — so this endpoint can only ever return what any visitor
 * already sees on the site. Gating it would buy nothing and would leave the
 * editor canvas empty for anyone whose session had lapsed.
 *
 * The `orgId` parameter is ignored in favour of this deployment's own org: the
 * editor runs on one org's site, and honouring a caller-supplied org here
 * would turn a public endpoint into a cross-tenant reader.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 10;

  const items = await loadThreadFeed(siteConfig.orgId, { limit, upcomingOnly: true });
  return NextResponse.json({ items });
}
