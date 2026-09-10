#!/usr/bin/env node
/*
 * provision-org-deck-boards.mjs
 * ============================
 * Give each org its own Nextcloud Deck board (organizations.deck_board_id,
 * migration 101), owned by the service account and seeded with Deck's usual
 * To do / Doing / Done stacks.
 *
 * Boards are deliberately NOT shared with EAC_Network or any other group:
 * a group share would put every org's board in every member's Nextcloud
 * sidebar. Members are granted access one uid at a time, and only members who
 * have actually connected a Nextcloud account (users.nextcloud_user_id) —
 * which today is none of them, so most boards come out with an empty ACL and
 * are reachable only through the app.
 *
 * Re-running is safe: an org that already has a board is skipped, and its ACL
 * is re-synced against current membership.
 *
 * Usage:
 *   DATABASE_URL=... NEXTCLOUD_URL=... \
 *   NEXTCLOUD_ADMIN_USER=... NEXTCLOUD_ADMIN_PASSWORD=... \
 *   node scripts/provision-org-deck-boards.mjs [orgId ...] [--dry-run]
 */

import { createRequire } from "module";

const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
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
const DECK = `${NC_URL.replace(/\/$/, "")}/apps/deck/api/v1.0`;

async function deck(method, path, body) {
  const res = await fetch(`${DECK}${path}`, {
    method,
    headers: {
      Authorization: auth,
      "OCS-APIRequest": "true",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const orgs = await sql`
  SELECT id, name, deck_board_id
  FROM organizations
  ${ORG_FILTER.length ? sql`WHERE id = ANY(${ORG_FILTER})` : sql``}
  ORDER BY id
`;

for (const org of orgs) {
  if (org.deck_board_id !== null) {
    console.log(`= ${org.id}: board ${org.deck_board_id} already`);
  } else if (DRY_RUN) {
    console.log(`+ ${org.id}: would create board "${org.name}"`);
    continue;
  } else {
    const board = await deck("POST", "/boards", { title: org.name, color: "0082c9" });
    for (const [order, title] of ["To do", "Doing", "Done"].entries()) {
      await deck("POST", `/boards/${board.id}/stacks`, { title, order });
    }
    await sql`
      UPDATE organizations
      SET deck_board_id = ${board.id}, deck_board_synced_at = NOW()
      WHERE id = ${org.id}
    `;
    org.deck_board_id = board.id;
    console.log(`+ ${org.id}: created board ${board.id} "${org.name}"`);
  }

  // Sync the board ACL against current membership, in both directions.
  const members = await sql`
    SELECT DISTINCT u.nextcloud_user_id AS uid
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${org.id} AND u.nextcloud_user_id IS NOT NULL
  `;
  const wanted = new Set(members.map((m) => m.uid));
  const board = await deck("GET", `/boards/${org.deck_board_id}`);
  const current = board.acl ?? [];

  for (const uid of wanted) {
    if (current.some((a) => a.type === 0 && a.participant.uid === uid)) continue;
    if (DRY_RUN) {
      console.log(`    would share with ${uid}`);
      continue;
    }
    await deck("POST", `/boards/${org.deck_board_id}/acl`, {
      type: 0,
      participant: uid,
      permissionEdit: true,
      permissionShare: false,
      permissionManage: false,
    });
    console.log(`    shared with ${uid}`);
  }

  for (const acl of current) {
    if (acl.owner) continue;
    if (acl.type === 0 && wanted.has(acl.participant.uid)) continue;
    if (DRY_RUN) {
      console.log(`    would revoke ${acl.participant.uid} (type ${acl.type})`);
      continue;
    }
    await deck("DELETE", `/boards/${org.deck_board_id}/acl/${acl.id}`);
    console.log(`    revoked ${acl.participant.uid} (type ${acl.type})`);
  }
}

await sql.end();
