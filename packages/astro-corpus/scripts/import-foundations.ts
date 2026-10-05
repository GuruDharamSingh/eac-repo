/**
 * Import the "Foundations" material (migration 183, src/foundations.ts):
 * lesson sheets and per-book term catalogues, produced on the pipeline machine.
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/import-foundations.ts [what] [--trial|--write]
 *
 * [what] is one of
 *   <lesson>             $CORPUS_DIR/foundations/<lesson>/sheet.json       (e.g. elements)
 *   catalogue/<slug>     $CORPUS_DIR/foundations/catalogue/<slug>.json     (e.g. catalogue/marks-art-of-chart-interpretation)
 *   correspondences/<slug>  $CORPUS_DIR/foundations/correspondences/<slug>.json  (the correspondence table, migration 184)
 *   outline/<slug>       $CORPUS_DIR/foundations/outline/<slug>.json   a book's sections per placement  ┐ the Library's
 *   glossary/<slug>      $CORPUS_DIR/foundations/glossary/<slug>.json  a book's glossary                ├ read-only material
 *   people/<slug>        $CORPUS_DIR/foundations/people/<slug>.json    famous people by placement       │ (migration 185)
 *   readings/<slug>      $CORPUS_DIR/foundations/readings/<slug>.json  a worked chart reading, sentence by sentence ┘
 *   sections/<book>      $CORPUS_DIR/foundations/sections/<book>.sections.json  a book's outline: stamps each imported
 *                        passage of that book with its section (kind of reading, title, subjects; migration 186)
 *   cards/<file>         $CORPUS_DIR/foundations/cards/<file>.json  book cards, stored on the matching outline (migration 187)
 *   (nothing)            every file found in those folders (an empty or missing folder is fine)
 *
 * --trial (the default) checks the files and prints what would change;
 * --write upserts. Items are matched by the sheet's stable id and terms by
 * their id within the book, so a re-import updates them in place and keeps
 * their row ids: the owner's decisions (astro_reviews, by row id) stay
 * attached. An item or term missing from a newer file is removed when the
 * owner never touched it, and marked stale (kept, with his decision) when he
 * did. Items he added himself are never touched.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { ORG_ID } from "../src/sources";
import { FOUNDATION_ACTIONS, readCatalogue, readCorrespondences, readFoundationSheet } from "../src/foundations-rules";
import { readBookCards, readLibraryFile, readSectionsFile } from "../src/library-rules";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const ROOT = path.join(CORPUS, "foundations");
const args = process.argv.slice(2);
const what = args.find((a) => !a.startsWith("--"));
const write = args.includes("--write");
const CHUNK = 200;

/** Row ids (items or terms) that any foundation review names. */
async function reviewedIds(): Promise<Set<string>> {
  const rows = await db<{ id: string | null }[]>`
    SELECT DISTINCT x.id FROM astro_reviews r,
      LATERAL (VALUES (r.payload->>'itemId'), (r.payload->>'intoItemId'), (r.payload->>'termId'), (r.payload->>'cellId')) AS x(id)
    WHERE r.org_id = ${ORG_ID} AND r.question_id IS NULL AND r.action = ANY (${[...FOUNDATION_ACTIONS]}) AND x.id IS NOT NULL
  `;
  return new Set(rows.flatMap((r) => (r.id ? [r.id] : [])));
}

