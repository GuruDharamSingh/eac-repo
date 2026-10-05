import { NextResponse, type NextRequest } from "next/server";
import { isFactorKey } from "@elkdonis/astro-corpus";
import { patternPhraseOf } from "@elkdonis/astro-corpus/server";
import { exploreAccess, PUBLIC_PAGE_MAX } from "@/lib/explore-access";
import { listReferences, referencesSummary, REFERENCE_SCOPES, REFERENCE_SORTS, type KeyPassages, type PassageRef, type ReferenceScope, type ReferenceSort } from "@/lib/references";

/**
 * Corpus references for the chart explorer — book PASSAGES, not the AI's
 * digested statements. Read-only.
 *
 * Access (lib/explore-access.ts): anyone who can view `chartId` (its owner
 * account or guest cookie); without chartId, anyone, with no fit to a chart.
 * Ranking follows the curator's votes for everyone; only the studio owner
 * sees vote marks, notes and counts, and non-owners get at most 50 per page.
 *
 * `chartId` (the caller's own chart) makes it chart-relative: an "about"
 * passage gets fit = more | applies | other on its subject's placements.
 *
 * Summary: GET ?chartId=…&keys=a,b,c&patterns=t-square&limit=3
 *   { refs: { [key]: KeyPassages }, unknown: string[], ms }
 *   KeyPassages = { key, passages, books, authors, more, other, otherBooks, mentions, mismatch, passing,
 *                   helpful, tossed, top: PassageRef[], byBook[] }
 *
 * Full list: GET ?chartId=…&key=sign:venus:aries&scope=fit|other|mentions|mismatch|passing
 *            &offset=0&limit=25&q=…&sort=rank|book|author
 *   { page: { key, scope, total, counts{more, applies, other, mentions, mismatch, passing}, offset, limit, sort, q, items: PassageRef[] }, ms }
 *
 * PassageRef = { textId, excerpt, length, pages, book, breadcrumb[{text, keys}], ignored[], subject, subjectFrom,
 *   group, note, anaphora, fit, matched[], missing[], alternatives, aiTagged, inBook, vote }
 */

const MAX_KEYS = 60;
const PAGE_MAX = 100;

/** No votes on this id: the ranking then has nothing to follow. */
const NOBODY = "00000000-0000-0000-0000-000000000000";

/** Non-owners never see vote marks, notes or counts (the ranking already reflects them). */
const hideVote = (p: PassageRef): PassageRef => ({ ...p, vote: null });
const hideVotes = (r: KeyPassages): KeyPassages => ({ ...r, helpful: 0, tossed: 0, top: r.top.map(hideVote) });

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const access = await exploreAccess(sp.get("chartId"));
  if (access instanceof NextResponse) return access;
  const { isOwner, chart } = access;
  const rankBy = access.rankBy ?? NOBODY;
  const t0 = performance.now();
  try {
    const one = sp.get("key");
    if (one !== null) {
      if (!isFactorKey(one) && !patternPhraseOf(one)) return NextResponse.json({ error: "Unknown factor key" }, { status: 400 });
      const sortParam = sp.get("sort") ?? "";
      const sort: ReferenceSort = (REFERENCE_SORTS as readonly string[]).includes(sortParam) ? (sortParam as ReferenceSort) : "rank";
      const q = (sp.get("q") ?? "").trim().slice(0, 200) || null;
      const page = await listReferences(one, {
        offset: Math.min(Math.max(Math.floor(Number(sp.get("offset")) || 0), 0), 100_000),
        limit: Math.min(Math.max(Math.floor(Number(sp.get("limit")) || 25), 1), isOwner ? PAGE_MAX : PUBLIC_PAGE_MAX),
        q,
        sort,
        scope: (REFERENCE_SCOPES as readonly string[]).includes(sp.get("scope") ?? "") ? (sp.get("scope") as ReferenceScope) : "fit",
        reviewerId: rankBy,
        chart,
      });
      const out = isOwner ? page : { ...page, items: page.items.map(hideVote) };
      return NextResponse.json({ page: out, ms: Math.round(performance.now() - t0) }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const split = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const requested = [...new Set(split(sp.get("keys")))].slice(0, MAX_KEYS);
    const keys = requested.filter(isFactorKey);
    const unknown = requested.filter((k) => !isFactorKey(k));
    for (const slug of split(sp.get("patterns"))) {
      const key = `pattern:${slug.toLowerCase()}`;
      if (patternPhraseOf(key)) keys.push(key);
      else unknown.push(key);
    }
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 3, 1), 12);
    const refs = await referencesSummary(keys, limit, rankBy, chart);
    const out = isOwner ? refs : Object.fromEntries(Object.entries(refs).map(([k, r]) => [k, hideVotes(r)]));
    // no-store: the ranking follows the curator's votes, which change as they click.
    return NextResponse.json({ refs: out, unknown, ms: Math.round(performance.now() - t0) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[elastrocal] references failed", err);
    return NextResponse.json({ error: "Reference lookup failed" }, { status: 500 });
  }
}
