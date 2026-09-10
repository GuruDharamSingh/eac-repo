#!/usr/bin/env node
/*
 * migrate-member-media-to-user-folders.mjs
 * ========================================
 * Moves per-person media out of the org/pseudo-org trees and into that
 * person's own folder:
 *
 *   EAC_Network/ifac/Media/Images/<slug>/…      -> EAC_Network/users/<slug>/Media/Images/…
 *   EAC_Network/artdirect/Media/Images/<slug>/… -> EAC_Network/users/<slug>/Media/Images/…
 *
 * These were the last two of three competing "a person's media" schemes
 * (the third, personal orgs, stays as-is). A person's portfolio follows the
 * person; an org's own published assets stay with the org.
 *
 * NO DUPLICATION, BY CONSTRUCTION:
 *   - WebDAV MOVE, never COPY. Both paths live in the same Team folder
 *     (groupfolder 2), so a MOVE preserves the Nextcloud file id and its
 *     version history and leaves nothing behind.
 *   - Overwrite: F on every MOVE, so an existing target is never clobbered —
 *     it is reported and skipped instead.
 *   - Children are moved individually, so nested directories (geraldporter
 *     has one) move whole rather than being flattened.
 *
 * Per person: move first, then rewrite that person's URLs. A person whose
 * move fails keeps their old URLs, so nothing is left pointing at a file
 * that isn't there.
 *
 * Usage (from repo root, with DB + NC access):
 *   DATABASE_URL=postgres://... NEXTCLOUD_URL=... \
 *   NEXTCLOUD_ADMIN_USER=... NEXTCLOUD_ADMIN_PASSWORD=... \
 *   node scripts/migrate-member-media-to-user-folders.mjs [slug ...] [--dry-run]
 */

import { createRequire } from "module";

const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
);
const postgres = requireFromDb("postgres");

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const SLUG_FILTER = argv.filter((a) => !a.startsWith("--"));

const NC_URL = process.env.NEXTCLOUD_URL;
const NC_USER = process.env.NEXTCLOUD_ADMIN_USER;
const NC_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD;
const DB_URL = process.env.DATABASE_URL;
const ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || "EAC_Network";

if (!NC_URL || !NC_USER || !NC_PASS || !DB_URL) {
  console.error(
    "Required env: DATABASE_URL, NEXTCLOUD_URL, NEXTCLOUD_ADMIN_USER, NEXTCLOUD_ADMIN_PASSWORD"
  );
  process.exit(1);
}

// The org trees that currently hold per-person subfolders.
const SOURCE_TREES = ["ifac", "artdirect"];

const sql = postgres(DB_URL);
const auth = `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")}`;

