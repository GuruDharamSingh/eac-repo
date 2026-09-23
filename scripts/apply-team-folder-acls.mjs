#!/usr/bin/env node
/*
 * apply-team-folder-acls.mjs
 * ==========================
 * Generates (and optionally runs) the groupfolders ACL rules that make the
 * EAC_Network Team folder safe to put every user into.
 *
 * WHY THIS SHAPE — established empirically, not assumed:
 *   - A group DENY beats a CIRCLE allow. Tested: user in group EAC_Network
 *     (-read on a folder) plus that folder's circle (+read) still resolves to
 *     -read. So "deny broadly, re-grant per org circle" DOES NOT WORK, and
 *     Circles are useless as an ACL mechanism (they remain useful for Deck
 *     and Talk sharing).
 *   - A USER allow beats a group DENY. Tested: same user with a user-level
 *     +read resolves to +read.
 *   => Therefore: deny once to the EAC_Network group per top-level folder,
 *      then allow per USER on exactly the folders that person should see.
 *
 * THE ROBOT: eac_intergration is itself in the EAC_Network group, so a blanket
 * group deny would cut off the service account that serves ALL media on every
 * app. Its user-level allows are emitted FIRST and are not optional.
 *
 * Affiliation matches packages/services/src/media-authz.ts: a person belongs
 * to an org via user_organizations OR org_profiles (IFAC's artists exist only
 * in the latter).
 *
 * Usage:
 *   DATABASE_URL=... node scripts/apply-team-folder-acls.mjs [--apply]
 * Without --apply it only prints the commands (default: dry run).
 */

import { createRequire } from "module";
import { execFileSync } from "node:child_process";

const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
);
const postgres = requireFromDb("postgres");

const APPLY = process.argv.includes("--apply");
const DB_URL = process.env.DATABASE_URL;
const FOLDER_ID = process.env.GROUPFOLDER_ID || "2";
const GROUP = process.env.NEXTCLOUD_DEFAULT_GROUP || "EAC_Network";
const NC_CONTAINER = process.env.NC_CONTAINER || "nextcloud-aio-nextcloud";
// Accounts that must keep full access to everything: the media/read robot and
// the read-write service account. Without these the platform stops serving.
const SERVICE_ACCOUNTS = (process.env.NC_SERVICE_ACCOUNTS || "eac_intergration")
  .split(",").map((s) => s.trim()).filter(Boolean);

if (!DB_URL) {
  console.error("Required env: DATABASE_URL");
  process.exit(1);
}

// Folder name on disk -> org id. They match except where the folder was
// created before the org was renamed.
const FOLDER_TO_ORG = { artdirect: "oad" };

const sql = postgres(DB_URL);

function occ(args) {
  return execFileSync(
    "docker",
    ["exec", "-u", "www-data", NC_CONTAINER, "php", "occ", ...args],
    { encoding: "utf8" }
  );
}

function listUserFolders() {
  const out = execFileSync(
    "docker",
    ["exec", NC_CONTAINER, "sh", "-c", `ls -p /mnt/ncdata/__groupfolders/${FOLDER_ID}/files/users 2>/dev/null || true`],
    { encoding: "utf8" }
  );
  return out.split("\n").filter((l) => l.endsWith("/")).map((l) => l.slice(0, -1));
}

function listTopLevelFolders() {
  const out = execFileSync(
    "docker",
    ["exec", NC_CONTAINER, "sh", "-c", `ls -p /mnt/ncdata/__groupfolders/${FOLDER_ID}/files`],
    { encoding: "utf8" }
  );
  // Trailing slash marks a directory; loose files (openbook.jpg) are skipped.
  return out.split("\n").filter((l) => l.endsWith("/")).map((l) => l.slice(0, -1));
}

