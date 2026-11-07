/**
 * Seed Katie's store with six sample pieces, through the real server
 * functions (applyForStore → approveStore once; createArtwork + publishArtwork
 * per piece), with pictures uploaded to her Nextcloud folder the way the
 * upload routes do. Idempotent: an existing store is reused, a piece whose
 * title already exists in the store is left alone, an existing picture is
 * overwritten with the same bytes.
 *
 *   cd ~/eac && sudo -n docker compose run --rm --no-deps -T -e SENDGRID_API_KEY= \
 *     -w /app/apps/katie-the-potter art-auction \
 *     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/seed-katie.ts
 *
 * Env: SEED_EMAIL (default the placeholder), SEED_APPROVER_EMAIL (default
 * justin.gillisb@gmail.com), SEED_IMAGES (default ./.seed-images: hero.png,
 * piece-1.png … piece-6.png). Every piece carries metadata.sample = true so
 * they can be archived in one statement later (see seed-katie.md). No Stripe
 * objects are touched.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@elkdonis/db";
import { createUserFolder, getProxyFileUrl, getStorageSlug, resolveUserPath, uploadFile } from "@elkdonis/services";
import { applyForStore, approveStore, createArtwork, publishArtwork } from "@elkdonis/commerce/server";
import { getStoreForUser, listStoreArtworks } from "@elkdonis/commerce/queries";

type Row = Record<string, unknown>;
const env = (k: string, fallback: string) => process.env[k]?.trim() || fallback;

const PIECES = [
  { title: "Tenmoku tea bowl", medium: "Wheel-thrown stoneware, tenmoku glaze", year: 2026, h: 8, w: 12, d: 12, kind: "original", price: 9500, images: ["piece-1.png", "piece-4.png"], status: "available",
    html: "<p>Thrown on the wheel and fired to cone 10 in reduction. The glaze breaks to rust at the rim where it runs thin, and pools to a deep oil-spot black in the well.</p><p>Holds about 250 ml. Food safe; hand wash.</p>" },
  { title: "Celadon vase", medium: "Wheel-thrown porcelain, celadon glaze", year: 2025, h: 24, w: 11, d: 11, kind: "original", price: 28000, images: ["piece-2.png", "piece-6.png"], status: "available",
    html: "<p>A tall bottle form with a crackled celadon, thrown in two parts and joined at the shoulder.</p>" },
  { title: "Shino jar with lid", medium: "Wheel-thrown stoneware, shino glaze", year: 2025, h: 16, w: 14, d: 14, kind: "original", price: 0, images: ["piece-3.png", "piece-1.png"], status: "available",
    html: "<p>Carbon-trapped shino over an iron slip. The lid seats on an inner gallery.</p>" },
  { title: "Pair of cups", medium: "Wheel-thrown stoneware, wood-ash glaze", year: 2026, h: 9, w: 8, d: 8, kind: "open_edition", price: 6500, images: ["piece-4.png", "piece-1.png"], status: "available",
    html: "<p>Sold as a pair. Wood-ash glaze from the studio's own stove.</p>" },
  { title: "Wide serving bowl", medium: "Wheel-thrown stoneware, iron slip", year: 2024, h: 9, w: 30, d: 30, kind: "original", price: 12000, images: ["piece-5.png", "piece-3.png"], status: "sold",
    html: "<p>A low, wide bowl for the middle of the table.</p>" },
  { title: "Bud vase, black", medium: "Wheel-thrown stoneware, black glaze", year: 2026, h: 14, w: 7, d: 7, kind: "limited_edition", price: 8500, images: ["piece-6.png", "piece-2.png"], status: "reserved",
    html: "<p>One of a small run of twelve, each numbered on the foot.</p>" },
] as const;

async function userByEmail(email: string) {
  const [u] = (await db`SELECT id, display_name, slug, payout_email FROM users WHERE lower(email) = lower(${email}) LIMIT 1`) as unknown as Row[];
  if (!u) throw new Error(`No user for ${email}`);
  return u;
}

async function main() {
  const email = env("SEED_EMAIL", "katie@katiethepotter.example");
  const approverEmail = env("SEED_APPROVER_EMAIL", "justin.gillisb@gmail.com");
  const imagesDir = env("SEED_IMAGES", path.resolve(".seed-images"));

  const person = await userByEmail(email);
  const approver = await userByEmail(approverEmail);
  const userId = person.id as string;
  console.log(`person  ${person.display_name} (${userId})`);

  // ── pictures → her Nextcloud folder, the upload route's paths ───────────
  const slug = await getStorageSlug(userId);
  if (!slug) throw new Error("The owner has no storage folder yet (run gainSpace first)");
  if (!(await createUserFolder(slug, "Media/Images"))) throw new Error("Could not create Media/Images");
  const urls = new Map<string, string>();
  for (const file of ["hero.png", ...new Set(PIECES.flatMap((p) => [...p.images]))]) {
    const rel = resolveUserPath(slug, `Media/Images/katie-sample-${file}`);
    const buf = await readFile(path.join(imagesDir, file));
    if (!(await uploadFile(rel, buf, "image/png"))) throw new Error(`upload failed: ${file}`);
    urls.set(file, getProxyFileUrl(rel));
    console.log(`picture ${file} → ${urls.get(file)}`);
  }

  // ── store ─────────────────────────────────────────────────────────────────
  let store = await getStoreForUser(userId, "market");
  if (!store) {
    const res = await applyForStore({ userId, orgId: "market", displayName: "Katie the Potter", payoutEmail: email });
    if (!res.ok || !res.store) throw new Error(`applyForStore: ${res.error}`);
    store = res.store;
    console.log(`store   created ${store.id} (${store.status})`);
  } else {
    console.log(`store   exists ${store.id} (${store.status})`);
  }
  if (store.status !== "active") {
    await approveStore(store.id, approver.id as string);
    console.log(`store   approved by ${approver.display_name}`);
  }
  if (!person.payout_email) {
    await db`UPDATE users SET payout_email = ${email} WHERE id = ${userId} AND payout_email IS NULL`;
  }
  await db`UPDATE users SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || '{"store": true}'::jsonb WHERE id = ${userId}`;

  // ── pieces ────────────────────────────────────────────────────────────────
  const have = await listStoreArtworks(store.id);
  for (const p of PIECES) {
    const existing = have.find((a) => a.title === p.title);
    let id: string;
    if (existing) {
      id = existing.id;
      console.log(`artwork exists  ${id} (${existing.status}) — ${p.title}`);
    } else {
      ({ id } = await createArtwork({
        storeId: store.id,
        artistUserId: userId,
        title: p.title,
        descriptionHtml: p.html,
        kind: p.kind,
        medium: p.medium,
        yearCreated: p.year,
        heightCm: p.h,
        widthCm: p.w,
        depthCm: p.d,
        priceMinor: p.price,
        currency: "CAD",
        inventoryQty: 1,
        images: p.images.map((f, i) => ({ url: urls.get(f)!, alt: p.title, role: i === 0 ? ("hero" as const) : ("detail" as const) })),
      }));
      console.log(`artwork created ${id} — ${p.title}`);
    }
    const [st] = (await db`SELECT status FROM artwork WHERE id = ${id}`) as unknown as Row[];
    if (st?.status === "draft" || st?.status === "archived") {
      await publishArtwork(id, userId);
      console.log(`        published${p.price > 0 ? "" : " (price on request)"}`);
    }
    // The sale states the order flow would set (packages/commerce/src/server/orders.ts), for the status pills.
    if (p.status !== "available") {
      await db`UPDATE artwork SET status = ${p.status} WHERE id = ${id} AND status IN ('available', 'reserved', 'sold')`;
      console.log(`        marked ${p.status}`);
    }
    await db`UPDATE artwork SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"sample": true}'::jsonb WHERE id = ${id}`;
  }

  const [count] = (await db`SELECT count(*)::int AS n FROM artwork WHERE store_id = ${store.id} AND metadata->>'sample' = 'true'`) as unknown as Row[];
  console.log(`done: store ${store.id}, ${count?.n} sample piece(s); hero ${urls.get("hero.png")}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
