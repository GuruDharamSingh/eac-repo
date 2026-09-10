#!/usr/bin/env node
/*
 * provision-user-folders.mjs
 * ==========================
 * Creates EAC_Network/users/<slug>/ for every person, under the SERVICE
 * account (NEXTCLOUD_ADMIN_USER), and shares each folder with that person's
 * Nextcloud account when they have one.
 *
 * Why folders are created for everyone, not just Nextcloud users:
 *   Most principals have no Nextcloud login and may never get one (17 of
 *   IFAC's 18 artists, for instance) but still need somewhere for their media
 *   to live. A Nextcloud account changes ACCESS, never LOCATION — so the
 *   folder exists from the start and a share is added later if they connect
 *   one. Tying creation to provisioning would leave those people homeless.
 *
 * Why only persons:
 *   Organizations already have folders at EAC_Network/<org_id>/, and all 121
 *   stored media URLs point there. Moving them would buy tidiness and cost a
 *   rewrite, so users/ is added as a sibling rather than a replacement.
 *
 * Usage (from repo root, inside a container or env with DB + NC access):
 *   DATABASE_URL=postgres://... NEXTCLOUD_URL=... \
 *   NEXTCLOUD_ADMIN_USER=... NEXTCLOUD_ADMIN_PASSWORD=... \
 *   node scripts/provision-user-folders.mjs [slug ...] [--dry-run] [--no-share]
 */

import { createRequire } from "module";

// Resolve `postgres` from @elkdonis/db's dependencies (the scripts dir has no
// node_modules of its own).
const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
);
const postgres = requireFromDb("postgres");

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const NO_SHARE = argv.includes("--no-share");
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

const sql = postgres(DB_URL);
const auth = `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")}`;

const PERM_WRITE = 15; // read+update+create+delete

// Mirrors STANDARD_ORG_SUBFOLDERS in packages/nextcloud/src/org-folders.ts —
// a principal folder gets the same shape an org folder does.
const SUBFOLDERS = [
  "Media",
  "Media/Images",
  "Media/Audio",
  "Media/Videos",
  "Media/Documents",
  "Private",
  "Private/Media",
  "Private/Media/Images",
  "Private/Media/Audio",
  "Private/Media/Videos",
  "Private/Media/Documents",
];

function davUrl(path) {
  const enc = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${enc}`;
}

async function mkcol(path) {
  const res = await fetch(davUrl(path), {
    method: "MKCOL",
    headers: { Authorization: auth },
  });
  // 405 = already exists.
  if (res.status !== 201 && res.status !== 405) {
    throw new Error(`MKCOL ${path} -> ${res.status}`);
  }
  return res.status === 201 ? "created" : "exists";
}

async function ensureTree(path) {
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    await mkcol(current);
  }
}

async function ocs(method, pathAndQuery, form) {
  const res = await fetch(`${NC_URL}/ocs/v2.php${pathAndQuery}`, {
    method,
    headers: {
      Authorization: auth,
      "OCS-APIRequest": "true",
      Accept: "application/json",
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? form.toString() : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.ocs?.data };
}

async function shareWith(path, recipient, permissions) {
  const q = new URLSearchParams({ path: `/${path}`, reshares: "true", format: "json" });
  const existing = await ocs("GET", `/apps/files_sharing/api/v1/shares?${q}`);
  const list = Array.isArray(existing.data) ? existing.data : [];
  const hit = list.find(
    (s) => Number(s.share_type) === 0 && s.share_with === recipient
  );
  if (hit) return "already shared";

  const form = new URLSearchParams({
    path: `/${path}`,
    shareType: "0",
    shareWith: recipient,
    permissions: String(permissions),
  });
  const res = await ocs("POST", "/apps/files_sharing/api/v1/shares?format=json", form);
  if (res.status >= 400) return `SHARE FAILED (${res.status})`;
  return "shared";
}

async function main() {
  const people = await sql`
    SELECT slug, display_name, nextcloud_user_id
    FROM users
    WHERE entity_type = 'person'
      AND slug IS NOT NULL
      ${SLUG_FILTER.length ? sql`AND slug = ANY(${SLUG_FILTER})` : sql``}
    ORDER BY slug
  `;

  if (people.length === 0) {
    console.log("No matching people.");
    await sql.end();
    return;
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Provisioning ${people.length} person folder(s) under ${ROOT}/users/\n`
  );

  let created = 0;
  let shared = 0;
  const failures = [];

  for (const p of people) {
    const base = `${ROOT}/users/${p.slug}`;

    if (DRY_RUN) {
      console.log(
        `  ${p.slug.padEnd(38)} would create ${base}` +
          (p.nextcloud_user_id ? ` + share -> ${p.nextcloud_user_id}` : "")
      );
      continue;
    }

    try {
      await ensureTree(base);
      let madeAny = false;
      for (const sub of SUBFOLDERS) {
        const r = await mkcol(`${base}/${sub}`);
        if (r === "created") madeAny = true;
      }
      if (madeAny) created++;

      let shareNote = "";
      if (p.nextcloud_user_id && !NO_SHARE) {
        const r = await shareWith(base, p.nextcloud_user_id, PERM_WRITE);
        if (r === "shared") shared++;
        if (r.startsWith("SHARE FAILED")) failures.push(`${p.slug}: ${r}`);
        shareNote = ` | ${p.nextcloud_user_id}: ${r}`;
      }

      console.log(
        `  ${p.slug.padEnd(38)} ${madeAny ? "created" : "exists "}${shareNote}`
      );
    } catch (err) {
      failures.push(`${p.slug}: ${err.message}`);
      console.log(`  ${p.slug.padEnd(38)} FAILED — ${err.message}`);
    }
  }

  console.log(
    `\nDone. ${created} folder tree(s) created, ${shared} share(s) added.`
  );
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
