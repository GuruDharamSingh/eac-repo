import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * GET /api/mobile/v1/lamrim/outline — Jerusalem's Path tab (owners only; private study copies).
 * Every heading of the Great Treatise outline in reading order, with what hangs on it:
 * passage words, commentary sections, AI items, and how many of those the viewer has reviewed.
 */
export async function GET() {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const rows = await db<{
    id: string; parent: string | null; depth: number; marker: string | null; title: string; vol: number | null; page: number | null;
    chapter: number | null; chapter_title: string | null; words: number; units: number; items: number; reviewed: number; readings: number;
  }[]>`
    SELECT n.id, n.parent, n.depth, n.marker, n.title, n.vol, n.page, n.chapter, n.chapter_title,
      COALESCE((SELECT sum(p.words) FROM lamrim_passages p WHERE p.node_id = n.id), 0)::int AS words,
      (SELECT count(*) FROM lamrim_units u WHERE u.node_id = n.id)::int AS units,
      (SELECT count(*) FROM lamrim_items i WHERE n.id = ANY(i.node_ids) AND i.retired_at IS NULL)::int AS items,
      (SELECT count(DISTINCT r.target_id) FROM lamrim_reviews r
         WHERE r.user_id = ${viewer.userId} AND r.node_id = n.id AND r.target_kind = 'item')::int AS reviewed,
      (SELECT count(*) FROM lamrim_reviews r
         WHERE r.user_id = ${viewer.userId} AND r.node_id = n.id AND r.verdict = 'reading')::int AS readings
    FROM lamrim_nodes n ORDER BY n.ord
  `;
  return NextResponse.json({ nodes: rows });
}
