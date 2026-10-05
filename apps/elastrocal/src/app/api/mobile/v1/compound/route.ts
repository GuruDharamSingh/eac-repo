import { NextResponse, type NextRequest } from "next/server";
import { FACTOR_BY_KEY, isFactorKey } from "@elkdonis/astro-corpus";
import { db } from "@elkdonis/db";

/**
 * GET /api/mobile/v1/compound?keys=a,b[,c...]&offset=&limit=
 *
 * Passages about a compound subject, made of base pairs: "Mars in Taurus in
 * the 5th" is sign:mars:taurus + house:mars:5; "Mars in Taurus square Saturn"
 * is aspect:mars:saturn:square + sign:mars:taurus. The registry has no key
 * for the whole (yet), so the passages are found by their claims:
 *   together  one claim of the passage carries every key (strongest)
 *   across    the passage's claims and tags carry every key between them
 * Public, like /api/astro/references: an excerpt (≤ 700 characters) and the
 * matching claim; the whole passage is for owners through /passage.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const keys = [...new Set((sp.get("keys") ?? "").split(",").map((k) => k.trim()).filter(Boolean))].slice(0, 6);
  if (keys.length < 2 || !keys.every(isFactorKey)) return NextResponse.json({ error: "Give two to six registry keys" }, { status: 400 });
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));

  const rows = await db<
    { text_id: string; body: string; pages: unknown; headings: unknown; title: string; author: string | null; claim: string | null; together: boolean }[]
  >`
    WITH stmt AS (
      SELECT s.text_id, s.body AS claim
      FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id
      WHERE f.factor_key = ANY (${keys})
      GROUP BY s.id, s.text_id, s.body
      HAVING count(DISTINCT f.factor_key) = ${keys.length}
    ),
    together AS (SELECT text_id, min(claim) AS claim FROM stmt GROUP BY text_id),
    across AS (
      SELECT x.text_id FROM (
        SELECT t.text_id, t.factor_key FROM astro_text_factors t WHERE t.factor_key = ANY (${keys})
        UNION
        SELECT s.text_id, f.factor_key FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id WHERE f.factor_key = ANY (${keys})
      ) x GROUP BY x.text_id HAVING count(DISTINCT x.factor_key) = ${keys.length}
    ),
    hits AS (
      SELECT a.text_id, g.claim, (g.text_id IS NOT NULL) AS together FROM across a LEFT JOIN together g ON g.text_id = a.text_id
      UNION SELECT g.text_id, g.claim, TRUE FROM together g
    )
    SELECT DISTINCT ON (h.together, t.id) t.id AS text_id, t.body, t.meta->'pages' AS pages, t.meta->'headings' AS headings, so.title, so.author, h.claim, h.together
    FROM hits h JOIN astro_texts t ON t.id = h.text_id AND t.kind = 'import' JOIN astro_sources so ON so.id = t.source_id
    ORDER BY h.together DESC, t.id
    OFFSET ${offset} LIMIT ${limit}
  `;
  const [count] = await db<{ together: number; across: number }[]>`
    WITH stmt AS (
      SELECT s.text_id FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id
      WHERE f.factor_key = ANY (${keys}) GROUP BY s.id, s.text_id HAVING count(DISTINCT f.factor_key) = ${keys.length}
    ),
    across AS (
      SELECT x.text_id FROM (
        SELECT t.text_id, t.factor_key FROM astro_text_factors t WHERE t.factor_key = ANY (${keys})
        UNION
        SELECT s.text_id, f.factor_key FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id WHERE f.factor_key = ANY (${keys})
      ) x GROUP BY x.text_id HAVING count(DISTINCT x.factor_key) = ${keys.length}
    )
    SELECT (SELECT count(DISTINCT text_id)::int FROM stmt) AS together, (SELECT count(*)::int FROM across) AS across
  `;

  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return NextResponse.json({
    keys: keys.map((k) => ({ key: k, label: FACTOR_BY_KEY.get(k)?.label ?? k })),
    counts: count,
    items: rows.map((r) => ({
      textId: r.text_id,
      excerpt: r.body.length > 700 ? `${r.body.slice(0, 690).replace(/\s+\S*$/, "")} …` : r.body,
      length: r.body.length,
      pages: Array.isArray(r.pages) ? r.pages : [],
      book: { id: "", title: r.title, author: r.author },
      breadcrumb: strs(r.headings).map((text) => ({ text, keys: [] as string[] })),
      claim: r.claim,
      together: r.together,
    })),
  });
}
