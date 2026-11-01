import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * GET /api/mobile/v1/lamrim/export?since=<iso> — every Lam Rim review (owners only), oldest first,
 * with the snapshot of what was judged. The PC pulls this to feed Justin's verdicts and readings
 * back into the next passes (WSL ~/chunker, chunker/lamrim.py).
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const since = request.nextUrl.searchParams.get("since");
  const t = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : new Date(0);
  const rows = await db`
    SELECT r.id, u.email, r.target_kind, r.target_id, r.node_id, r.verdict, r.conviction, r.note, r.voice, r.quote, r.snapshot, r.device, r.created_at
    FROM lamrim_reviews r JOIN users u ON u.id = r.user_id
    WHERE r.created_at > ${t} ORDER BY r.created_at`;
  return NextResponse.json({ reviews: rows.map((r) => ({ ...r, created_at: (r.created_at as Date).toISOString() })) });
}
