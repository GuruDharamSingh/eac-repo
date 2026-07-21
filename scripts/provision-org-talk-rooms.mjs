#!/usr/bin/env node
/*
 * provision-org-talk-rooms.mjs
 * ============================
 * Create the persistent Nextcloud Talk room for each org that doesn't have
 * one yet (organizations.talk_room_token IS NULL), owned by the service
 * account. Members are invited later once they have Nextcloud accounts.
 *
 * Usage (env like backfill-org-nextcloud.mjs):
 *   DATABASE_URL=... NEXTCLOUD_URL=... \
 *   NEXTCLOUD_ADMIN_USER=... NEXTCLOUD_ADMIN_PASSWORD=... \
 *   node scripts/provision-org-talk-rooms.mjs [orgId ...] [--dry-run]
 */

import { createRequire } from "module";

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

async function createGroupRoom(name) {
  const body = new URLSearchParams();
  body.set("roomType", "2"); // group
  body.set("roomName", name);
  const res = await fetch(`${NC_URL}/ocs/v2.php/apps/spreed/api/v4/room`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "OCS-APIRequest": "true",
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`create room "${name}" -> ${res.status}`);
  const json = await res.json();
  const token = json?.ocs?.data?.token;
  if (!token) throw new Error(`create room "${name}": no token in response`);
  return token;
}

const orgs = await sql`
  SELECT id, name FROM organizations
  WHERE talk_room_token IS NULL
    ${ORG_FILTER.length ? sql`AND id IN ${sql(ORG_FILTER)}` : sql``}
  ORDER BY id
`;

for (const org of orgs) {
  if (DRY_RUN) {
    console.log(`[dry-run] would create Talk room "${org.name}" for ${org.id}`);
    continue;
  }
  try {
    const token = await createGroupRoom(org.name);
    await sql`
      UPDATE organizations SET talk_room_token = ${token} WHERE id = ${org.id}
    `;
    console.log(`${org.id}: Talk room created (${token})`);
  } catch (err) {
    console.error(`${org.id}: FAILED — ${err.message}`);
  }
}

await sql.end();