function encPath(path) {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function davUrl(path) {
  return `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${encPath(path)}`;
}

/** Immediate children of a collection: [{ name, isDir }]. */
async function listChildren(path) {
  const res = await fetch(davUrl(path), {
    method: "PROPFIND",
    headers: { Authorization: auth, Depth: "1", "Content-Type": "application/xml" },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`,
  });
  if (res.status === 404) return null;
  if (res.status !== 207) throw new Error(`PROPFIND ${path} -> ${res.status}`);

  const xml = await res.text();
  const base = `/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${encPath(path)}`;
  const out = [];

  // One <d:response> per entry; the first is the collection itself.
  for (const block of xml.split(/<\/(?:d:|D:)?response>/i)) {
    const m = block.match(/<(?:d:|D:)?href>([^<]+)<\/(?:d:|D:)?href>/i);
    if (!m) continue;
    const href = decodeURIComponent(m[1]).replace(/\/$/, "");
    const self = decodeURIComponent(base).replace(/\/$/, "");
    if (href === self) continue; // skip the collection itself
    const name = href.slice(self.length + 1);
    if (!name || name.includes("/")) continue; // depth-1 only
    out.push({ name, isDir: /<(?:d:|D:)?collection\s*\/>/i.test(block) });
  }
  return out;
}

async function exists(path) {
  const res = await fetch(davUrl(path), {
    method: "PROPFIND",
    headers: { Authorization: auth, Depth: "0" },
  });
  return res.status === 207;
}

/** MOVE that refuses to overwrite. Returns 'moved' | 'target-exists'. */
async function move(from, to) {
  const res = await fetch(davUrl(from), {
    method: "MOVE",
    headers: {
      Authorization: auth,
      Destination: davUrl(to),
      Overwrite: "F",
    },
  });
  if (res.status === 412) return "target-exists"; // precondition failed
  if (res.status !== 201 && res.status !== 204) {
    throw new Error(`MOVE ${from} -> ${to} : ${res.status}`);
  }
  return "moved";
}

async function deleteIfEmpty(path) {
  const kids = await listChildren(path);
  if (kids === null || kids.length > 0) return false;
  const res = await fetch(davUrl(path), {
    method: "DELETE",
    headers: { Authorization: auth },
  });
  return res.status === 204;
}

async function main() {
  const people = await sql`
    SELECT id, slug, display_name
    FROM users
    WHERE entity_type = 'person'
      AND slug IS NOT NULL
      ${SLUG_FILTER.length ? sql`AND slug = ANY(${SLUG_FILTER})` : sql``}
    ORDER BY slug
  `;
  const bySlug = new Map(people.map((p) => [p.slug, p]));

  console.log(`${DRY_RUN ? "[dry-run] " : ""}Migrating per-person media into ${ROOT}/users/\n`);

  let movedFiles = 0;
  let migratedPeople = 0;
  const skipped = [];
  const failures = [];

  for (const tree of SOURCE_TREES) {
    const srcRoot = `${ROOT}/${tree}/Media/Images`;
    const children = await listChildren(srcRoot);
    if (!children) {
      console.log(`  (${srcRoot} not present — skipping)`);
      continue;
    }

    console.log(`--- ${srcRoot} ---`);
    for (const child of children) {
      if (!child.isDir) continue; // loose files belong to the org, leave them
      const slug = child.name;
      const person = bySlug.get(slug);
      if (!person) {
        skipped.push(`${tree}/${slug}: no users.slug match`);
        console.log(`  ${slug.padEnd(20)} SKIP — no matching person`);
        continue;
      }

      const from = `${srcRoot}/${slug}`;
      const to = `${ROOT}/users/${slug}/Media/Images`;

      if (!(await exists(to))) {
        skipped.push(`${slug}: target ${to} missing (run provision-user-folders.mjs first)`);
        console.log(`  ${slug.padEnd(20)} SKIP — target folder missing`);
        continue;
      }

      const entries = await listChildren(from);
      if (!entries || entries.length === 0) {
        console.log(`  ${slug.padEnd(20)} empty`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  ${slug.padEnd(20)} would move ${entries.length} entr(ies) -> ${to}`);
        continue;
      }

      let ok = 0;
      let clash = 0;
      try {
        for (const e of entries) {
          const r = await move(`${from}/${e.name}`, `${to}/${e.name}`);
          if (r === "moved") ok++;
          else {
            clash++;
            skipped.push(`${slug}/${e.name}: target already exists, left in place`);
          }
        }
      } catch (err) {
        failures.push(`${slug}: ${err.message}`);
        console.log(`  ${slug.padEnd(20)} FAILED — ${err.message} (URLs left untouched)`);
        continue;
      }

      movedFiles += ok;

      // Only rewrite URLs once this person's files actually arrived.
      const oldPrefix = `/${tree}/Media/Images/${slug}/`;
      const newPrefix = `/users/${slug}/Media/Images/`;
      const [upd] = await sql`
        UPDATE users
        SET avatar_url = replace(avatar_url, ${oldPrefix}, ${newPrefix}),
            portfolio  = replace(portfolio::text, ${oldPrefix}, ${newPrefix})::jsonb
        WHERE id = ${person.id}
        RETURNING id
      `;

      await deleteIfEmpty(from);
      migratedPeople++;
      console.log(
        `  ${slug.padEnd(20)} moved ${ok}${clash ? `, ${clash} clash` : ""} | urls ${upd ? "rewritten" : "unchanged"}`
      );
    }
    console.log("");
  }

  console.log(
    `Done. ${migratedPeople} person folder(s) migrated, ${movedFiles} entr(ies) moved.`
  );
  if (skipped.length) {
    console.log(`\n${skipped.length} skipped:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f}`);
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
