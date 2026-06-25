#!/usr/bin/env node
/*
 * backfill-org-nextcloud.mjs
 * ==========================
 * One-time backfill for the service-account org provisioning model.
 *
 * For each org (or the ones passed as args):
 *   1. Ensure EAC_Network/{orgId}/ tree (+ silex/project, silex/published)
 *      exists under the SERVICE account (NEXTCLOUD_ADMIN_USER).
 *   2. Update organizations.nextcloud_folder_path to that path.
 *   3. Share the org folder read/write with every org owner that has
 *      Nextcloud credentials, read-only with every guide.
 *
 * It does NOT move existing files from owner accounts — orgs seeded under a
 * personal account (e.g. hidden-enneagram under Justin's) keep working via
 * their current silex_published_path; pass --adopt-published to repoint
 * silex_published_path at the service-account copy AFTER you've copied the
 * files (see notes printed at the end).
 *
 * Usage (from repo root, inside a container or env with DB + NC access):
 *   DATABASE_URL=postgres://... NEXTCLOUD_URL=... \
 *   NEXTCLOUD_ADMIN_USER=... NEXTCLOUD_ADMIN_PASSWORD=... \
 *   node scripts/backfill-org-nextcloud.mjs [orgId ...] [--dry-run]
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
const ORG_FILTER = argv.filter((a) => !a.startsWith("--"));

const NC_URL = process.env.NEXTCLOUD_URL;
const NC_USER = process.env.NEXTCLOUD_ADMIN_USER;
const NC_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD;
const DB_URL = process.env.DATABASE_URL;

if (!NC_URL || !NC_USER || !NC_PASS || !DB_URL) {
  console.error(
    "Required env: DATABASE_URL, NEXTCLOUD_URL, NEXTCLOUD_ADMIN_USER, NEXTCLOUD_ADMIN_PASSWORD"
  );
  process.exit(1);
}

const sql = postgres(DB_URL);
const auth = `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")}`;

const PERM_WRITE = 15; // read+update+create+delete
const PERM_READ = 1;

function davUrl(path) {
  const enc = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${enc}`;
}

async function mkcol(path) {
  const res = await fetch(davUrl(path), {
    method: "MKCOL",
    headers: { Authorization: auth },
  });
  if (res.status !== 201 && res.status !== 405) {
    throw new Error(`MKCOL ${path} -> ${res.status}`);
  }
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
  // Idempotent: check existing shares first.
  const q = new URLSearchParams({ path: `/${path}`, reshares: "true", format: "json" });
  const existing = await ocs("GET", `/apps/files_sharing/api/v1/shares?${q}`);
  const list = Array.isArray(existing.data) ? existing.data : [];
  const hit = list.find((s) => Number(s.share_type) === 0 && s.share_with === recipient);
  if (hit) {
    if (Number(hit.permissions) !== permissions) {
      const form = new URLSearchParams({ permissions: String(permissions) });
      await ocs("PUT", `/apps/files_sharing/api/v1/shares/${hit.id}?format=json`, form);
      return `updated (perm ${hit.permissions}→${permissions})`;
    }
    return "already shared";
  }
  const form = new URLSearchParams({
    path: `/${path}`,
    shareType: "0",
    shareWith: recipient,
    permissions: String(permissions),
  });
  const res = await ocs("POST", "/apps/files_sharing/api/v1/shares?format=json", form);
  if (res.status >= 400) return `FAILED (${res.status})`;
  return "shared";
}

const SUBFOLDERS = [
  "Media/Images",
  "Media/Audio",
  "Media/Videos",
  "Media/Documents",
  "Private/Media",
  "silex/project/assets",
  "silex/published/css",
];

const FORCE = argv.includes("--force");

const orgs = await sql`
  SELECT o.id, o.slug, o.nextcloud_folder_path, o.silex_published_path
  FROM organizations o
  ${ORG_FILTER.length > 0 ? sql`WHERE o.id = ANY(${ORG_FILTER})` : sql``}
  ORDER BY o.id
`;

for (const org of orgs) {
  const folder = `EAC_Network/${org.id}`;
  console.log(`\n== ${org.id} (${org.slug})`);

  // Guard: an org whose Silex content still lives under a personal account
  // (legacy seed) must not be flipped to the service-account folder until the
  // files have been copied — otherwise the editor opens an empty project.
  const legacyContent =
    (org.nextcloud_folder_path && !/^EAC[_-]Network\//.test(org.nextcloud_folder_path)) ||
    (org.silex_published_path &&
      !org.silex_published_path.includes(`nextcloud://${encodeURIComponent(NC_USER)}/`));
  if (legacyContent && !FORCE) {
    console.log(
      `  SKIPPED: content lives under a personal account ` +
        `(folder=${org.nextcloud_folder_path || "-"}). Copy files to the service ` +
        `account first, then re-run with --force ${org.id}.`
    );
    continue;
  }

  const members = await sql`
    SELECT uo.role, u.email, u.nextcloud_user_id
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${org.id} AND uo.role IN ('owner','guide')
  `;

  if (DRY_RUN) {
    console.log(`  [dry-run] would ensure ${folder} (+${SUBFOLDERS.length} subfolders)`);
    for (const m of members) {
      console.log(
        `  [dry-run] would share ${m.role === "owner" ? "RW" : "RO"} -> ${m.email} (${m.nextcloud_user_id ?? "NO NC ACCOUNT"})`
      );
    }
    continue;
  }

  await ensureTree(folder);
  for (const sub of SUBFOLDERS) await ensureTree(`${folder}/${sub}`);
  console.log(`  folder tree ok: ${folder}`);

  await sql`
    UPDATE organizations SET nextcloud_folder_path = ${folder} WHERE id = ${org.id}
  `;

  for (const m of members) {
    if (!m.nextcloud_user_id) {
      console.log(`  skip ${m.role} ${m.email}: no Nextcloud account yet`);
      continue;
    }
    const perm = m.role === "owner" ? PERM_WRITE : PERM_READ;
    const result = await shareWith(folder, m.nextcloud_user_id, perm);
    console.log(`  ${m.role} ${m.email}: ${result}`);
  }
}

console.log(`
Done. Notes:
 - Orgs whose silex_published_path still points at a personal account keep
   serving from there. To adopt the service-account copy: copy the files
   (WebDAV) into EAC_Network/{orgId}/silex/published/ under ${NC_USER}, then:
     UPDATE organizations
     SET silex_published_path =
       'nextcloud://${encodeURIComponent(NC_USER)}/EAC_Network/{orgId}/silex/published/index.html'
     WHERE id = '{orgId}';
`);

await sql.end();
