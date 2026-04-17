#!/usr/bin/env node
/**
 * Transactional migration runner for @elkdonis/db.
 *
 * Reads packages/db/migrations/*.sql in lexicographic order and applies any
 * that aren't already recorded in the `app_schema_migrations` tracking table.
 * Each migration runs inside a single transaction and records its SHA-256
 * checksum so drift against the stored content is detectable.
 *
 * Commands:
 *   node scripts/migrate.js              apply pending migrations
 *   node scripts/migrate.js --status     show applied / pending list
 *   node scripts/migrate.js --backfill   mark every file as applied without
 *                                        running it (one-shot: use on a DB
 *                                        that was migrated manually before
 *                                        this runner existed)
 *   node scripts/migrate.js --verify     recompute checksums and report any
 *                                        file whose contents changed after
 *                                        being applied
 *
 * Env:
 *   DATABASE_URL   postgres connection string
 *                  (default: postgres://postgres:postgres@postgres:5432/elkdonis_dev)
 */

import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@postgres:5432/elkdonis_dev';

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function readMigration(filename) {
  const content = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
  return { content, checksum: sha256(content) };
}

async function ensureTrackerTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      filename   TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getApplied() {
  const rows = await sql`
    SELECT filename, checksum, applied_at
    FROM app_schema_migrations
    ORDER BY filename
  `;
  return new Map(rows.map((r) => [r.filename, r]));
}

async function applyMigration(filename) {
  const { content, checksum } = readMigration(filename);
  process.stdout.write(`  → ${filename} ... `);
  await sql.begin(async (tx) => {
    await tx.unsafe(content);
    await tx`
      INSERT INTO app_schema_migrations (filename, checksum)
      VALUES (${filename}, ${checksum})
    `;
  });
  process.stdout.write('ok\n');
}

async function cmdStatus() {
  const applied = await getApplied();
  const files = listMigrationFiles();
  console.log('\nMigration status:');
  let pending = 0;
  for (const f of files) {
    if (applied.has(f)) {
      const row = applied.get(f);
      const when = new Date(row.applied_at).toISOString();
      console.log(`  ✓ ${f}   applied ${when}`);
    } else {
      console.log(`  · ${f}   pending`);
      pending++;
    }
  }
  // Orphan rows: tracked but file is gone
  for (const f of applied.keys()) {
    if (!files.includes(f)) {
      console.log(`  ! ${f}   tracked but file missing`);
    }
  }
  console.log(`\n${files.length} total, ${pending} pending`);
}

async function cmdBackfill() {
  const files = listMigrationFiles();
  const applied = await getApplied();
  let inserted = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const { checksum } = readMigration(f);
    await sql`
      INSERT INTO app_schema_migrations (filename, checksum)
      VALUES (${f}, ${checksum})
      ON CONFLICT (filename) DO NOTHING
    `;
    console.log(`  ✓ recorded ${f}`);
    inserted++;
  }
  console.log(`\nBackfill complete: ${inserted} file(s) recorded, ${files.length - inserted} already tracked`);
}

async function cmdVerify() {
  const applied = await getApplied();
  const files = listMigrationFiles();
  let drift = 0;
  for (const f of files) {
    if (!applied.has(f)) continue;
    const { checksum } = readMigration(f);
    const stored = applied.get(f).checksum;
    if (checksum !== stored) {
      console.log(`  ✗ ${f}   DRIFT (stored=${stored.slice(0, 12)}, disk=${checksum.slice(0, 12)})`);
      drift++;
    } else {
      console.log(`  ✓ ${f}`);
    }
  }
  console.log(`\n${drift} file(s) drifted`);
  if (drift > 0) process.exitCode = 2;
}

async function cmdApply() {
  const applied = await getApplied();
  const files = listMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('✓ Database is up to date');
    return;
  }

  console.log(`Applying ${pending.length} migration(s):`);
  for (const f of pending) {
    await applyMigration(f);
  }
  console.log(`\n✓ Applied ${pending.length} migration(s)`);
}

async function main() {
  const arg = process.argv[2] ?? '';
  try {
    await ensureTrackerTable();

    switch (arg) {
      case '--status':
        await cmdStatus();
        break;
      case '--backfill':
        await cmdBackfill();
        break;
      case '--verify':
        await cmdVerify();
        break;
      case '':
        await cmdApply();
        break;
      default:
        console.error(`Unknown command: ${arg}`);
        console.error('Usage: migrate.js [--status | --backfill | --verify]');
        process.exitCode = 1;
    }
  } catch (err) {
    console.error('\n✗ Migration failed:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
