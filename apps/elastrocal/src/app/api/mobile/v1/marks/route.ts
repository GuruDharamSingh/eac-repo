import { NextResponse, type NextRequest } from "next/server";
import { isFactorKey } from "@elkdonis/astro-corpus";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARK_VERDICTS =["good", "missed", "wrong", "note"] as const;
const OUTLINE_ROLES = ["description", "introduction", "examples", "logic", "combinations", "reference", "front_back", "other"] as const;

/**
 * POST /api/mobile/v1/marks — a reviewer's mark on a passage, from the app's
 * in-depth look (owners only). Stored in astro_reviews as action
 * 'passage-mark' (device 'android'), next to the studio's other reviews:
 *
 *   { textId, verdict: good | missed | wrong | note,
 *     quote?, start?, end?        the highlighted span of the passage body
 *     statementId?                a digest claim the mark is about
 *     factorKey?                  the factor the passage was opened for
 *     note?                       free text (dictated or typed)
 *     reasons?, tags?             chips: why it was helpful or not, and themes
 *     why?: helpful | not         set when the mark explains a Helpful / Not vote
 *     conviction?: 0-5            how strongly he feels why (0 no real reason, 5 strong)
 *     voice?                      his reasoning as a voice memo (/api/mobile/v1/media path)
 *     role?, subjects?            Outline span tags: what this stretch of text is (an outline
 *                                 role) and what it is about (sign / planet / house … words)
 *     context?: { event?, at?, outline? }   the feed event it was reached from; the outline
 *                                 section (slug:from) a span tag was made in }
 *
 * "good": the tagging or claim got this right. "missed": the passage says
 * something about the factor the digest did not pick up. "wrong": the
 * tagging or claim is mistaken. "note": a comment only.
 *
 * GET ?textIds=<id,id,…> lists the viewer's marks on those passages (up to 200).
 * DELETE ?id=<review id> removes one of the viewer's own marks.
 */
export async function POST(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const p = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!p) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const textId = typeof p.textId === "string" && UUID_RE.test(p.textId) ? p.textId : null;
  const verdict = MARK_VERDICTS.find((v) => v === p.verdict);
  if (!textId || !verdict) return NextResponse.json({ error: "textId and verdict are required" }, { status: 400 });
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);

  const payload: Record<string, unknown> = { textId, verdict };
  const quote = text(p.quote, 2000);
  if (quote) payload.quote = quote;
  if (int(p.start) !== undefined && int(p.end) !== undefined && (p.end as number) > (p.start as number)) {
    payload.start = p.start;
    payload.end = p.end;
  }
  if (typeof p.statementId === "string" && UUID_RE.test(p.statementId)) payload.statementId = p.statementId;
  if (typeof p.factorKey === "string" && isFactorKey(p.factorKey)) payload.factorKey = p.factorKey;
  const note = text(p.note, 4000);
  if (note) payload.note = note;
  if (p.context && typeof p.context === "object") {
    const c = p.context as Record<string, unknown>;
    payload.context = { event: text(c.event, 200), at: text(c.at, 40), outline: text(c.outline, 200) };
  }
  // Why a passage was (or was not) helpful: reason chips and theme tags, short strings.
  const list = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 60)))].slice(0, 16) : [];
  const reasons = list(p.reasons);
  const tags = list(p.tags);
  if (reasons.length) payload.reasons = reasons;
  if (tags.length) payload.tags = tags;
  if (p.why === "helpful" || p.why === "not") payload.why = p.why;
  // Outline span tags (the app's section reader): the same roles as an outline section.
  if (typeof p.role === "string" && OUTLINE_ROLES.includes(p.role as never)) payload.role = p.role;
  const subjects = list(p.subjects);
  if (subjects.length) payload.subjects = subjects;
  // The shared reasoning sheet: how strongly he feels why (0 none, 5 strong), and his voice memo.
  if (p.conviction !== undefined && p.conviction !== null) {
    if (typeof p.conviction !== "number" || !Number.isInteger(p.conviction) || p.conviction < 0 || p.conviction > 5)
      return NextResponse.json({ error: "conviction must be a whole number from 0 to 5" }, { status: 400 });
    payload.conviction = p.conviction;
  }
  if (typeof p.voice === "string" && p.voice) {
    if (!p.voice.startsWith("Private/Jerusalem/") || p.voice.includes("..") || p.voice.length > 300)
      return NextResponse.json({ error: "voice must be an uploaded recording" }, { status: 400 });
    payload.voice = p.voice;
  }
  if (verdict === "note" && !note && !reasons.length && !payload.voice && !payload.role && !subjects.length) return NextResponse.json({ error: "A note needs text or a recording" }, { status: 400 });

  const [t] = await db<{ id: string }[]>`SELECT id FROM astro_texts WHERE id = ${textId} AND kind = 'import' AND org_id = 'elastrocal'`;
  if (!t) return NextResponse.json({ error: "That passage is not in the corpus" }, { status: 404 });
  if (payload.statementId) {
    const [s] = await db<{ id: string }[]>`SELECT id FROM astro_statements WHERE id = ${payload.statementId as string} AND text_id = ${textId}`;
    if (!s) return NextResponse.json({ error: "That claim is not from this passage" }, { status: 400 });
  }

  const [rev] = await db<{ id: string; created_at: Date }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES ('elastrocal', NULL, ${viewer.userId}, 'passage-mark', ${db.json(payload as never)}, ${[]}, ${[]}, NULL, NULL, 'android')
    RETURNING id, created_at
  `;
  return NextResponse.json({ mark: { id: rev.id, ...payload, createdAt: rev.created_at.toISOString() } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const ids = (request.nextUrl.searchParams.get("textIds") ?? "").split(",").filter((x) => UUID_RE.test(x)).slice(0, 200);
  if (!ids.length) return NextResponse.json({ marks: [] });
  const rows = await db<{ id: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, payload, created_at FROM astro_reviews
    WHERE org_id = 'elastrocal' AND reviewer_id = ${viewer.userId} AND action = 'passage-mark' AND payload->>'textId' = ANY(${ids})
    ORDER BY created_at
  `;
  return NextResponse.json({ marks: rows.map((m) => ({ id: m.id, ...m.payload, createdAt: m.created_at.toISOString() })) });
}

export async function DELETE(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db`
    DELETE FROM astro_reviews WHERE id = ${id} AND reviewer_id = ${viewer.userId} AND action = 'passage-mark' RETURNING id
  `;
  return NextResponse.json({ deleted: rows.length > 0 });
}
