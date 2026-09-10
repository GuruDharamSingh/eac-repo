/**
 * Seed a person's store with one listed piece, through the real server
 * functions (so every guard — collective membership, approval, publish
 * requirements — is exercised rather than bypassed).
 *
 * Idempotent per (person, marketplace): an existing store is reused and
 * approved if pending; the listing is created only if no artwork with the
 * same title exists in that store.
 *
 *   docker compose exec -T -e SENDGRID_API_KEY= art-auction sh -c \
 *     "cd /app/packages/commerce && \
 *      SEED_EMAIL=someone@example.com \
 *      SEED_APPROVER_EMAIL=admin@example.com \
 *      SEED_TITLE='Morning Light' SEED_PRICE=108 \
 *      SEED_IMAGE_URL=/api/media/EAC_Network/<org>/Media/Images/<file>.jpg \
 *      SEED_PAYOUT_EMAIL=someone@example.com SEED_SHOW_ON_PROFILE=1 \
 *      node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/seed-listing.ts"
 *
 * Optional: SEED_KIND (original|limited_edition|open_edition), SEED_MEDIUM,
 * SEED_DESCRIPTION_HTML, SEED_MARKET (default `market`).
 *
 * SEED_FROM_PORTFOLIO=1 lists every item of the person's network portfolio
 * (users.portfolio — what ArtDirect / IFAC show on their profile) as a
 * separate piece instead of one titled piece; SEED_TITLE/SEED_IMAGE_URL are
 * then ignored. SEED_PRICE may be 0 or blank: the pieces publish as "price on
 * request" and cannot be added to a cart until priced.
 */

import { db } from "@elkdonis/db";
import { applyForStore, approveStore, createArtwork, publishArtwork } from "../src/server";
import { getStoreForUser, listStoreArtworks } from "../src/queries";

type Row = Record<string, unknown>;
const env = (k: string, fallback?: string): string => {
  const v = process.env[k]?.trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing ${k}`);
};

/** By email, or — for a person with no email on file — by exact display name (`name:`-prefixed). */
async function userByEmail(ref: string) {
  const byName = ref.startsWith("name:");
  const [u] = (byName
    ? await db`SELECT id, display_name, slug, payout_email FROM users WHERE display_name = ${ref.slice(5)} AND COALESCE(entity_type,'person') = 'person' LIMIT 1`
    : await db`SELECT id, display_name, slug, payout_email FROM users WHERE LOWER(email) = ${ref.toLowerCase()} LIMIT 1`) as unknown as Row[];
  if (!u) throw new Error(`No user for ${ref}`);
  return u;
}

async function main() {
  const email = env("SEED_EMAIL");
  const approverEmail = env("SEED_APPROVER_EMAIL");
  const fromPortfolio = env("SEED_FROM_PORTFOLIO", "0") === "1";
  const title = fromPortfolio ? "" : env("SEED_TITLE");
  const priceMajor = Number(env("SEED_PRICE", "0")) || 0;
  const imageUrl = fromPortfolio ? "" : env("SEED_IMAGE_URL");
  const market = env("SEED_MARKET", "market");
  const payoutEmail = env("SEED_PAYOUT_EMAIL", "");
  const showOnProfile = env("SEED_SHOW_ON_PROFILE", "0") === "1";

  const person = await userByEmail(email);
  const [pf] = (await db`SELECT portfolio FROM users WHERE id = ${person.id as string}`) as unknown as Row[];
  const approver = await userByEmail(approverEmail);
  const userId = person.id as string;
  console.log(`person  ${person.display_name} (${userId}) slug=${person.slug}`);

  // ── store ─────────────────────────────────────────────────────────────────
  let store = await getStoreForUser(userId, market);
  if (!store) {
    const res = await applyForStore({
      userId,
      orgId: market,
      displayName: (person.display_name as string) ?? email,
      payoutEmail: payoutEmail || (person.payout_email as string) || "",
    });
    if (!res.ok || !res.store) throw new Error(`applyForStore: ${res.error}`);
    store = res.store;
    console.log(`store   created ${store.id} (${store.status})`);
  } else {
    console.log(`store   exists ${store.id} (${store.status})`);
    if (payoutEmail && !person.payout_email) {
      await db`UPDATE users SET payout_email = ${payoutEmail} WHERE id = ${userId} AND payout_email IS NULL`;
    }
  }
  if (store.status !== "active") {
    await approveStore(store.id, approver.id as string);
    console.log(`store   approved by ${approver.display_name}`);
  }

  // ── listings ──────────────────────────────────────────────────────────────
  type Item = { title: string; imageUrl: string };
  const items: Item[] = fromPortfolio
    ? ((pf?.portfolio as Array<{ url?: string; title?: string }> | null) ?? [])
        .filter((it) => typeof it.url === "string" && it.url)
        .map((it, i) => ({ title: (it.title ?? "").trim() || `Untitled ${i + 1}`, imageUrl: it.url! }))
    : [{ title, imageUrl }];
  if (items.length === 0) throw new Error("Nothing to list (empty portfolio).");

  const have = await listStoreArtworks(store.id);
  const ids: string[] = [];
  for (const it of items) {
    const existing = have.find((a) => a.title === it.title);
    let artworkId: string;
    if (existing) {
      artworkId = existing.id;
      console.log(`artwork exists  ${artworkId} (${existing.status}) — ${it.title}`);
    } else {
      const { id } = await createArtwork({
        storeId: store.id,
        artistUserId: userId,
        title: it.title,
        descriptionHtml: process.env.SEED_DESCRIPTION_HTML ?? null,
        kind: (process.env.SEED_KIND as "original" | "limited_edition" | "open_edition") ?? "original",
        medium: process.env.SEED_MEDIUM ?? null,
        priceMinor: Math.round(priceMajor * 100),
        currency: "CAD",
        inventoryQty: 1,
        images: [{ url: it.imageUrl, alt: it.title, role: "hero" }],
      });
      artworkId = id;
      console.log(`artwork created ${artworkId} — ${it.title}`);
    }
    const [st] = (await db`SELECT status FROM artwork WHERE id = ${artworkId}`) as unknown as Row[];
    if (st?.status === "draft" || st?.status === "archived") {
      await publishArtwork(artworkId, userId);
      console.log(`        published${priceMajor > 0 ? "" : " (price on request)"}`);
    }
    ids.push(artworkId);
  }
  const artworkId = ids[0]!;

  // ── profile section ───────────────────────────────────────────────────────
  if (showOnProfile) {
    await db`
      UPDATE users SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || '{"store": true}'::jsonb
      WHERE id = ${userId}
    `;
    console.log(`profile section "store" switched on`);
  }

  console.log(`done: /artists/${store.slug} · ${ids.length} piece(s), first /artworks/${artworkId}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
