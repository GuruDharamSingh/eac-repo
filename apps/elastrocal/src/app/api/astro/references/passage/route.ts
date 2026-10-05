import { NextResponse, type NextRequest } from "next/server";
import { isFactorKey } from "@elkdonis/astro-corpus";
import { exploreAccess } from "@/lib/explore-access";
import { getPassage } from "@/lib/references";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/astro/references/passage?textId=<uuid>&factorKey=<key>&chartId=<uuid>
 *
 * One book passage (imported books only), with the AI digest's claims and a
 * footnote per claim (where it came from, the book's reason, where its tags
 * come from).
 *
 * The studio owner gets the whole passage (`body`). Anyone else must be able
 * to view `chartId` (the chart they are exploring) and gets `body: null`,
 * `excerptOnly: true` — the books' licences are unknown — with footnotes
 * quoting at most one source sentence (≤ 300 characters) per claim.
 *   { passage: { textId, body|null, excerptOnly, pages, headings, breadcrumb[], ignored[], subject,
 *                contentType, book, claims[{id, ordinal, body, tagged, because, keys}], claimNotes[] } }
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const access = await exploreAccess(sp.get("chartId"));
  if (access instanceof NextResponse) return access;
  if (!access.isOwner && !access.chart) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const textId = sp.get("textId") ?? "";
  const factorKey = sp.get("factorKey");
  if (!UUID_RE.test(textId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const passage = await getPassage(textId, factorKey && isFactorKey(factorKey) ? factorKey : null, { full: access.isOwner });
    if (!passage) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ passage }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    console.error("[elastrocal] passage failed", err);
    return NextResponse.json({ error: "Passage lookup failed" }, { status: 500 });
  }
}
