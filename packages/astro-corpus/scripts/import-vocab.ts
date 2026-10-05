/**
 * Import candidate vocabulary cards for "Sort the vocabulary" (migration 182,
 * src/vocab.ts). The cards are produced on the pipeline machine.
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/import-vocab.ts <file> [--trial|--write]
 *
 * <file> is relative to $CORPUS_DIR (e.g. inbox/vocab/cards-2026-10-01.json):
 *   {"cards": [{term, norm, sources: [{source, detail}], kind_hint, group_hint, books, uses,
 *               examples: [{text, book}], also: [..], deck_order}], "first_deck": 200}
 *
 * --trial (the default) checks the file and prints what would change; --write
 * upserts by norm. A re-import updates a card's term, hints, counts, examples
 * and deck order and keeps its id, so the owner's decisions (astro_reviews,
 * by card id) stay attached. Cards missing from a later file are left alone.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { ORG_ID } from "../src/sources";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const write = args.includes("--write");

const KIND_HINTS = new Set([
  "body_or_point",
  "sign_or_quality",
  "house_or_division",
  "aspect_or_configuration",
  "condition_or_state",
  "relation_or_rulership",
  "technique_or_method",
  "cycle_or_phase",
  "branch_or_school",
  "author_coinage",
  "correspondence",
]);
const TERM_MAX = 200;
const EXAMPLES_MAX = 5;
const EXAMPLE_CHARS = 1200;

interface Card {
  norm: string;
  term: string;
  kind_hint: string | null;
  group_hint: string | null;
  sources: { source: string; detail: string | null }[];
  books: number;
  uses: number;
  examples: { text: string; book: string | null }[];
  also: string[];
  deck_order: number | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const objs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** One card from the file, or the reason it was rejected. */
function readCard(raw: unknown): Card | string {
  if (!raw || typeof raw !== "object") return "not an object";
  const o = raw as Record<string, unknown>;
  const term = str(o.term);
  const norm = str(o.norm)?.toLowerCase() ?? term?.toLowerCase() ?? null;
  if (!term || !norm) return "no term";
  if (term.length > TERM_MAX || norm.length > TERM_MAX) return "term too long";
  const kind = str(o.kind_hint);
  const deck = typeof o.deck_order === "number" && Number.isInteger(o.deck_order) && o.deck_order > 0 ? o.deck_order : null;
  return {
    norm,
    term,
    kind_hint: kind && KIND_HINTS.has(kind) ? kind : null,
    group_hint: str(o.group_hint),
    sources: objs(o.sources).flatMap((s) => (str(s.source) ? [{ source: str(s.source)!, detail: str(s.detail) }] : [])),
    books: int(o.books),
    uses: int(o.uses),
    examples: objs(o.examples)
      .flatMap((e) => (str(e.text) ? [{ text: str(e.text)!.slice(0, EXAMPLE_CHARS), book: str(e.book) }] : []))
      .slice(0, EXAMPLES_MAX),
    also: [...new Set((Array.isArray(o.also) ? o.also : []).flatMap((a) => (str(a) && str(a) !== term ? [str(a)!] : [])))],
    deck_order: deck,
  };
}

async function main() {
  if (!file) throw new Error("usage: import-vocab.ts <file relative to $CORPUS_DIR> [--trial|--write]");
  const data = JSON.parse(readFileSync(path.join(CORPUS, file), "utf8")) as { cards?: unknown[]; first_deck?: number };
  if (!Array.isArray(data.cards)) throw new Error("the file has no cards array");
  const batch = path.basename(file).replace(/\.json$/, "");

  const cards = new Map<string, Card>();
  const rejected: Record<string, number> = {};
  let duplicates = 0;
  for (const raw of data.cards) {
    const c = readCard(raw);
    if (typeof c === "string") {
      rejected[c] = (rejected[c] ?? 0) + 1;
      continue;
    }
    if (cards.has(c.norm)) duplicates++;
    else cards.set(c.norm, c);
  }
  const list = [...cards.values()];
  const deck = list.filter((c) => c.deck_order !== null).sort((a, b) => a.deck_order! - b.deck_order!);
  let existing = new Set<string>();
  let tableMissing = false;
  try {
    existing = new Set(
      (await db<{ norm: string }[]>`SELECT norm FROM astro_vocab_cards WHERE org_id = ${ORG_ID} AND norm = ANY (${list.map((c) => c.norm)})`).map((r) => r.norm),
    );
  } catch (e) {
    // A trial can run before migration 182 is applied; a write can't.
    if (write || !/astro_vocab_cards/.test(String(e))) throw e;
    tableMissing = true;
  }
  const summary = {
    file,
    batch,
    cards: list.length,
    new: list.filter((c) => !existing.has(c.norm)).length,
    updated: list.filter((c) => existing.has(c.norm)).length,
    duplicates,
    rejected,
    firstDeck: { declared: data.first_deck ?? null, marked: deck.length },
    noKindHint: list.filter((c) => !c.kind_hint).length,
    noExamples: list.filter((c) => !c.examples.length).length,
    ...(tableMissing ? { warning: "astro_vocab_cards does not exist yet: apply migration 182 before --write" } : {}),
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log("first of the deck:", deck.slice(0, 10).map((c) => `${c.deck_order}. ${c.term}`).join(" · "));

  if (!write) {
    console.log("\ntrial only: nothing written (add --write to import)");
    await db.end();
    return;
  }
  const CHUNK = 500;
  for (let i = 0; i < list.length; i += CHUNK) {
    const rows = list.slice(i, i + CHUNK).map((c) => ({
      org_id: ORG_ID,
      norm: c.norm,
      term: c.term,
      kind_hint: c.kind_hint,
      group_hint: c.group_hint,
      sources: db.json(c.sources as never),
      books: c.books,
      uses: c.uses,
      examples: db.json(c.examples as never),
      also: c.also,
      deck_order: c.deck_order,
      batch,
    }));
    await db`
      INSERT INTO astro_vocab_cards ${db(rows, "org_id", "norm", "term", "kind_hint", "group_hint", "sources", "books", "uses", "examples", "also", "deck_order", "batch")}
      ON CONFLICT (org_id, norm) DO UPDATE SET
        term = EXCLUDED.term,
        kind_hint = EXCLUDED.kind_hint,
        group_hint = EXCLUDED.group_hint,
        sources = EXCLUDED.sources,
        books = EXCLUDED.books,
        uses = EXCLUDED.uses,
        examples = EXCLUDED.examples,
        also = EXCLUDED.also,
        deck_order = EXCLUDED.deck_order,
        batch = EXCLUDED.batch
    `;
  }
  console.log(`\nWROTE ${list.length} cards`);
  await db.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await db.end();
  process.exit(1);
});
