import { NextResponse, type NextRequest } from "next/server";
import { FACTOR_BY_KEY, isFactorKey } from "@elkdonis/astro-corpus";
import { db } from "@elkdonis/db";

/**
 * POST /api/mobile/v1/facets — references for an event as a whole object
 * (Justin, 2026-10-04). The app breaks a sky event into facets: every useful
 * recombination of its parts, from the most specific ("Sun in Libra opposite
 * Saturn in Aries" = aspect:sun:saturn:opposition + sign:sun:libra +
 * sign:saturn:aries) down to single layers ("Sun in an air sign" =
 * planet:sun + element:air, "Libra–Aries opposition" = zodiac:libra +
 * zodiac:aries + aspect-type:opposition). Each facet is a set of registry keys
 * with a weight.
 *
 *   { facets: [{ id, keys: string[1..6], weight }], only?: facetId, offset?, limit? }
 *
 * A passage covers a facet when its tags and claims carry every key of it;
 * "together" when one claim carries them all (worth 1.5×). Passages are
 * ranked by the summed weight of the facets they cover, so the ones that
 * match the most, and the most specific, facets come first. Returns the
 * count of passages per facet too. Public like /compound: excerpts only.
 */

interface Facet {
  id: string;
  keys: string[];
  weight: number;
}

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => null)) as { facets?: unknown; only?: unknown; offset?: unknown; limit?: unknown } | null;
  if (!b || !Array.isArray(b.facets)) return NextResponse.json({ error: "facets are required" }, { status: 400 });
  const dropped: string[] = [];
  const facets: Facet[] = [];
  for (const raw of b.facets.slice(0, 80) as Record<string, unknown>[]) {
    const id = typeof raw?.id === "string" ? raw.id.slice(0, 80) : "";
    const keys = Array.isArray(raw?.keys) ? [...new Set(raw.keys.filter((k): k is string => typeof k === "string"))].slice(0, 6) : [];
    if (!id || !keys.length) continue;
    // A facet with a key the registry does not know can never match: drop it, say so.
    if (!keys.every(isFactorKey)) {
      dropped.push(id);
      continue;
    }
    const weight = typeof raw.weight === "number" && raw.weight > 0 ? Math.min(raw.weight, 100) : keys.length;
    facets.push({ id, keys, weight });
  }
  if (!facets.length) return NextResponse.json({ error: "No usable facets", dropped }, { status: 400 });
  const only = typeof b.only === "string" ? b.only : null;
  const offset = Math.max(0, Number(b.offset) || 0);
  const limit = Math.min(50, Math.max(1, Number(b.limit) || 20));
  const allKeys = [...new Set(facets.flatMap((f) => f.keys))];

  // Which of the keys each passage carries (its own tags and its claims'), and each claim's keys.
  const [texts, stmts] = await Promise.all([
    db<{ text_id: string; keys: string[] }[]>`
      SELECT x.text_id, array_agg(DISTINCT x.factor_key) AS keys FROM (
        SELECT t.text_id, t.factor_key FROM astro_text_factors t WHERE t.factor_key = ANY (${allKeys})
        UNION ALL
        SELECT s.text_id, f.factor_key FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id WHERE f.factor_key = ANY (${allKeys})
      ) x JOIN astro_texts tx ON tx.id = x.text_id AND tx.kind = 'import'
      GROUP BY x.text_id
    `,
    db<{ text_id: string; keys: string[] }[]>`
      SELECT s.text_id, array_agg(DISTINCT f.factor_key) AS keys
      FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id
      WHERE f.factor_key = ANY (${allKeys})
      GROUP BY s.id, s.text_id HAVING count(DISTINCT f.factor_key) >= 2
    `,
  ]);
  const claimSets = new Map<string, Set<string>[]>();
  for (const r of stmts) claimSets.set(r.text_id, [...(claimSets.get(r.text_id) ?? []), new Set(r.keys)]);

  const counts: Record<string, { passages: number; together: number }> = Object.fromEntries(facets.map((f) => [f.id, { passages: 0, together: 0 }]));
  const scored: { textId: string; score: number; covered: string[]; together: string[] }[] = [];
  for (const r of texts) {
    const have = new Set(r.keys);
    const claims = claimSets.get(r.text_id) ?? [];
    const covered: string[] = [];
    const together: string[] = [];
    const gains: number[] = [];
    for (const f of facets) {
      if (!f.keys.every((k) => have.has(k))) continue;
      covered.push(f.id);
      counts[f.id].passages++;
      const one = f.keys.length > 1 && claims.some((c) => f.keys.every((k) => c.has(k)));
      if (one) {
        together.push(f.id);
        counts[f.id].together++;
      }
      gains.push(f.weight * (one ? 1.5 : 1));
    }
    gains.sort((a, b) => b - a);
    const score = (gains[0] ?? 0) + 0.25 * gains.slice(1).reduce((n, g) => n + g, 0);
    if (!covered.length || (only && !covered.includes(only))) continue;
    scored.push({ textId: r.text_id, score, covered, together });
  }
  scored.sort((a, b) => b.score - a.score || b.covered.length - a.covered.length || a.textId.localeCompare(b.textId));
  const pageRows = scored.slice(offset, offset + limit);
  const ids = pageRows.map((r) => r.textId);

  const [bodies, claimRows] = ids.length
    ? await Promise.all([
        db<{ id: string; body: string; pages: unknown; headings: unknown; title: string; author: string | null }[]>`
          SELECT t.id, t.body, t.meta->'pages' AS pages, t.meta->'headings' AS headings, so.title, so.author
          FROM astro_texts t JOIN astro_sources so ON so.id = t.source_id WHERE t.id = ANY (${ids})
        `,
        db<{ text_id: string; body: string; keys: string[] }[]>`
          SELECT s.text_id, s.body, array_agg(DISTINCT f.factor_key) AS keys
          FROM astro_statements s JOIN astro_statement_factors f ON f.statement_id = s.id
          WHERE s.text_id = ANY (${ids}) AND f.factor_key = ANY (${allKeys})
          GROUP BY s.id, s.text_id, s.body
        `,
      ])
    : [[], []];
  const byId = new Map(bodies.map((r) => [r.id, r]));
  // The claim that carries the most of the event's keys, to show why the passage ranks.
  const bestClaim = new Map<string, { body: string; n: number }>();
  for (const c of claimRows) {
    const cur = bestClaim.get(c.text_id);
    if (!cur || c.keys.length > cur.n) bestClaim.set(c.text_id, { body: c.body, n: c.keys.length });
  }
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const nums = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);

  return NextResponse.json({
    total: scored.length,
    counts,
    dropped,
    labels: Object.fromEntries(allKeys.map((k) => [k, FACTOR_BY_KEY.get(k)?.label ?? k])),
    items: pageRows.map((r) => {
      const t = byId.get(r.textId);
      const body = t?.body ?? "";
      return {
        textId: r.textId,
        score: Math.round(r.score * 10) / 10,
        covered: r.covered,
        together: r.together,
        claim: bestClaim.get(r.textId)?.body ?? null,
        excerpt: body.length > 700 ? `${body.slice(0, 690).replace(/\s+\S*$/, "")} …` : body,
        length: body.length,
        pages: nums(t?.pages),
        book: { id: "", title: t?.title ?? "", author: t?.author ?? null },
        breadcrumb: strs(t?.headings).map((text) => ({ text, keys: [] as string[] })),
      };
    }),
  });
}