async function main() {
  const folders = listTopLevelFolders();
  const orgFolders = folders.filter((f) => f !== "users");
  const hasUsers = folders.includes("users");

  const people = await sql`
    SELECT id, slug, display_name, nextcloud_user_id
    FROM users
    WHERE nextcloud_user_id IS NOT NULL AND slug IS NOT NULL
  `;

  const affiliations = await sql`
    SELECT DISTINCT u.nextcloud_user_id AS nc, x.org_id, COALESCE(uo.role, 'member') AS role
    FROM users u
    JOIN (
      SELECT user_id, org_id FROM user_organizations
      UNION
      SELECT user_id, org_id FROM org_profiles
    ) x ON x.user_id = u.id
    LEFT JOIN user_organizations uo ON uo.user_id = u.id AND uo.org_id = x.org_id
    WHERE u.nextcloud_user_id IS NOT NULL
      -- Viewers are followers, not members: no read on the org folder.
      -- (Additive only — this stops new grants, it never revokes old ones.)
      AND COALESCE(uo.role, 'member') IN ('member', 'guide', 'owner')
  `;

  const cmds = [];
  const note = (s) => cmds.push({ comment: s });
  const add = (args) => cmds.push({ args });

  // 1. Service accounts keep everything. Emitted first, deliberately.
  note("service accounts — must precede the denies");
  const userFolders = hasUsers ? listUserFolders() : [];
  for (const svc of SERVICE_ACCOUNTS) {
    for (const f of folders) {
      add(["groupfolders:permissions", FOLDER_ID, f, "-u", svc, "--", "+read", "+write"]);
    }
    // Every users/<slug> is denied to the group below, and the service account
    // is IN that group — without a matching allow on each child it loses read
    // on every person's folder, which is where all the IFAC artist media lives.
    // A top-level allow on `users` does NOT inherit past a deeper deny.
    for (const uf of userFolders) {
      add(["groupfolders:permissions", FOLDER_ID, `users/${uf}`, "-u", svc, "--", "+read", "+write"]);
    }
  }

  // 3. Re-grant per user, per org they are affiliated with.
  note("per-user allows on their own orgs");
  const byFolder = new Map(orgFolders.map((f) => [FOLDER_TO_ORG[f] ?? f, f]));
  for (const a of affiliations) {
    const folder = byFolder.get(a.org_id);
    if (!folder) continue; // org has no folder on disk
    const perms = a.role === "owner" ? ["+read", "+write"] : ["+read"];
    add(["groupfolders:permissions", FOLDER_ID, folder, "-u", a.nc, "--", ...perms]);
  }

  // 4. Each person sees only their own folder under users/.
  if (hasUsers) {
    note("per-user allows on their own users/<slug> folder");
    for (const p of people) {
      add(["groupfolders:permissions", FOLDER_ID, `users/${p.slug}`, "-u", p.nextcloud_user_id, "--", "+read", "+write"]);
    }
  }

  // 5. Denies LAST. Every allow above is already in place by this point, so
  // there is never a moment where someone (or the service account) is denied
  // a folder they have not yet been re-granted.
  note(`deny group ${GROUP} on each org folder — applied last, on purpose`);
  for (const f of orgFolders) {
    add(["groupfolders:permissions", FOLDER_ID, f, "-g", GROUP, "--", "-read"]);
  }

  // `users` itself stays READABLE. Denying the parent hides the whole tree
  // from the file browser, so a person could not reach their own folder even
  // with an explicit allow on it — a child is unreachable inside a parent you
  // cannot list. Deny each person's folder individually instead; the result
  // is that opening users/ shows you exactly your own folder.
  if (hasUsers) {
    note("deny each users/<slug> individually (parent stays listable)");
    for (const uf of listUserFolders()) {
      add(["groupfolders:permissions", FOLDER_ID, `users/${uf}`, "-g", GROUP, "--", "-read"]);
    }
  }

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${cmds.filter((c) => c.args).length} rule(s)\n`);
  let failed = 0;
  for (const c of cmds) {
    if (c.comment) {
      console.log(`\n# ${c.comment}`);
      continue;
    }
    const line = "occ " + c.args.join(" ");
    if (!APPLY) {
      console.log("  " + line);
      continue;
    }
    try {
      occ(c.args);
      console.log("  ok   " + line);
    } catch (err) {
      failed++;
      console.log("  FAIL " + line + "  -> " + (err.stderr || err.message).toString().trim().split("\n")[0]);
    }
  }
  // 6. Put each affiliated person IN the group, so the team folder mounts for
  //    them at all. Folder 2 is assigned only to the ${GROUP} group; the rules
  //    above decide what inside it each person sees, but someone outside the
  //    group has no mount and sees nothing — which is what happened to every
  //    SSO signup (sociallogin's defaultGroup is empty, and nothing else ever
  //    added them; the ones who were in it had been added by hand).
  //    LAST, and only if every rule above applied: joining the group while a
  //    deny were missing would show them other orgs' folders.
  const wanted = [...new Set([...affiliations.map((a) => a.nc), ...people.map((p) => p.nextcloud_user_id)])];
  let inGroup = new Set();
  try {
    inGroup = new Set(JSON.parse(occ(["group:list", "--output=json"]))[GROUP] ?? []);
  } catch (err) {
    console.log(`\n# could not read ${GROUP} members — skipping group adds: ${(err.message || "").split("\n")[0]}`);
    wanted.length = 0;
  }
  const toAdd = wanted.filter((uid) => !inGroup.has(uid));
  console.log(`\n# add to group ${GROUP} — ${toAdd.length} missing of ${wanted.length} affiliated`);
  for (const uid of toAdd) {
    const args = ["group:adduser", GROUP, uid];
    if (!APPLY) {
      console.log("  occ " + args.join(" "));
      continue;
    }
    if (failed > 0) {
      console.log(`  SKIP occ ${args.join(" ")}  -> ${failed} rule(s) failed above; not widening access`);
      continue;
    }
    try {
      occ(args);
      console.log("  ok   occ " + args.join(" "));
    } catch (err) {
      failed++;
      console.log("  FAIL occ " + args.join(" ") + "  -> " + (err.stderr || err.message).toString().trim().split("\n")[0]);
    }
  }

  if (APPLY) console.log(`\nDone. ${failed} failure(s).`);
  else console.log("\n(dry run — pass --apply to execute)");

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
