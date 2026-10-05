import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { ownerOrResponse } from "@/lib/owner-api";
import { siteConfig } from "@/config/site";

/**
 * Read mode: the library as books to read straight through (owners only —
 * whole passages of books whose licences are unknown).
 *
 * GET              → every book with its passage count.
 * GET ?book=<id>&offset=&limit=   → that book's passages in reading order:
 *   (&from=&to= instead: the passages whose chunk_index is in that range, for one outline section)
 *   the chunker's chunk_index where the passage has one (astro_text_sections),
 *   else the importer's row number (source_ref "row:N"), else source_ref.
 *   Each passage carries its chapter and section title where known.
 */
export async function GET(request: NextRequest) {
  const viewer = await ownerOrResponse();
  if (viewer instanceof NextResponse) return viewer;
  const sp = request.nextUrl.searchParams;
  const book = sp.get("book");
  const outline = sp.get("outline");

  if (!book && !outline) {
    const books = await db<{ id: string; title: string; author: string | null; n: number }[]>`
      SELECT so.id, so.title, so.author, count(t.id)::int AS n
      FROM astro_sources so JOIN astro_texts t ON t.source_id = so.id AND t.kind = 'import'
      WHERE so.org_id = ${siteConfig.orgId}
      GROUP BY so.id ORDER BY lower(so.title)
    `;
    return NextResponse.json({ books });
  }

  // One outline section: ?outline=<slug>&from=&to= (chunk indexes of that outline's book).
  if (outline) {
    const lo = Number(sp.get("from")), hi = Number(sp.get("to"));
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    const rows = await db<{ id: string; body: string; pages: unknown; chapter: string | null; title: string | null; kind: string | null; chunk_index: number }[]>`
      SELECT t.id, t.body, t.meta->'pages' AS pages, s.chapter, s.title, s.kind, s.chunk_index
      FROM astro_text_sections s JOIN astro_texts t ON t.id = s.text_id
      WHERE s.book_slug = ${outline} AND s.chunk_index BETWEEN ${lo} AND ${hi} ORDER BY s.chunk_index LIMIT 300
    `;
    return NextResponse.json({ passages: rows.map((r) => ({ textId: r.id, body: r.body, pages: Array.isArray(r.pages) ? r.pages : [], chapter: r.chapter, title: r.title, kind: r.kind, chunkIndex: r.chunk_index })) });
  }
  if (!book || !/^[0-9a-f-]{36}$/i.test(book)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const from = sp.has("from") ? Number(sp.get("from")) : null;
  const to = sp.has("to") ? Number(sp.get("to")) : null;
  const ranged = from !== null && to !== null && Number.isInteger(from) && Number.isInteger(to) && to >= from;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
  const [src] = await db<{ id: string; title: string; author: string | null; n: number }[]>`
    SELECT so.id, so.title, so.author, (SELECT count(*)::int FROM astro_texts t WHERE t.source_id = so.id AND t.kind = 'import') AS n
    FROM astro_sources so WHERE so.id = ${book} AND so.org_id = ${siteConfig.orgId}
  `;
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db<{ id: string; body: string; pages: unknown; chapter: string | null; title: string | null; kind: string | null; chunk_index: number | null }[]>`
    SELECT t.id, t.body, t.meta->'pages' AS pages, sec.chapter, sec.title, sec.kind, sec.chunk_index
    FROM astro_texts t LEFT JOIN astro_text_sections sec ON sec.text_id = t.id
    WHERE t.source_id = ${book} AND t.kind = 'import'
      ${ranged ? db`AND sec.chunk_index BETWEEN ${from} AND ${to}` : db``}
    ORDER BY COALESCE(sec.chunk_index, NULLIF(substring(t.source_ref from '^row:([0-9]+)$'), '')::int) NULLS LAST, t.source_ref
    OFFSET ${ranged ? 0 : offset} LIMIT ${ranged ? 200 : limit}
  `;
  return NextResponse.json({
    book: src,
    offset,
    passages: rows.map((r) => ({
      textId: r.id,
      body: r.body,
      pages: Array.isArray(r.pages) ? r.pages : [],
      chapter: r.chapter,
      title: r.title,
      kind: r.kind,
      chunkIndex: r.chunk_index,
    })),
  });
}
