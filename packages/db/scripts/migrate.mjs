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
 *   DATABASE_URL   postgres connection string (required — no default; a
 *                  runner that guesses a password can migrate the wrong DB)
 */

import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL is not set');
  process.exit(1);
}

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

/**
 * 49 of the first 133 files wrap themselves in `BEGIN; ... COMMIT;`. Run as-is
 * inside sql.begin, the file's COMMIT ends the RUNNER's transaction: anything
 * after it autocommits and the tracker INSERT lands outside, so a failure
 * could leave a migration applied but unrecorded. The files cannot be edited
 * (their checksums are stored), so the statements are dropped here instead and
 * the runner's transaction is the only one. A line that is exactly `BEGIN;` is
 * never PL/pgSQL — a block's BEGIN carries no semicolon.
 */
const OWN_TX = /^[ \t]*(BEGIN|START[ \t]+TRANSACTION|COMMIT)[ \t]*;[ \t]*(--.*)?$/gim;

function stripOwnTransaction(content) {
  return content.replace(OWN_TX, '-- (transaction statement removed by migrate.mjs)');
}

// One runner at a time. Parallel sessions are how five numbers got used twice.
const LOCK_KEY = 7246001;

async function applyMigration(filename) {
  const { content, checksum } = readMigration(filename);
  process.stdout.write(`  → ${filename} ... `);
  await sql.begin(async (tx) => {
    await tx.unsafe(stripOwnTransaction(content));
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

  // A pending file must not reuse a number. (052, 054, 102, 103 and 112 already
  // do, and stay: they are applied and renaming them would orphan their rows.)
  const prefix = (f) => f.match(/^\d+/)?.[0];
  for (const f of pending) {
    const clash = files.find((g) => g !== f && prefix(g) && prefix(g) === prefix(f));
    if (clash) {
      throw new Error(`${f} reuses migration number ${prefix(f)} (also ${clash}) — renumber it`);
    }
  }

  // Edited history is a stop sign, not a --verify footnote.
  const drifted = files.filter(
    (f) => applied.has(f) && applied.get(f).checksum !== readMigration(f).checksum
  );
  if (drifted.length > 0 && !process.env.MIGRATE_ALLOW_DRIFT) {
    throw new Error(
      `applied migration(s) changed on disk: ${drifted.join(', ')} — restore them, ` +
        'or set MIGRATE_ALLOW_DRIFT=1 if the edit was deliberate'
    );
  }

  const [{ locked }] = await sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`;
  if (!locked) throw new Error('another migration run holds the lock');

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
