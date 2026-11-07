import { NextResponse, type NextRequest } from "next/server";
import { QUOTE_MAX_BODY, submitQuote } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * Add a line to the rotating band on /center.
 *
 * Open to anyone signed in, because a quote is the cheapest thing a person
 * can contribute and the band is where they are standing when they think of
 * one. It lands `pending` and shows to nobody until an owner or guide of this
 * org publishes it; theirs goes up directly, since they are the ones who
 * would have approved it anyway.
 *
 * Filed under THIS org, never the collective — the network's own lines are
 * seeded and edited by a platform admin, not submitted from an org's page.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    body?: unknown;
    attribution?: unknown;
    source?: unknown;
  } | null;
  if (!body || typeof body.body !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (body.body.trim().length < 8 || body.body.length > QUOTE_MAX_BODY * 2) {
    return NextResponse.json({ error: "A line needs a few more words than that." }, { status: 422 });
  }

  const canPublish = viewer.role === "owner" || viewer.role === "guide";
  const quote = await submitQuote({
    orgId: siteConfig.orgId,
    body: body.body,
    attribution: typeof body.attribution === "string" ? body.attribution : null,
    source: typeof body.source === "string" ? body.source : null,
    submittedBy: viewer.userId,
    status: canPublish ? "published" : "pending",
  });
  if (!quote) return NextResponse.json({ error: "Could not file that." }, { status: 500 });

  return NextResponse.json({ ok: true, status: quote.status });
}
