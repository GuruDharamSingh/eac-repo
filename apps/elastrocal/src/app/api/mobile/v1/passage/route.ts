import { NextResponse, type NextRequest } from "next/server";
import { FACTOR_BY_KEY, isFactorKey } from "@elkdonis/astro-corpus";
import { matchClaimSentences, passageSentences } from "@elkdonis/astro-corpus/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";
import { getPassage } from "@/lib/references";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
const ASPECT_WORDS: Record<string, string> = {
  conjunction: "conjunct|conjunction|conjoin",
  sextile: "sextile",
  square: "square",
  trine: "trine",
  opposition: "oppos",
  quincunx: "quincunx|inconjunct",
  semisextile: "semi-?sextile",
  semisquare: "semi-?square",
  sesquisquare: "sesqui",
};

/** The words a sentence must contain to name a factor: each part (planet, sign, house, aspect). */
function partPatterns(factorKey: string): RegExp[] {
  const f = FACTOR_BY_KEY.get(factorKey);
  if (!f) return [];
  const p = f.parts as Record<string, unknown>;
  const pats: string[] = [];
  const name = (k: unknown) => (k === "northNode" ? "north node|node" : k === "midheaven" ? "midheaven|mc" : k === "ascendant" ? "ascendant|rising" : String(k));
  if (p.point) pats.push(name(p.point));
  if (p.other) pats.push(name(p.other));
  if (p.sign) pats.push(String(p.sign));
  if (p.otherSign) pats.push(String(p.otherSign));
  if (p.house) pats.push(`${p.house}(st|nd|rd|th)|${ORDINAL[Number(p.house)] ?? "x"}`);
  if (p.aspect) pats.push(ASPECT_WORDS[String(p.aspect)] ?? String(p.aspect));
  return pats.map((x) => new RegExp(`\\b(${x})`, "i"));
}

/**
 * GET /api/mobile/v1/passage?textId=<uuid>&factorKey=<key>
 *
 * Every chunk, the same way (owners only): the whole passage split into
 * sentences, and WHY it was called for `factorKey`:
 *   why.sentences  [{ i, reason: "tagged" | "names" }]: "tagged" where a claim
 *                  the digest tagged with the factor came from (approximate,
 *                  by word overlap), "names" where the sentence itself names
 *                  every part of the factor (planet, sign, house, aspect).
 *   why.headings   indexes of breadcrumb levels whose factors include it.
 * Also its claims (each with the sentences it came from), everything it is
 * tagged with, its place in the book (kind of reading, chapter, position
 * n of N), the two chunks before and after it, and the viewer's marks.
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const sp = request.nextUrl.searchParams;
  const textId = sp.get("textId") ?? "";
  const rawKey = sp.get("factorKey");
  const factorKey = rawKey && isFactorKey(rawKey) ? rawKey : null;
  if (!UUID_RE.test(textId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const passage = await getPassage(textId, factorKey, { full: true });
  if (!passage || passage.body === null) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sentences = passageSentences(passage.body);
  const claimSentences = matchClaimSentences(sentences, passage.claims.map((c) => c.body));
  const claims = passage.claims.map((c, i) => ({ ...c, sentences: claimSentences[i] ?? [] }));

  // Why it was called.
  const why: { i: number; reason: "tagged" | "names" }[] = [];
  if (factorKey) {
    for (const c of claims) if (c.tagged) for (const i of c.sentences) if (!why.some((w) => w.i === i)) why.push({ i, reason: "tagged" });
    const pats = partPatterns(factorKey);
    if (pats.length)
      sentences.forEach((s, i) => {
        if (pats.every((re) => re.test(s)) && !why.some((w) => w.i === i)) why.push({ i, reason: "names" });
      });
  }
  why.sort((a, b) => a.i - b.i);
  const headingHits = factorKey ? passage.breadcrumb.flatMap((b, i) => (b.keys?.includes(factorKey) ? [i] : [])) : [];

  const [section] = await db<{ book_slug: string; chunk_index: number; kind: string; title: string | null; chapter: string | null; subject_type: string; subjects: string[] }[]>`
    SELECT book_slug, chunk_index, kind, title, chapter, subject_type, subjects
    FROM astro_text_sections WHERE text_id = ${textId}
  `;
  const factors = await db<{ factor_key: string }[]>`
    SELECT DISTINCT factor_key FROM astro_text_factors WHERE text_id = ${textId} ORDER BY factor_key
  `;

  type Near = { text_id: string; body: string; chunk_index: number; kind: string; title: string | null; chapter: string | null };
  const near = section
    ? await db<Near[]>`
        SELECT s.text_id, t.body, s.chunk_index, s.kind, s.title, s.chapter
        FROM astro_text_sections s JOIN astro_texts t ON t.id = s.text_id
        WHERE s.book_slug = ${section.book_slug} AND s.chunk_index BETWEEN ${section.chunk_index - 2} AND ${section.chunk_index + 2}
          AND s.text_id <> ${textId}
        ORDER BY s.chunk_index
      `
    : [];
  const [count] = section
    ? await db<{ n: number }[]>`SELECT count(*)::int AS n FROM astro_text_sections WHERE book_slug = ${section.book_slug}`
    : [{ n: 0 }];
  const shape = (n?: Near) => (n ? { textId: n.text_id, body: n.body, kind: n.kind, title: n.title, chapter: n.chapter } : null);
  const at = (d: number) => shape(near.find((n) => section && n.chunk_index === section.chunk_index + d));

  const marks = await db<{ id: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, payload, created_at FROM astro_reviews
    WHERE org_id = 'elastrocal' AND reviewer_id = ${viewer.userId} AND action = 'passage-mark' AND payload->>'textId' = ${textId}
    ORDER BY created_at
  `;

  return NextResponse.json({
    passage: { ...passage, claims },
    sentences,
    why: { factorKey, factorLabel: factorKey ? (FACTOR_BY_KEY.get(factorKey)?.label ?? factorKey) : null, sentences: why, headings: headingHits },
    section: section
      ? { bookSlug: section.book_slug, chunkIndex: section.chunk_index, total: count?.n ?? 0, kind: section.kind, title: section.title, chapter: section.chapter, subjectType: section.subject_type, subjects: section.subjects }
      : null,
    factors: factors.map((f) => f.factor_key),
    // Kept for older app builds: the chunk either side.
    prev: at(-1),
    next: at(1),
    around: [-2, -1, 1, 2].map((d) => ({ offset: d, chunk: at(d) })).filter((x) => x.chunk),
    marks: marks.map((m) => ({ id: m.id, ...m.payload, createdAt: m.created_at.toISOString() })),
  });
}
