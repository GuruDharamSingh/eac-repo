import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";

/**
 * GET /api/mobile/v1/lamrim/books — Jerusalem's Path › Read (owners only; private study copies).
 *   no params                      → the books: source, title, author, parts, words
 *   ?source=<slug>&offset=&limit=  → that book's parts in order (heading, chapter, page, node_id, body),
 *                                    and how many readings the viewer has written on each.
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const sp = request.nextUrl.searchParams;
  const source = sp.get("source");
  if (!source) {
    const books = await db`SELECT source, title, author, parts, words FROM lamrim_books ORDER BY ord`;
    return NextResponse.json({ books });
  }
  if (!/^[a-z0-9-]{1,60}$/.test(source)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(80, Math.max(1, Number(sp.get("limit")) || 40));
  const [book] = await db`SELECT source, title, author, parts, words FROM lamrim_books WHERE source = ${source}`;
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parts = await db`
    SELECT p.id, p.seq, p.heading, p.chapter, p.page, p.node_id, p.body,
      (SELECT count(*) FROM lamrim_reviews r WHERE r.user_id = ${viewer.userId} AND r.target_id = p.id)::int AS readings
    FROM lamrim_book_parts p WHERE p.source = ${source} ORDER BY p.seq OFFSET ${offset} LIMIT ${limit}`;
  return NextResponse.json({ book, offset, parts });
}
