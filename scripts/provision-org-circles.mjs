#!/usr/bin/env node
/*
 * provision-org-circles.mjs
 * =========================
 * Gives an org a working shared folder on Nextcloud, for the members who
 * actually have Nextcloud accounts.
 *
 * Per org:
 *   1. Ensure EAC_Network/<orgId>/ and its standard Media/Private subtree.
 *   2. Ensure a Circle (Team) named after the org, recorded on
 *      organizations.nextcloud_circle_id.
 *   3. Sync Circle membership to the org's members who have a
 *      nextcloud_user_id (others simply aren't representable in Nextcloud).
 *   4. Share the org folder with each of those members, per role.
 *
 * Everything here runs as the ordinary service account over OCS — no admin,
 * no `occ`, no password-confirmation gate. That is the whole reason it uses
 * Circles + shares rather than groups + Team-folder ACLs: creating a group,
 * attaching anything to a Team folder, or writing an ACL all hit
 * #[PasswordConfirmationRequired] (non-strict), which needs a live browser
 * session and can never be satisfied by an API credential. Attaching the
 * Circle to the Team folder is the one remaining step that needs `occ`, and
 * it is one-time per org — this script prints the exact commands at the end.
 *
 * Access model (matches grantOrgAccess in packages/nextcloud):
 *   owner  -> read+write   (15)
 *   guide  -> read         (1)
 *   member -> read         (1)
 *
 * Usage (from repo root, with DB + NC access):
 *   DATABASE_URL=... NEXTCLOUD_URL=... NEXTCLOUD_ADMIN_USER=... \
 *   NEXTCLOUD_ADMIN_PASSWORD=... \
 *   node scripts/provision-org-circles.mjs [orgId ...] [--dry-run] [--no-share]
 */

import { createRequire } from "module";

const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
);
const postgres = requireFromDb("postgres");

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const NO_SHARE = argv.includes("--no-share");
const ORG_FILTER = argv.filter((a) => !a.startsWith("--"));

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
const PERM_READ = 1;
const permsForRole = (role) => (role === "owner" ? PERM_WRITE : PERM_READ);

// Org id -> folder name on disk, where the folder predates an org rename.
// Without this, provisioning `oad` creates a second, empty EAC_Network/oad
// alongside the real EAC_Network/artdirect that apps/artdirect hardcodes.
const ORG_TO_FOLDER = { oad: "artdirect" };
const folderNameFor = (orgId) => ORG_TO_FOLDER[orgId] ?? orgId;

// Mirrors STANDARD_ORG_SUBFOLDERS in packages/nextcloud/src/org-folders.ts.
const SUBFOLDERS = [
  "Media", "Media/Images", "Media/Audio", "Media/Videos", "Media/Documents",
  "Private", "Private/Media", "Private/Media/Images", "Private/Media/Audio",
  "Private/Media/Videos", "Private/Media/Documents",
];