async function importSheet(lessonDir: string) {
  const file = path.join(ROOT, lessonDir, "sheet.json");
  const sheet = readFoundationSheet(JSON.parse(readFileSync(file, "utf8")));
  const existing = await db<{ id: string; item_key: string }[]>`
    SELECT id, item_key FROM astro_foundation_items WHERE org_id = ${ORG_ID} AND lesson = ${sheet.lesson} AND origin = 'books'`;
  const keys = new Set(sheet.items.map((i) => i.key));
  const have = new Set(existing.map((e) => e.item_key));
  const missing = existing.filter((e) => !keys.has(e.item_key));
  const reviewed = missing.length ? await reviewedIds() : new Set<string>();
  const stale = missing.filter((e) => reviewed.has(e.id));
  const remove = missing.filter((e) => !reviewed.has(e.id));
  const count = (f: (i: (typeof sheet.items)[number]) => string) => sheet.items.reduce<Record<string, number>>((m, i) => ((m[f(i)] = (m[f(i)] ?? 0) + 1), m), {});
  console.log(
    JSON.stringify(
      {
        file,
        lesson: sheet.lesson,
        title: sheet.title,
        version: sheet.version,
        shelf: sheet.shelf.length,
        concepts: sheet.concepts.map((c) => c.id),
        items: sheet.items.length,
        byKind: count((i) => i.kind),
        byConcept: count((i) => i.concept),
        byFacet: count((i) => i.facet),
        new: sheet.items.filter((i) => !have.has(i.key)).length,
        updated: sheet.items.filter((i) => have.has(i.key)).length,
        missingFromThisFile: { markedStale: stale.length, removedUnreviewed: remove.length },
        duplicates: sheet.duplicates,
        rejected: sheet.rejected,
      },
      null,
      2,
    ),
  );
  if (lessonDir !== sheet.lesson) console.log(`note: the folder is "${lessonDir}" but the sheet says lesson "${sheet.lesson}"; the sheet wins`);
  if (!write) return;

  await db.begin(async (tx) => {
    await tx`
      INSERT INTO astro_foundation_lessons (org_id, lesson, title, version, shelf, concepts)
      VALUES (${ORG_ID}, ${sheet.lesson}, ${sheet.title}, ${sheet.version}, ${tx.json(sheet.shelf as never)}, ${tx.json(sheet.concepts as never)})
      ON CONFLICT (org_id, lesson) DO UPDATE SET
        title = EXCLUDED.title, version = EXCLUDED.version, shelf = EXCLUDED.shelf, concepts = EXCLUDED.concepts, updated_at = now()
    `;
    for (let i = 0; i < sheet.items.length; i += CHUNK) {
      const rows = sheet.items.slice(i, i + CHUNK).map((it) => ({
        org_id: ORG_ID,
        lesson: sheet.lesson,
        concept: it.concept,
        kind: it.kind,
        item_key: it.key,
        text: it.text,
        payload: tx.json({ meaning: it.meaning, role: it.role, mode: it.mode, facet: it.facet, degree: it.degree, sources: it.sources } as never),
        books: it.books,
        uses: it.uses,
        version: sheet.version,
      }));
      await tx`
        INSERT INTO astro_foundation_items ${tx(rows, "org_id", "lesson", "concept", "kind", "item_key", "text", "payload", "books", "uses", "version")}
        ON CONFLICT (org_id, lesson, item_key) DO UPDATE SET
          concept = EXCLUDED.concept,
          kind = EXCLUDED.kind,
          text = EXCLUDED.text,
          payload = EXCLUDED.payload,
          books = EXCLUDED.books,
          uses = EXCLUDED.uses,
          version = EXCLUDED.version,
          stale = false,
          updated_at = now()
        WHERE astro_foundation_items.origin = 'books'
      `;
    }
    if (stale.length) await tx`UPDATE astro_foundation_items SET stale = true, updated_at = now() WHERE id = ANY (${stale.map((e) => e.id)}::uuid[])`;
    if (remove.length) await tx`DELETE FROM astro_foundation_items WHERE id = ANY (${remove.map((e) => e.id)}::uuid[]) AND origin = 'books'`;
  });
  console.log(`WROTE lesson ${sheet.lesson}: ${sheet.items.length} items`);
}

