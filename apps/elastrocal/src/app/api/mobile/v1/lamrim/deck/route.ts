import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

const KINDS = ["relation", "need", "placement", "importance", "argument", "relation-to-others", "synthesis", "list", "lamp-verse"];

/**
 * GET /api/mobile/v1/lamrim/deck?kind=argument&under=LR.4.2.2.2.1&skip=id,id — the next AI item
 * the viewer has not judged (owners only), in reading order, with the text it is about:
 * its heading, the start of the Great Treatise passage, and the commentary section it came from.
 * Progress: { done, total } for the same filter.
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const sp = request.nextUrl.searchParams;
  const kind = KINDS.includes(sp.get("kind") ?? "") ? sp.get("kind")! : null;
  const under = /^LR(\.\d+)+$/.test(sp.get("under") ?? "") ? sp.get("under")! : null;
  const skip = (sp.get("skip") ?? "").split(",").filter((x) => /^[0-9a-f]{16}$/.test(x)).slice(0, 200);
  const filter = db`
    i.retired_at IS NULL
    ${kind ? db`AND i.kind = ${kind}` : db``}
    ${under ? db`AND EXISTS (SELECT 1 FROM unnest(i.node_ids) x WHERE x = ${under} OR x LIKE ${under + ".%"})` : db``}
  `;
  const [counts] = await db<{ total: number; done: number }[]>`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lamrim_reviews r WHERE r.user_id = ${viewer.userId} AND r.target_id = i.id))::int AS done
    FROM lamrim_items i WHERE ${filter}`;
  const [item] = await db<{ id: string; kind: string; source: string | null; node_ids: string[]; payload: Record<string, unknown> }[]>`
    SELECT i.id, i.kind, i.source, i.node_ids, i.payload FROM lamrim_items i
    LEFT JOIN lamrim_nodes n ON n.id = i.node_ids[1]
    WHERE ${filter}
      AND NOT EXISTS (SELECT 1 FROM lamrim_reviews r WHERE r.user_id = ${viewer.userId} AND r.target_id = i.id)
      ${skip.length ? db`AND NOT (i.id = ANY(${skip}))` : db``}
    ORDER BY n.ord NULLS LAST, i.kind, i.id LIMIT 1`;
  if (!item) return NextResponse.json({ item: null, ...counts });
  const nodeId = item.node_ids[0] ?? null;
  const [node] = nodeId ? await db`SELECT id, marker, title, vol, page FROM lamrim_nodes WHERE id = ${nodeId}` : [null];
  const [passage] = nodeId ? await db<{ body: string }[]>`SELECT body FROM lamrim_passages WHERE node_id = ${nodeId} AND kind = 'section'` : [];
  const section = typeof item.payload.section === "string" ? item.payload.section : null;
  const [unit] = section ? await db<{ id: string; source: string; heading: string | null; body: string }[]>`
    SELECT id, source, heading, body FROM lamrim_units WHERE id = ${section}` : [];
  return NextResponse.json({
    item, node, ...counts,
    passage: passage ? passage.body.slice(0, 2500) : null,
    unit: unit ? { ...unit, body: unit.body.slice(0, 2500) } : null,
  });
}
