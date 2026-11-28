import { randomUUID } from "node:crypto";
// check-suggest: suggestContent rights. Synthetic fixtures in a rolled-back transaction. Run: ../db/node_modules/.bin/tsx scripts/check-suggest.mts
import { db } from "@elkdonis/db";
import { defaultHost } from "../src/host";
import { suggestContent } from "../src/server/suggest";
import type { ContentRights } from "../src/server/access";

let bad = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) bad++; };
class Rollback extends Error {}
const host = defaultHost();
const TAG = "zqsuggest";
const OWNER = randomUUID(), HID = randomUUID();

try {
  await db.begin(async (tx) => {
    const run = tx as unknown as typeof db;
    const [owner] = await run<Array<{ id: string }>>`INSERT INTO users (id, auth_user_id, email, display_name, slug, directory_listed, entity_type) VALUES (${OWNER}::uuid, ${OWNER}::uuid, ${TAG + "-owner@example.invalid"}, ${TAG + " Listed"}, ${TAG + "-listed"}, true, 'person') RETURNING id::text`;
    await run`INSERT INTO users (id, auth_user_id, email, display_name, slug, directory_listed, entity_type) VALUES (${HID}::uuid, ${HID}::uuid, ${TAG + "-hid@example.invalid"}, ${TAG + " Unlisted"}, ${TAG + "-unlisted"}, false, 'person')`;
    await run`INSERT INTO organizations (id, name, slug, subdomain_confirmed, join_policy) VALUES (${TAG + "pub"}, ${TAG + " Public Org"}, ${TAG + "-pub"}, true, 'open'), (${TAG + "prv"}, ${TAG + " Private Org"}, ${TAG + "-prv"}, true, 'private')`;
    const row = (id: string, store: string, status: string, title: string, ownerId: string | null) => run`
      INSERT INTO content_index (store, id, type, org_id, owner_user_id, visibility, status, title, sort_at)
      VALUES (${store}, ${id}, ${store === "file" ? "file" : "writing"}, ${TAG + "pub"}, ${ownerId}::uuid, 'PUBLIC', ${status}, ${title}, now())`;
    await row(TAG + "1", "thread", "published", TAG + " public piece", null);
    await row(TAG + "2", "thread", "draft", TAG + " owner draft", owner.id);
    await row(TAG + "3", "file", "published", TAG + " a file", null);

    const stranger: ContentRights = { userId: "00000000-0000-0000-0000-000000000001", isAdmin: false, identityIds: ["00000000-0000-0000-0000-000000000001"], roles: {}, managedOrgIds: [] };
    const mine: ContentRights = { userId: owner.id, isAdmin: false, identityIds: [owner.id], roles: {}, managedOrgIds: [] };
    const anon = await suggestContent(null, TAG, host, { client: run, limit: 10, noDrain: true });
    const str = await suggestContent(null, TAG, host, { client: run, limit: 10, noDrain: true, rights: stranger });
    const own = await suggestContent(null, TAG, host, { client: run, limit: 10, noDrain: true, rights: mine });
    const titles = (r: typeof anon) => r.pieces.map((p) => p.title);
    ok(titles(anon).includes(TAG + " public piece") && !titles(anon).includes(TAG + " owner draft"), "signed-out: public piece only");
    ok(titles(str).includes(TAG + " public piece") && !titles(str).includes(TAG + " owner draft"), "stranger: public piece, not the draft");
    ok(titles(own).includes(TAG + " owner draft"), "owner sees own draft");
    ok(![anon, str, own].some((r) => titles(r).includes(TAG + " a file")), "files never appear");
    ok(anon.people.some((p) => p.name === TAG + " Listed") && !anon.people.some((p) => p.name === TAG + " Unlisted"), "listed people only");
    ok(anon.orgs.some((o) => o.id === TAG + "pub") && !anon.orgs.some((o) => o.id === TAG + "prv"), "public orgs only");
    ok(!/email|example\.invalid/i.test(JSON.stringify([anon, str, own])), "no email field or value");
    const none = await suggestContent(null, "", host, { client: run, limit: 3, noDrain: true });
    ok(none.pieces.length <= 3 && none.people.length === 0 && none.orgs.length === 0, "empty q: recent pieces only, limit honoured");
    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) { console.error(e); bad++; }
}
console.log(bad ? `${bad} FAILED` : "all ok");
await db.end({ timeout: 2 }).catch(() => undefined);
process.exit(bad ? 1 : 0);
