/**
 * Open an organisation's store (its FRONT) in the marketplace and present the
 * listed work of named members in it — through the real server functions, so
 * the org-owner gate, the store roll and the presentation rules all apply.
 *
 *   docker compose exec -T -e SENDGRID_API_KEY= art-auction sh -c \
 *     "cd /app/packages/commerce && \
 *      SEED_ORG=ifac SEED_ACTOR_EMAIL=owner@example.com \
 *      SEED_PRESENT_EMAILS=a@example.com,b@example.com \
 *      node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/seed-org-front.ts"
 *
 * The actor must hold the `owner` role in SEED_ORG (that is what lets an org
 * sell at all — decided 2026-09-05) and becomes the store's owner on the
 * roll. SEED_ACTOR_EMAIL may instead be SEED_ACTOR_NAME for a person with no
 * email on file. Optional SEED_MARKET (default `market`).
 */

import { db } from "@elkdonis/db";
import { openOrgStore, presentArtwork } from "../src/server";
import { getStoreForOrg, getStoreForUser, listStoreArtworks, listPresentedArtworks } from "../src/queries";

type Row = Record<string, unknown>;
const env = (k: string, fallback?: string): string => {
  const v = process.env[k]?.trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing ${k}`);
};

async function findUser(by: { email?: string; name?: string }) {
  const rows = (by.email
    ? await db`SELECT id, display_name, slug FROM users WHERE LOWER(email) = ${by.email.toLowerCase()} LIMIT 1`
    : await db`SELECT id, display_name, slug FROM users WHERE display_name = ${by.name!} AND COALESCE(entity_type,'person') = 'person' LIMIT 1`) as unknown as Row[];
  if (!rows[0]) throw new Error(`No user for ${JSON.stringify(by)}`);
  return rows[0];
}

async function main() {
  const orgId = env("SEED_ORG");
  const market = env("SEED_MARKET", "market");
  const actor = process.env.SEED_ACTOR_EMAIL
    ? await findUser({ email: process.env.SEED_ACTOR_EMAIL })
    : await findUser({ name: env("SEED_ACTOR_NAME") });
  const actorId = actor.id as string;
  console.log(`org     ${orgId}  actor ${actor.display_name} (${actorId})`);

  let store = await getStoreForOrg(orgId, market);
  if (!store) {
    const res = await openOrgStore({ ownerOrgId: orgId, actorUserId: actorId, orgId: market });
    if (!res.ok || !res.store) throw new Error(`openOrgStore: ${res.error}`);
    store = res.store;
    console.log(`store   opened ${store.id} (${store.status}) owner on roll: ${actor.display_name}`);
  } else {
    console.log(`store   exists ${store.id} (${store.status})`);
  }

  const presentSpec = (process.env.SEED_PRESENT_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const presentNames = (process.env.SEED_PRESENT_NAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const people = [
    ...(await Promise.all(presentSpec.map((email) => findUser({ email })))),
    ...(await Promise.all(presentNames.map((name) => findUser({ name })))),
  ];

  let added = 0;
  for (const person of people) {
    const theirs = await getStoreForUser(person.id as string, market);
    if (!theirs || theirs.status !== "active") {
      console.log(`skip    ${person.display_name}: no active store in ${market}`);
      continue;
    }
    const pieces = (await listStoreArtworks(theirs.id)).filter(
      (a) => a.status === "available" || a.status === "reserved"
    );
    for (const a of pieces) {
      await presentArtwork({ storeId: store.id, artworkId: a.id, actorUserId: actorId });
      added++;
    }
    console.log(`present ${person.display_name}: ${pieces.length} piece(s)`);
  }
  const now = await listPresentedArtworks(store.id);
  console.log(`done: /artists/${store.slug} presents ${now.length} piece(s) (${added} touched)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