async function importCatalogue(slug: string) {
  const file = path.join(ROOT, "catalogue", `${slug}.json`);
  const cat = readCatalogue(JSON.parse(readFileSync(file, "utf8")));
  const existing = await db<{ id: string; term_key: string }[]>`
    SELECT id, term_key FROM astro_foundation_terms WHERE org_id = ${ORG_ID} AND book_slug = ${slug}`;
  const keys = new Set(cat.terms.map((t) => t.key));
  const have = new Set(existing.map((e) => e.term_key));
  const missing = existing.filter((e) => !keys.has(e.term_key));
  const reviewed = missing.length ? await reviewedIds() : new Set<string>();
  const stale = missing.filter((e) => reviewed.has(e.id));
  const remove = missing.filter((e) => !reviewed.has(e.id));
  console.log(
    JSON.stringify(
      {
        file,
        slug,
        book: cat.book,
        author: cat.author,
        terms: cat.terms.length,
        byGroup: cat.terms.reduce<Record<string, number>>((m, t) => ((m[t.group] = (m[t.group] ?? 0) + 1), m), {}),
        new: cat.terms.filter((t) => !have.has(t.key)).length,
        updated: cat.terms.filter((t) => have.has(t.key)).length,
        missingFromThisFile: { markedStale: stale.length, removedUnreviewed: remove.length },
        duplicates: cat.duplicates,
        rejected: cat.rejected,
      },
      null,
      2,
    ),
  );
  if (!write) return;

  await db.begin(async (tx) => {
    await tx`
      INSERT INTO astro_foundation_catalogues (org_id, slug, book, author) VALUES (${ORG_ID}, ${slug}, ${cat.book}, ${cat.author})
      ON CONFLICT (org_id, slug) DO UPDATE SET book = EXCLUDED.book, author = EXCLUDED.author, updated_at = now()
    `;
    for (let i = 0; i < cat.terms.length; i += CHUNK) {
      const rows = cat.terms.slice(i, i + CHUNK).map((t, j) => ({
        org_id: ORG_ID,
        book_slug: slug,
        term_key: t.key,
        term: t.term,
        grp: t.group,
        payload: tx.json({
          facet: t.facet,
          code: t.code,
          keywords: t.keywords,
          secondary: t.secondary,
          definition: t.definition,
          how_to_weigh: t.howToWeigh,
          figure: t.figure,
          related: t.related,
          pages: t.pages,
          book_pages: t.bookPages,
          quote: t.quote,
          note: t.note,
        } as never),
        position: i + j + 1,
      }));
      await tx`
        INSERT INTO astro_foundation_terms ${tx(rows, "org_id", "book_slug", "term_key", "term", "grp", "payload", "position")}
        ON CONFLICT (org_id, book_slug, term_key) DO UPDATE SET
          term = EXCLUDED.term, grp = EXCLUDED.grp, payload = EXCLUDED.payload, position = EXCLUDED.position, stale = false, updated_at = now()
      `;
    }
    if (stale.length) await tx`UPDATE astro_foundation_terms SET stale = true, updated_at = now() WHERE id = ANY (${stale.map((e) => e.id)}::uuid[])`;
    if (remove.length) await tx`DELETE FROM astro_foundation_terms WHERE id = ANY (${remove.map((e) => e.id)}::uuid[])`;
  });
  console.log(`WROTE catalogue ${slug}: ${cat.terms.length} terms`);
}

