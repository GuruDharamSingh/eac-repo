/**
 * Backfill compound and layer keys onto the claims already in the studio
 * (see src/compounds.ts). Re-runnable: it only adds rows that are missing,
 * all with role 'derived'. The importer derives the same keys on every
 * import, so this is needed once now and after any import made with an
 * older importer.
 *
 * Also tags the claims of book sections that are ABOUT an element, a quality
 * or polarity (astro_text_sections.subject_type element / mode / polarity,
 * from the outline pass) with that layer, role 'context'.
 *
 *   pnpm tsx scripts/derive-compounds.ts           dry run: counts only
 *   pnpm tsx scripts/derive-compounds.ts --write   write
 */

import { db } from "@elkdonis/db";
import { deriveCompounds } from "../src/compounds";
import { FACTOR_BY_KEY, isFactorKey } from "../src/factors";

const write = process.argv.includes("--write");

async function main() {
  const rows = await db<{ id: string; text_id: string; body: string; keys: string[] }[]>`
    SELECT s.id, s.text_id, s.body, COALESCE(array_agg(f.factor_key) FILTER (WHERE f.factor_key IS NOT NULL), '{}') AS keys
    FROM astro_statements s LEFT JOIN astro_statement_factors f ON f.statement_id = s.id
    GROUP BY s.id
  `;
  const add: { statement_id: string; text_id: string; factor_key: string; role: string }[] = [];
  for (const r of rows) for (const k of deriveCompounds(r.keys, r.body)) add.push({ statement_id: r.id, text_id: r.text_id, factor_key: k, role: "derived" });

  // Sections about a layer: their claims are about it too.
  const sections = await db<{ text_id: string; subject_type: string; subjects: string[] }[]>`
    SELECT text_id, subject_type, subjects FROM astro_text_sections WHERE subject_type IN ('element', 'mode', 'polarity')
  `;
  const layerOf = (type: string, subject: string): string | null => {
    const w = subject.toLowerCase();
    if (type === "element") for (const e of ["fire", "earth", "air", "water"]) if (w.includes(e)) return `element:${e}`;
    if (type === "mode") for (const m of ["cardinal", "fixed", "mutable"]) if (w.includes(m)) return `modality:${m}`;
    if (type === "polarity") {
      if (/masculine|positive|yang/.test(w)) return "polarity:masculine";
      if (/feminine|negative|yin/.test(w)) return "polarity:feminine";
    }
    return null;
  };
  const byText = new Map<string, Set<string>>();
  for (const s of sections) for (const subj of s.subjects) {
    const k = layerOf(s.subject_type, subj);
    if (k && isFactorKey(k)) byText.set(s.text_id, new Set([...(byText.get(s.text_id) ?? []), k]));
  }
  const have = new Set(rows.flatMap((r) => r.keys.map((k) => `${r.id}|${k}`)));
  const queued = new Set(add.map((a) => `${a.statement_id}|${a.factor_key}`));
  for (const r of rows) for (const k of byText.get(r.text_id) ?? []) {
    const id = `${r.id}|${k}`;
    if (!have.has(id) && !queued.has(id)) add.push({ statement_id: r.id, text_id: r.text_id, factor_key: k, role: "context" }), queued.add(id);
  }

  const byKind: Record<string, number> = {};
  for (const a of add) byKind[`${FACTOR_BY_KEY.get(a.factor_key)!.kind}/${a.role}`] = (byKind[`${FACTOR_BY_KEY.get(a.factor_key)!.kind}/${a.role}`] ?? 0) + 1;
  console.log(`${rows.length} claims read; ${add.length} derived keys to add`, byKind);
  console.log("examples:", add.slice(0, 3).map((a) => `${a.factor_key} ← ${rows.find((r) => r.id === a.statement_id)!.body.slice(0, 80)}`));
  if (!write) return console.log("dry run: pass --write to add them");

  const CHUNK = 1000;
  for (let i = 0; i < add.length; i += CHUNK) {
    const part = add.slice(i, i + CHUNK).map((a) => {
      const f = FACTOR_BY_KEY.get(a.factor_key)!;
      return { statement_id: a.statement_id, factor_key: a.factor_key, role: a.role, kind: f.kind, point: f.parts.point ?? null, other_point: null, sign: f.parts.sign ?? null, house: f.parts.house ?? null, aspect: null };
    });
    await db`INSERT INTO astro_statement_factors ${db(part, "statement_id", "factor_key", "role", "kind", "point", "other_point", "sign", "house", "aspect")} ON CONFLICT DO NOTHING`;
    // The passage carries them too, so text-level lookups (references) find it.
    const texts = [...new Map(add.slice(i, i + CHUNK).map((a) => [`${a.text_id}|${a.factor_key}`, { text_id: a.text_id, factor_key: a.factor_key, role: "mentioned", confidence: "inferred" }])).values()];
    await db`INSERT INTO astro_text_factors ${db(texts, "text_id", "factor_key", "role", "confidence")} ON CONFLICT DO NOTHING`;
  }
  console.log("written");
}

main()
  .then(() => db.end())
  .catch(async (e) => {
    console.error(e);
    await db.end();
    process.exit(1);
  });