function davUrl(path) {
  const enc = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${enc}`;
}

async function mkcol(path) {
  const res = await fetch(davUrl(path), { method: "MKCOL", headers: { Authorization: auth } });
  if (res.status !== 201 && res.status !== 405) throw new Error(`MKCOL ${path} -> ${res.status}`);
  return res.status === 201 ? "created" : "exists";
}

async function ensureTree(path) {
  const parts = path.split("/").filter(Boolean);
  let current = "";
  let made = false;
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if ((await mkcol(current)) === "created") made = true;
  }
  return made;
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
  return {
    http: res.status,
    code: json?.ocs?.meta?.statuscode,
    message: json?.ocs?.meta?.message,
    data: json?.ocs?.data,
  };
}

// ── circles ────────────────────────────────────────────────────────────────

async function findCircleByName(name) {
  const r = await ocs("GET", "/apps/circles/circles?format=json");
  const list = Array.isArray(r.data) ? r.data : [];
  return list.find((c) => c.displayName === name) ?? null;
}

async function ensureCircle(name) {
  const existing = await findCircleByName(name);
  if (existing) return { id: existing.id, created: false };
  // `name` alone: passing local/personal flags returns
  // "circle configuration not supported" on this instance.
  const form = new URLSearchParams({ name });
  const r = await ocs("POST", "/apps/circles/circles?format=json", form);
  if (r.code !== 200 || !r.data?.id) {
    throw new Error(`create circle "${name}" -> ${r.code} ${r.message}`);
  }
  return { id: r.data.id, created: true };
}

async function listCircleMembers(circleId) {
  const r = await ocs("GET", `/apps/circles/circles/${circleId}/members?format=json`);
  const list = Array.isArray(r.data) ? r.data : [];
  return new Set(list.map((m) => m.userId).filter(Boolean));
}

async function addCircleMember(circleId, userId) {
  const form = new URLSearchParams({ userId, type: "1" }); // type 1 = local user
  const r = await ocs("POST", `/apps/circles/circles/${circleId}/members?format=json`, form);
  if (r.code !== 200) return `FAILED (${r.code} ${r.message})`;
  return "added";
}

// ── shares ─────────────────────────────────────────────────────────────────

async function shareWith(path, recipient, permissions) {
  const q = new URLSearchParams({ path: `/${path}`, reshares: "true", format: "json" });
  const existing = await ocs("GET", `/apps/files_sharing/api/v1/shares?${q}`);
  const list = Array.isArray(existing.data) ? existing.data : [];
  const hit = list.find((s) => Number(s.share_type) === 0 && s.share_with === recipient);
  if (hit) {
    if (Number(hit.permissions) !== permissions) {
      const form = new URLSearchParams({ permissions: String(permissions) });
      await ocs("PUT", `/apps/files_sharing/api/v1/shares/${hit.id}?format=json`, form);
      return `perms ${hit.permissions}->${permissions}`;
    }
    return "already shared";
  }
  const form = new URLSearchParams({
    path: `/${path}`,
    shareType: "0",
    shareWith: recipient,
    permissions: String(permissions),
  });
  const r = await ocs("POST", "/apps/files_sharing/api/v1/shares?format=json", form);
  if (r.http >= 400 || (r.code && r.code !== 200)) return `FAILED (${r.code ?? r.http})`;
  return "shared";
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const orgs = await sql`
    SELECT id, name, nextcloud_circle_id
    FROM organizations
    ${ORG_FILTER.length ? sql`WHERE id = ANY(${ORG_FILTER})` : sql``}
    ORDER BY id
  `;
  if (orgs.length === 0) {
    console.log("No matching orgs.");
    await sql.end();
    return;
  }

  const occSteps = [];

  for (const org of orgs) {
    console.log(`\n=== ${org.id} (${org.name}) ===`);
    const folder = `${ROOT}/${folderNameFor(org.id)}`;

    const members = await sql`
      SELECT u.id, u.display_name, u.nextcloud_user_id, uo.role
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${org.id} AND u.nextcloud_user_id IS NOT NULL
      ORDER BY uo.role, u.display_name
    `;

    if (DRY_RUN) {
      console.log(`  would ensure ${folder} + ${SUBFOLDERS.length} subfolders`);
      console.log(`  would ensure circle "${org.name}"${org.nextcloud_circle_id ? ` (have ${org.nextcloud_circle_id})` : ""}`);
      for (const m of members) {
        console.log(`    ${m.nextcloud_user_id.padEnd(46)} ${m.role.padEnd(7)} perms=${permsForRole(m.role)}`);
      }
      if (members.length === 0) console.log("    (no members with Nextcloud accounts)");
      continue;
    }

    // 1. folder tree
    const madeRoot = await ensureTree(folder);
    let madeSub = false;
    for (const sub of SUBFOLDERS) {
      if ((await mkcol(`${folder}/${sub}`)) === "created") madeSub = true;
    }
    console.log(`  folder ${folder}: ${madeRoot || madeSub ? "created/completed" : "already complete"}`);

    // 2. circle
    let circleId = org.nextcloud_circle_id;
    let circleNote = "reused (db)";
    if (!circleId) {
      const c = await ensureCircle(org.name);
      circleId = c.id;
      circleNote = c.created ? "created" : "found by name";
      await sql`UPDATE organizations SET nextcloud_circle_id = ${circleId} WHERE id = ${org.id}`;
    }
    console.log(`  circle "${org.name}": ${circleNote} (${circleId})`);

    // 3. circle membership
    const current = await listCircleMembers(circleId);
    for (const m of members) {
      if (current.has(m.nextcloud_user_id)) {
        console.log(`    circle: ${m.nextcloud_user_id} already a member`);
      } else {
        console.log(`    circle: ${m.nextcloud_user_id} ${await addCircleMember(circleId, m.nextcloud_user_id)}`);
      }
    }

    // 4. shares
    if (!NO_SHARE) {
      for (const m of members) {
        const p = permsForRole(m.role);
        console.log(`    share:  ${m.nextcloud_user_id} (${m.role}, ${p}) ${await shareWith(folder, m.nextcloud_user_id, p)}`);
      }
    }
    if (members.length === 0) console.log("    (no members with Nextcloud accounts yet)");

    occSteps.push(
      `# ${org.id}`,
      `occ groupfolders:group 2 ${circleId} read write`,
      `occ groupfolders:permissions 2 ${org.id} -g "EAC_Network" -- -read`,
      `occ groupfolders:permissions 2 ${org.id} -c "${org.name}" -- +read +write`
    );
  }

  if (!DRY_RUN && occSteps.length) {
    console.log(
      "\n--- one-time, needs occ on the host (blocked over HTTP by " +
        "PasswordConfirmationRequired) ---\n" +
        "Run only AFTER deciding to put real people in the EAC_Network group;\n" +
        "the deny rule must exist before anyone is added, or they see every org.\n"
    );
    for (const l of occSteps) console.log("  " + l);
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
