import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

const ID_RE = /^LR(\.\d+)+$/;

/**
 * GET /api/mobile/v1/lamrim/node?id=LR.4.2.1.2 — one heading, text first (owners only):
 *   node, breadcrumb (ancestors), children, prev/next headings that have text,
 *   passages (the Great Treatise text under it), units (commentary sections aligned to it,
 *   by source), items (the AI's readings, each reviewable), and the viewer's reviews of all of it.
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [node] = await db`SELECT * FROM lamrim_nodes WHERE id = ${id}`;
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ancestors: string[] = [];
  const parts = id.split(".");
  for (let k = 2; k < parts.length; k++) ancestors.push(parts.slice(0, k).join("."));
  const [crumbs, children, passages, units, items, reviews, prev, next] = await Promise.all([
    ancestors.length ? db`SELECT id, marker, title FROM lamrim_nodes WHERE id = ANY(${ancestors}) ORDER BY ord` : Promise.resolve([]),
    db`SELECT id, marker, title FROM lamrim_nodes WHERE parent = ${id} ORDER BY ord`,
    db`SELECT id, kind, title, words, body FROM lamrim_passages WHERE node_id = ${id} ORDER BY (kind = 'section'), id`,
    db`SELECT id, source, seq, heading, page, sim, body FROM lamrim_units WHERE node_id = ${id} ORDER BY source, seq`,
    db`SELECT id, kind, source, node_ids, payload FROM lamrim_items WHERE ${id} = ANY(node_ids) AND retired_at IS NULL ORDER BY kind, source, id`,
    db`SELECT id, target_kind, target_id, verdict, conviction, note, voice, quote, context, created_at FROM lamrim_reviews
       WHERE user_id = ${viewer.userId} AND (node_id = ${id}) ORDER BY created_at`,
    db`SELECT n.id, n.marker, n.title FROM lamrim_nodes n WHERE n.ord < ${node.ord}
       AND EXISTS (SELECT 1 FROM lamrim_passages p WHERE p.node_id = n.id) ORDER BY n.ord DESC LIMIT 1`,
    db`SELECT n.id, n.marker, n.title FROM lamrim_nodes n WHERE n.ord > ${node.ord}
       AND EXISTS (SELECT 1 FROM lamrim_passages p WHERE p.node_id = n.id) ORDER BY n.ord LIMIT 1`,
  ]);
  return NextResponse.json({
    node, crumbs, children, passages, units, items,
    reviews: reviews.map((r) => ({ ...r, created_at: (r.created_at as Date).toISOString() })),
    prev: prev[0] ?? null, next: next[0] ?? null,
  });
}