async function importCorrespondences(slug: string) {
  const file = path.join(ROOT, "correspondences", `${slug}.json`);
  const data = readCorrespondences(JSON.parse(readFileSync(file, "utf8")));
  const existing = await db<{ id: string; cell_key: string }[]>`
    SELECT id, cell_key FROM astro_correspondences WHERE org_id = ${ORG_ID} AND book_slug = ${slug} AND origin = 'books'`;
  const keys = new Set(data.rows.map((r) => r.key));
  const have = new Set(existing.map((e) => e.cell_key));
  const missing = existing.filter((e) => !keys.has(e.cell_key));
  const reviewed = missing.length ? await reviewedIds() : new Set<string>();
  const stale = missing.filter((e) => reviewed.has(e.id));
  const remove = missing.filter((e) => !reviewed.has(e.id));
  const by = (f: (r: (typeof data.rows)[number]) => string) => data.rows.reduce<Record<string, number>>((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
  console.log(
    JSON.stringify(
      {
        file,
        slug,
        book: data.book,
        author: data.author,
        rows: data.rows.length,
        bySubjectType: by((r) => r.subjectType),
        categories: new Set(data.rows.map((r) => r.category)).size,
        new: data.rows.filter((r) => !have.has(r.key)).length,
        updated: data.rows.filter((r) => have.has(r.key)).length,
        missingFromThisFile: { markedStale: stale.length, removedUnreviewed: remove.length },
        duplicates: data.duplicates,
        rejected: data.rejected,
      },
      null,
      2,
    ),
  );
  if (!write) return;
  await db.begin(async (tx) => {
    for (let i = 0; i < data.rows.length; i += CHUNK) {
      const rows = data.rows.slice(i, i + CHUNK).map((r, j) => ({
        org_id: ORG_ID,
        book_slug: slug,
        cell_key: r.key,
        subject_type: r.subjectType,
        subject: r.subject,
        category: r.category,
        value: r.value,
        payload: tx.json({ page: r.page, source: r.source, derived_from: r.derivedFrom, scheme: r.scheme, facet: r.facet, degree: r.degree, note: r.note ?? null, tone: r.tone ?? null, label: r.label ?? null, book: data.book, author: data.author } as never),
        position: i + j + 1,
      }));
      await tx`
        INSERT INTO astro_correspondences ${tx(rows, "org_id", "book_slug", "cell_key", "subject_type", "subject", "category", "value", "payload", "position")}
        ON CONFLICT (org_id, book_slug, cell_key) DO UPDATE SET
          subject_type = EXCLUDED.subject_type, subject = EXCLUDED.subject, category = EXCLUDED.category, value = EXCLUDED.value,
          payload = EXCLUDED.payload, position = EXCLUDED.position, stale = false, updated_at = now()
        WHERE astro_correspondences.origin = 'books'
      `;
    }
    if (stale.length) await tx`UPDATE astro_correspondences SET stale = true, updated_at = now() WHERE id = ANY (${stale.map((e) => e.id)}::uuid[])`;
    if (remove.length) await tx`DELETE FROM astro_correspondences WHERE id = ANY (${remove.map((e) => e.id)}::uuid[]) AND origin = 'books'`;
  });
  console.log(`WROTE correspondences ${slug}: ${data.rows.length} rows`);
}

/** A book's outline: stamp its imported passages (matched by doc hash + chunk index) and keep the outline. */
async function importSections(name: string) {
  const file = path.join(ROOT, "sections", `${name}.sections.json`);
  const data = readSectionsFile(JSON.parse(readFileSync(file, "utf8")));
  const texts = await db<{ id: string; chunk: number; source_id: string }[]>`
    SELECT id, (meta->>'chunkIndex')::int AS chunk, source_id FROM astro_texts
    WHERE org_id = ${ORG_ID} AND kind = 'import' AND meta->>'docHash' = ${data.doc} AND meta->>'chunkIndex' IS NOT NULL`;
  const byChunk = new Map(texts.map((t) => [t.chunk, t]));
  const matched = data.stamps.filter((p) => byChunk.has(p.chunk));
  const unmatched = data.stamps.filter((p) => !byChunk.has(p.chunk));
  const count = (list: typeof data.stamps, f: (p: (typeof data.stamps)[number]) => string) => list.reduce<Record<string, number>>((m, p) => ((m[f(p)] = (m[f(p)] ?? 0) + 1), m), {});
  const stats = {
    passagesInFile: data.stamps.length,
    matched: matched.length,
    notMatched: unmatched.length,
    importedPassagesWithoutStamp: texts.filter((t) => !data.stamps.some((p) => p.chunk === t.chunk)).length,
    byKind: count(matched, (p) => p.kind),
    notMatchedByKind: count(unmatched, (p) => p.kind),
    filedInASilo: matched.filter((p) => p.silos.length && p.kind !== "front_back").length,
    chapterOnly: matched.filter((p) => !p.silos.length && p.kind !== "front_back").length,
  };
  console.log(JSON.stringify({ file, slug: name, book: data.book, doc: data.doc.slice(0, 16), importedPassagesOfThisBook: texts.length, sections: data.sections.length, ...stats, rejected: data.rejected }, null, 2));
  if (!texts.length) console.log(`note: no imported passages have docHash ${data.doc.slice(0, 16)}…; nothing can be stamped`);
  if (!write) return;
  const sections = data.sections.map((sec) => ({ ...sec, passages: matched.filter((p) => p.chunk >= sec.from && p.chunk <= sec.to).length }));
  await db.begin(async (tx) => {
    await tx`DELETE FROM astro_text_sections WHERE org_id = ${ORG_ID} AND book_slug = ${name} AND NOT (text_id = ANY (${matched.map((p) => byChunk.get(p.chunk)!.id)}::uuid[]))`;
    for (let i = 0; i < matched.length; i += CHUNK)
      for (const p of matched.slice(i, i + CHUNK))
        await tx`
          INSERT INTO astro_text_sections (text_id, org_id, book_slug, chunk_index, kind, title, chapter, subject_type, subjects, layout, silos)
          VALUES (${byChunk.get(p.chunk)!.id}, ${ORG_ID}, ${name}, ${p.chunk}, ${p.kind}, ${p.title}, ${p.chapter}, ${p.subjectType}, ${p.subjects}, ${p.layout}, ${p.silos})
          ON CONFLICT (text_id) DO UPDATE SET
            book_slug = EXCLUDED.book_slug, chunk_index = EXCLUDED.chunk_index, kind = EXCLUDED.kind, title = EXCLUDED.title, chapter = EXCLUDED.chapter,
            subject_type = EXCLUDED.subject_type, subjects = EXCLUDED.subjects, layout = EXCLUDED.layout, silos = EXCLUDED.silos, updated_at = now()
        `;
    await tx`
      INSERT INTO astro_book_outlines (org_id, slug, book, doc_hash, source_id, sections, stats)
      VALUES (${ORG_ID}, ${name}, ${data.book}, ${data.doc}, ${texts[0]?.source_id ?? null}, ${tx.json(sections as never)}, ${tx.json(stats as never)})
      ON CONFLICT (org_id, slug) DO UPDATE SET book = EXCLUDED.book, doc_hash = EXCLUDED.doc_hash, source_id = EXCLUDED.source_id, sections = EXCLUDED.sections, stats = EXCLUDED.stats, updated_at = now()
    `;
  });
  console.log(`WROTE sections ${name}: ${matched.length} passages stamped, ${unmatched.length} not matched`);
}

/** Book cards: each is stored on the outline with the same slug; a card with no outline is reported and skipped. */
async function importCards(name: string) {
  const file = path.join(ROOT, "cards", `${name}.json`);
  const data = readBookCards(JSON.parse(readFileSync(file, "utf8")));
  const outlines = await db<{ slug: string; has: boolean }[]>`SELECT slug, card IS NOT NULL AS has FROM astro_book_outlines WHERE org_id = ${ORG_ID}`;
  const slugs = new Set(outlines.map((o) => o.slug));
  const matched = data.cards.filter((c) => slugs.has(c.slug));
  const without = data.cards.filter((c) => !slugs.has(c.slug)).map((c) => c.slug);
  console.log(
    JSON.stringify(
      { file, cards: data.cards.length, matchedAnOutline: matched.length, noOutline: without, outlinesWithoutACard: outlines.filter((o) => !data.cards.some((c) => c.slug === o.slug) && !o.has).map((o) => o.slug), rejected: data.rejected },
      null,
      2,
    ),
  );
  if (!write) return;
  await db.begin(async (tx) => {
    for (const c of matched) await tx`UPDATE astro_book_outlines SET card = ${tx.json(c as never)}, updated_at = now() WHERE org_id = ${ORG_ID} AND slug = ${c.slug}`;
  });
  console.log(`WROTE cards ${name}: ${matched.length} cards`);
}

const LIBRARY_KIND = { outline: "section", glossary: "glossary", people: "person", readings: "reading" } as const;
type LibraryFolder = keyof typeof LIBRARY_KIND;

/** Outline, glossary and people files: nothing in them is reviewed, so a re-import replaces the book's entries of that kind. */
async function importLibrary(folder: LibraryFolder, slug: string) {
  const file = path.join(ROOT, folder, `${slug}.json`);
  const data = readLibraryFile(folder, JSON.parse(readFileSync(file, "utf8")));
  const kind = LIBRARY_KIND[folder];
  const existing = await db<{ entry_key: string }[]>`SELECT entry_key FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = ${kind} AND book_slug = ${slug}`;
  const have = new Set(existing.map((e) => e.entry_key));
  const keys = data.entries.map((e) => e.key);
  console.log(
    JSON.stringify(
      {
        file,
        kind,
        book: data.book,
        entries: data.entries.length,
        new: data.entries.filter((e) => !have.has(e.key)).length,
        updated: data.entries.filter((e) => have.has(e.key)).length,
        removed: existing.filter((e) => !keys.includes(e.entry_key)).length,
        rejectedOrDuplicate: data.rejected,
      },
      null,
      2,
    ),
  );
  if (!write) return;
  await db.begin(async (tx) => {
    await tx`DELETE FROM astro_library_entries WHERE org_id = ${ORG_ID} AND kind = ${kind} AND book_slug = ${slug} AND NOT (entry_key = ANY (${keys}))`;
    for (let i = 0; i < data.entries.length; i += CHUNK) {
      const rows = data.entries.slice(i, i + CHUNK).map((e, j) => ({
        org_id: ORG_ID,
        kind,
        book_slug: slug,
        entry_key: e.key,
        silo: e.silo,
        title: e.title,
        body: e.body,
        payload: tx.json(e.payload as never),
        position: i + j + 1,
      }));
      await tx`
        INSERT INTO astro_library_entries ${tx(rows, "org_id", "kind", "book_slug", "entry_key", "silo", "title", "body", "payload", "position")}
        ON CONFLICT (org_id, kind, book_slug, entry_key) DO UPDATE SET
          silo = EXCLUDED.silo, title = EXCLUDED.title, body = EXCLUDED.body, payload = EXCLUDED.payload, position = EXCLUDED.position, updated_at = now()
      `;
    }
  });
  console.log(`WROTE ${folder} ${slug}: ${data.entries.length} entries`);
}

async function main() {
  const SLUG = /^[a-z0-9][a-z0-9_-]{0,80}$/;
  type Folder = "catalogue" | "correspondences" | LibraryFolder;
  const FOLDERS: string[] = ["catalogue", "correspondences", "outline", "glossary", "people", "readings", "sections", "cards"];
  const targets: { kind: "sheet" | "sections" | "cards" | Folder; name: string }[] = [];
  if (what) {
    const m = /^(catalogue|correspondences|outline|glossary|people|readings|sections|cards)\/([^/]+?)(\.sections)?(\.json)?$/.exec(what);
    const name = m ? m[2] : what.replace(/\/sheet\.json$/, "");
    if (!SLUG.test(name) || name === "owner") throw new Error(`"${what}" is not a lesson, catalogue/<book-slug> or correspondences/<book-slug>`);
    targets.push({ kind: m ? (m[1] as Folder | "sections" | "cards") : "sheet", name });
  } else if (existsSync(ROOT)) {
    for (const d of readdirSync(ROOT, { withFileTypes: true }))
      if (d.isDirectory() && !FOLDERS.includes(d.name) && SLUG.test(d.name) && existsSync(path.join(ROOT, d.name, "sheet.json"))) targets.push({ kind: "sheet", name: d.name });
    const catDir = path.join(ROOT, "catalogue");
    if (existsSync(catDir))
      for (const f of readdirSync(catDir)) if (f.endsWith(".json") && SLUG.test(f.slice(0, -5))) targets.push({ kind: "catalogue", name: f.slice(0, -5) });
    for (const folder of ["outline", "glossary", "people", "readings"] as const) {
      const dir = path.join(ROOT, folder);
      if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".json") && SLUG.test(f.slice(0, -5))) targets.push({ kind: folder, name: f.slice(0, -5) });
    }
    const secDir = path.join(ROOT, "sections");
    if (existsSync(secDir)) for (const f of readdirSync(secDir).sort()) if (f.endsWith(".sections.json") && SLUG.test(f.slice(0, -14))) targets.push({ kind: "sections", name: f.slice(0, -14) });
    const cardDir = path.join(ROOT, "cards");
    if (existsSync(cardDir)) for (const f of readdirSync(cardDir).sort()) if (f.endsWith(".json") && SLUG.test(f.slice(0, -5))) targets.push({ kind: "cards", name: f.slice(0, -5) });
    const corrDir = path.join(ROOT, "correspondences");
    if (existsSync(corrDir))
      for (const f of readdirSync(corrDir)) if (f.endsWith(".json") && SLUG.test(f.slice(0, -5)) && f !== "owner.json") targets.push({ kind: "correspondences", name: f.slice(0, -5) });
  }
  if (!targets.length) throw new Error(`nothing to import under ${ROOT}`);
  for (const t of targets)
    await (t.kind === "sheet" ? importSheet(t.name) : t.kind === "catalogue" ? importCatalogue(t.name) : t.kind === "correspondences" ? importCorrespondences(t.name) : t.kind === "sections" ? importSections(t.name) : t.kind === "cards" ? importCards(t.name) : importLibrary(t.kind, t.name));
  if (!write) console.log("\ntrial only: nothing written (add --write to import)");
  await db.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await db.end();
  process.exit(1);
});
