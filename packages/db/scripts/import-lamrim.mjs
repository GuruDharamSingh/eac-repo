#!/usr/bin/env node
/**
 * Import the Lam Rim bundle (built on the PC: WSL ~/chunker `python -m chunker.lamrim bundle`)
 * into the lamrim_* tables (migration 198).
 *
 *   docker compose run --rm --no-deps -v ~/lamrim-corpus:/data -w /app/packages/db admin \
 *     node scripts/import-lamrim.mjs /data            (dry run: counts only)
 *     node scripts/import-lamrim.mjs /data --write
 *
 * Nodes, passages and units are replaced. Items are upserted by their stable id; items missing
 * from the new bundle are retired (retired_at), never deleted, because reviews point at them.
 * Reviews are never touched.
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const write = process.argv.includes('--write');
if (!dir) {
  console.error('usage: import-lamrim.mjs <bundle dir> [--write]');
  process.exit(1);
}
const read = (f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const nodes = read('nodes.jsonl');
const passages = read('passages.jsonl');
const units = read('units.jsonl');
const items = read('items.jsonl');
const books = read('books.jsonl');
const parts = read('parts.jsonl');
console.log(`bundle: ${nodes.length} nodes, ${passages.length} passages, ${units.length} units, ${items.length} items, ${books.length} books, ${parts.length} book parts`);
if (!write) {
  console.log('dry run; add --write to import');
  process.exit(0);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
await sql.begin(async (tx) => {
  await tx`DELETE FROM lamrim_nodes`;
  await tx`DELETE FROM lamrim_passages`;
  await tx`DELETE FROM lamrim_units`;
  await tx`DELETE FROM lamrim_books`;
  await tx`DELETE FROM lamrim_book_parts`;
  await tx`INSERT INTO lamrim_books ${tx(books.map((b, ord) => ({ ...b, ord })), 'source', 'title', 'author', 'parts', 'words', 'ord')}`;
  for (const c of chunks(parts, 200)) await tx`INSERT INTO lamrim_book_parts ${tx(c, 'id', 'source', 'seq', 'heading', 'chapter', 'page', 'node_id', 'body')}`;
  for (const c of chunks(nodes, 500)) await tx`INSERT INTO lamrim_nodes ${tx(c, 'id', 'parent', 'ord', 'depth', 'marker', 'title', 'vol', 'page', 'chapter', 'chapter_title', 'part', 'editorial')}`;
  for (const c of chunks(passages, 200)) await tx`INSERT INTO lamrim_passages ${tx(c, 'id', 'node_id', 'kind', 'title', 'words', 'body')}`;
  for (const c of chunks(units, 200)) await tx`INSERT INTO lamrim_units ${tx(c, 'id', 'source', 'node_id', 'seq', 'heading', 'page', 'sim', 'body')}`;
  const ids = items.map((i) => i.id);
  for (const c of chunks(items, 300)) {
    const rows = c.map((i) => ({ id: i.id, kind: i.kind, node_ids: i.node_ids, source: i.source, payload: i.payload }));
    await tx`
      INSERT INTO lamrim_items ${tx(rows.map((r) => ({ ...r, payload: tx.json(r.payload) })), 'id', 'kind', 'node_ids', 'source', 'payload')}
      ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, node_ids = EXCLUDED.node_ids, source = EXCLUDED.source,
        payload = EXCLUDED.payload, imported_at = now(), retired_at = NULL`;
  }
  const retired = await tx`UPDATE lamrim_items SET retired_at = now() WHERE retired_at IS NULL AND NOT (id = ANY(${ids})) RETURNING id`;
  console.log(`retired ${retired.length} items no longer in the bundle`);
});
const [n] = await sql`SELECT (SELECT count(*) FROM lamrim_nodes)::int AS nodes, (SELECT count(*) FROM lamrim_items WHERE retired_at IS NULL)::int AS items, (SELECT count(*) FROM lamrim_reviews)::int AS reviews`;
console.log('now:', n);
await sql.end();
