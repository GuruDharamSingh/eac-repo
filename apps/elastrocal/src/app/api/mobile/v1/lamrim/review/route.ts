import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

const KINDS = ["item", "node", "passage", "unit", "part"] as const;
const VERDICTS = ["accurate", "partly", "wrong", "reading", "note"] as const;
const ID_RE = /^[A-Za-z0-9.#_:-]{1,120}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/mobile/v1/lamrim/review — Justin's judgement on the Lam Rim study data (owners only).
 * Append-only: a new verdict on the same thing is a new row, so history stays.
 *
 *   { targetKind: item | node | passage | unit | part (a section of a book in Read), targetId, nodeId?,
 *     verdict: accurate | partly | wrong   (on an AI item: did it read the text right)
 *            | reading                     (his own reading of what is actually the case here)
 *            | note,                        (a comment)
 *     conviction?: 0-5, note?, voice? (an uploaded recording), quote?: {text, start?, end?},
 *     context?: {question?: need | placement | importance | argument | synthesis | relation | list, mode?: walk | explore | deck} }
 *
 * The item's payload is stored as a snapshot, so the review keeps its meaning after re-imports.
 * DELETE ?id= removes one of the viewer's own reviews.
 */
export async function POST(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const p = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!p) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const targetKind = KINDS.find((k) => k === p.targetKind);
  const verdict = VERDICTS.find((v) => v === p.verdict);
  const targetId = typeof p.targetId === "string" && ID_RE.test(p.targetId) ? p.targetId : null;
  if (!targetKind || !verdict || !targetId) return NextResponse.json({ error: "targetKind, targetId and verdict are required" }, { status: 400 });
  if (targetKind !== "item" && !["reading", "note"].includes(verdict))
    return NextResponse.json({ error: "Only AI items take accurate / partly / wrong" }, { status: 400 });
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const note = text(p.note, 8000);
  let conviction: number | null = null;
  if (p.conviction !== undefined && p.conviction !== null) {
    if (typeof p.conviction !== "number" || !Number.isInteger(p.conviction) || p.conviction < 0 || p.conviction > 5)
      return NextResponse.json({ error: "conviction must be a whole number from 0 to 5" }, { status: 400 });
    conviction = p.conviction;
  }
  let voice: string | null = null;
  if (typeof p.voice === "string" && p.voice) {
    if (!p.voice.startsWith("Private/Jerusalem/") || p.voice.includes("..") || p.voice.length > 300)
      return NextResponse.json({ error: "voice must be an uploaded recording" }, { status: 400 });
    voice = p.voice;
  }
  if ((verdict === "reading" || verdict === "note") && !note && !voice)
    return NextResponse.json({ error: "A reading or note needs text or a recording" }, { status: 400 });
  let quote: Record<string, unknown> | null = null;
  if (p.quote && typeof p.quote === "object") {
    const q = p.quote as Record<string, unknown>;
    const qt = text(q.text, 4000);
    if (qt) quote = { text: qt, start: typeof q.start === "number" ? q.start : undefined, end: typeof q.end === "number" ? q.end : undefined };
  }

  // Where it was given: the walk's question this answers, and the mode (walk / explore / deck).
  const QUESTIONS = ["need", "placement", "importance", "argument", "synthesis", "relation", "list"];
  let context: Record<string, string> | null = null;
  if (p.context && typeof p.context === "object") {
    const c = p.context as Record<string, unknown>;
    context = {};
    if (typeof c.question === "string" && QUESTIONS.includes(c.question)) context.question = c.question;
    if (c.mode === "walk" || c.mode === "explore" || c.mode === "deck") context.mode = c.mode;
    if (!Object.keys(context).length) context = null;
  }

  let nodeId = typeof p.nodeId === "string" && /^LR(\.\d+)+$/.test(p.nodeId) ? p.nodeId : null;
  let snapshot: unknown = null;
  if (targetKind === "item") {
    const [it] = await db<{ kind: string; source: string | null; node_ids: string[]; payload: unknown }[]>`
      SELECT kind, source, node_ids, payload FROM lamrim_items WHERE id = ${targetId}`;
    if (!it) return NextResponse.json({ error: "That item is not in the corpus" }, { status: 404 });
    snapshot = { kind: it.kind, source: it.source, payload: it.payload };
    nodeId = nodeId && it.node_ids.includes(nodeId) ? nodeId : it.node_ids[0] ?? null;
  } else if (targetKind === "node") {
    const [n] = await db`SELECT id FROM lamrim_nodes WHERE id = ${targetId}`;
    if (!n) return NextResponse.json({ error: "Not found" }, { status: 404 });
    nodeId = targetId;
  } else {
    const table = targetKind === "passage" ? db`lamrim_passages` : targetKind === "part" ? db`lamrim_book_parts` : db`lamrim_units`;
    const [r] = await db<{ node_id: string }[]>`SELECT node_id FROM ${table} WHERE id = ${targetId}`;
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    nodeId = r.node_id;
  }
  const [rev] = await db<{ id: string; created_at: Date }[]>`
    INSERT INTO lamrim_reviews (user_id, target_kind, target_id, node_id, verdict, conviction, note, voice, quote, snapshot, device, context)
    VALUES (${viewer.userId}, ${targetKind}, ${targetId}, ${nodeId}, ${verdict}, ${conviction}, ${note}, ${voice},
            ${quote ? db.json(quote as never) : null}, ${snapshot ? db.json(snapshot as never) : null}, 'android',
            ${context ? db.json(context as never) : null})
    RETURNING id, created_at`;
  return NextResponse.json({ review: { id: rev.id, targetKind, targetId, nodeId, verdict, conviction, note, voice, quote, context, created_at: rev.created_at.toISOString() } }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const gone = await db`DELETE FROM lamrim_reviews WHERE id = ${id} AND user_id = ${viewer.userId} RETURNING id`;
  return gone.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
