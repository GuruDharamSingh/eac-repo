// Onboarding dress-rehearsal helper (2026-11-06). No Stripe, no email. Extends
// scripts/claim-test.ts for a FULL revert, including what gainSpace adds.
//
//   MODE=snapshot  OUT=<file>          state of everything a claim/rehearsal touches, written as JSON
//   MODE=fks       CLAIMANT=<email>    every row referencing the throwaway's users.id, by table
//   MODE=piece     TITLE=<title>       the rehearsal artwork(s) and every row referencing them
//   MODE=cleanup-piece TITLE=<title>   delete those artwork rows + their media rows + files
//   MODE=revert    CLAIMANT=<email>    put the shop back on the placeholder and delete the
//                                      throwaway (all its rows, its Nextcloud folder, its GoTrue user)
//
//   docker compose run --rm --no-deps -T -e MODE=... -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/onboarding-rehearsal.ts
import { writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";
import { davDelete, davList } from "../../../packages/services/src/dav";

const ORG = "katie-the-potter";
const PLACEHOLDER = "katie@katiethepotter.example";
const GDS = "gurudharamsingh@gmail.com";
const STORE = "632bb16f-fe37-45e9-9611-2de298bed2ad";
const THROWAWAY = /^rehearsal\+[a-z0-9]+@example\.com$/i;

type Row = Record<string, unknown>;

async function snapshot() {
  const ids = await db<Row[]>`SELECT id, email FROM users WHERE lower(email) IN (${PLACEHOLDER}, ${GDS})`;
  const p = ids.find((r) => String(r.email).toLowerCase() === PLACEHOLDER)?.id as string;
  const g = ids.find((r) => String(r.email).toLowerCase() === GDS)?.id as string;
  const s = {
    orgRoles: await db`SELECT uo.user_id, u.email, uo.role, uo.joined_at FROM user_organizations uo LEFT JOIN users u ON u.id = uo.user_id WHERE uo.org_id = ${ORG} ORDER BY u.email`,
    placeholderOrgs: await db`SELECT org_id, role, joined_at FROM user_organizations WHERE user_id = ${p} ORDER BY org_id`,
    gdsOrgs: await db`SELECT org_id, role, joined_at FROM user_organizations WHERE user_id = ${g} ORDER BY org_id`,
    store: await db`SELECT (to_jsonb(s) - 'updated_at') AS row, s.owner_user_id FROM store s WHERE id = ${STORE}`,
    team: await db`SELECT user_id, role, added_by FROM store_member WHERE store_id = ${STORE} ORDER BY user_id`,
    artworks: await db`SELECT (to_jsonb(a) - 'updated_at' - 'view_count') AS row FROM artwork a WHERE store_id = ${STORE} ORDER BY id`,
    artworkMedia: await db`SELECT m.id, m.artwork_id, m.url, m.position FROM artwork_media m JOIN artwork a ON a.id = m.artwork_id WHERE a.store_id = ${STORE} ORDER BY m.id`,
    variants: await db`SELECT v.id, v.artwork_id, v.price_minor, v.currency FROM artwork_variant v JOIN artwork a ON a.id = v.artwork_id WHERE a.store_id = ${STORE} ORDER BY v.id`,
    placeholderUser: await db`SELECT (to_jsonb(u) - 'updated_at' - 'last_seen_at' - 'last_sign_in_at') AS row FROM users u WHERE id = ${p}`,
    placeholderProfiles: {
      org_profiles: await db`SELECT org_id FROM org_profiles WHERE user_id = ${p} ORDER BY org_id`,
      artist_profiles: await db`SELECT org_id FROM artist_profiles WHERE user_id = ${p}`,
    },
    siteConfigKeys: await db`SELECT key, value FROM site_config WHERE org_id = ${ORG} AND key IN ('shop:store') ORDER BY key`,
    orgMediaCount: await db`SELECT count(*)::int AS n FROM media WHERE org_id = ${ORG}`,
    usersCount: await db`SELECT count(*)::int AS n FROM users`,
    rehearsalUsers: await db`SELECT id, email FROM users WHERE email ILIKE 'rehearsal+%@example.com'`,
  };
  const tokens = await db`SELECT count(*)::int AS total, count(*) FILTER (WHERE consumed_at IS NOT NULL)::int AS used, count(*) FILTER (WHERE consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now())::int AS open FROM org_claim_tokens WHERE org_id = ${ORG}`;
  const json = JSON.stringify(s);
  const out = { sha256: createHash("sha256").update(json).digest("hex"), tokens: tokens[0], ...s };
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  console.log("snapshot sha256:", out.sha256, "tokens:", JSON.stringify(tokens[0]), "store owner:", (s.store[0] as Row)?.owner_user_id, "team:", s.team.length, "pin:", JSON.stringify(s.siteConfigKeys));
}

/** Every FK column in public referencing `table`(id). */
async function refsTo(table: string) {
  return db<Array<{ tbl: string; col: string }>>`
    SELECT cl.relname AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = ${`public.${table}`}::regclass AND n.nspname = 'public'
    ORDER BY 1, 2
  `;
}

async function countRefs(table: string, id: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const r of await refsTo(table)) {
    const [c] = await db.unsafe(`SELECT count(*)::int AS n FROM public."${r.tbl}" WHERE "${r.col}" = $1`, [id]);
    if (c && c.n > 0) out[`${r.tbl}.${r.col}`] = c.n;
  }
  return out;
}

async function claimant(email: string) {
  if (!THROWAWAY.test(email)) throw new Error("refusing: not a rehearsal+…@example.com address");
  const [c] = await db<Row[]>`SELECT id, auth_user_id, storage_folder, slug FROM users WHERE lower(email) = lower(${email})`;
  return c ?? null;
}

async function pieces(title: string) {
  if (!/^Rehearsal piece/.test(title)) throw new Error("refusing: title must start with 'Rehearsal piece'");
  return db<Row[]>`SELECT id, slug, status FROM artwork WHERE store_id = ${STORE} AND title = ${title}`;
}

async function cleanupPiece(title: string) {
  const list = await pieces(title);
  for (const a of list) {
    const id = a.id as string;
    console.log("artwork", id, a.status, "refs:", JSON.stringify(await countRefs("artwork", id)));
    const media = await db<Row[]>`SELECT id, url FROM artwork_media WHERE artwork_id = ${id}`;
    const variants = await db<Row[]>`SELECT id FROM artwork_variant WHERE artwork_id = ${id}`;
    for (const v of variants) console.log(" variant", v.id, "refs:", JSON.stringify(await countRefs("artwork_variant", v.id as string)));
    await db.begin(async (tx) => {
      // Known references first (FK discovery above shows anything else).
      // Variant references were listed above (cart lines, favourites...); none is expected for an unsold piece.
      await tx`UPDATE artwork SET primary_image_id = NULL WHERE id = ${id}`;
      await tx`DELETE FROM artwork_media WHERE artwork_id = ${id}`;
      await tx`DELETE FROM artwork_variant WHERE artwork_id = ${id}`;
      await tx`DELETE FROM artwork WHERE id = ${id}`;
    });
    console.log(" deleted artwork + media rows:", media.length, "variants:", variants.length);
  }
}

async function revert(email: string) {
  const [p] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = lower(${PLACEHOLDER})`;
  if (!p) throw new Error("placeholder missing");
  const c = await claimant(email);
  const cid = (c?.id as string | undefined) ?? null;
  if (cid) console.log("claimant refs before:", JSON.stringify(await countRefs("users", cid)));
  // Files the throwaway uploaded (media rows), then its whole Nextcloud folder.
  const folder = (c?.storage_folder as string | null) ?? null;
  await db.begin(async (tx) => {
    await tx`UPDATE store SET owner_user_id = ${p.id}, updated_at = now() WHERE id = ${STORE}`;
    if (cid) {
      await tx`UPDATE artwork SET artist_user_id = ${p.id} WHERE store_id = ${STORE} AND artist_user_id = ${cid}`;
      await tx`DELETE FROM store_member WHERE store_id = ${STORE} AND user_id = ${cid}`;
    }
    // Baseline: the store had no store_member rows (snapshot before the test).
    await tx`UPDATE user_organizations SET role = 'owner' WHERE org_id = ${ORG} AND user_id = ${p.id}`;
    if (cid) {
      await tx`DELETE FROM media WHERE uploaded_by = ${cid}`;
      await tx`DELETE FROM user_organizations WHERE user_id = ${cid}`;
      await tx`DELETE FROM org_profiles WHERE user_id = ${cid}`;
      await tx`DELETE FROM artist_profiles WHERE user_id = ${cid}`;
      // Visit/analytics rows the throwaway's browsing left (found by FK discovery 2026-11-06).
      for (const t of ["analytics_events", "network_arrivals", "user_site_visits"]) {
        const r = await tx.unsafe(`DELETE FROM public."${t}" WHERE user_id = $1 RETURNING 1`, [cid]);
        console.log(" deleted", t, r.length);
      }
      const ae = await tx`DELETE FROM action_events WHERE actor_id = ${cid} RETURNING 1`;
      console.log(" deleted action_events (actor)", ae.length);
      await tx`UPDATE org_claim_tokens SET consumed_by = NULL WHERE consumed_by = ${cid}`;
      await tx`UPDATE org_claim_tokens SET created_by = NULL WHERE created_by = ${cid}`.catch(() => undefined);
    }
  });
  if (cid) {
    const left = await countRefs("users", cid);
    console.log("claimant refs after the known deletes:", JSON.stringify(left));
    if (Object.keys(left).length) throw new Error("unknown references remain; handle them before deleting the users row");
    await db`DELETE FROM users WHERE id = ${cid}`;
    console.log("users row deleted:", cid);
  }
  if (folder) {
    const root = `EAC_Network/users/${folder}`;
    const before = await davList(root);
    const ok = await davDelete(root);
    const after = await davList(root);
    console.log("nextcloud folder", root, "entries before:", before.length, "delete:", ok, "entries after:", after.length);
  }
  // GoTrue user
  const authId = (c?.auth_user_id as string | null) ?? cid;
  if (authId) {
    const key = process.env.SUPABASE_SERVICE_KEY!;
    const base = process.env.SUPABASE_URL ?? "http://supabase-auth:9999";
    const res = await fetch(`${base}/admin/users/${authId}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}`, apikey: key } });
    console.log("gotrue delete:", res.status);
    const chk = await fetch(`${base}/admin/users/${authId}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    console.log("gotrue lookup after:", chk.status);
  }
}

async function main() {
  const mode = process.env.MODE ?? "snapshot";
  if (mode === "snapshot") await snapshot();
  else if (mode === "fks") {
    const c = await claimant(process.env.CLAIMANT ?? "");
    console.log(c ? JSON.stringify({ id: c.id, auth: c.auth_user_id, folder: c.storage_folder, refs: await countRefs("users", c.id as string) }) : "no such user");
  } else if (mode === "piece") {
    for (const a of await pieces(process.env.TITLE ?? "")) {
      console.log(JSON.stringify({ ...a, refs: await countRefs("artwork", a.id as string) }));
      console.log(" media:", JSON.stringify(await db`SELECT id, url, position, role FROM artwork_media WHERE artwork_id = ${a.id as string} ORDER BY position`));
      console.log(" variant:", JSON.stringify(await db`SELECT id, price_minor, currency, edition_total FROM artwork_variant WHERE artwork_id = ${a.id as string}`).slice(0, 300));
    }
  } else if (mode === "cleanup-piece") await cleanupPiece(process.env.TITLE ?? "");
  else if (mode === "revert") await revert(process.env.CLAIMANT ?? "");
  else if (mode === "create-user") {
    // Stand-in for the site's sign-up form when Turnstile blocks it: a GoTrue
    // password account (email confirmed), the way claim-test did. The
    // password is written to OUT (0600), never printed.
    const email = process.env.CLAIMANT ?? "";
    if (!THROWAWAY.test(email)) throw new Error("refusing: not a rehearsal+…@example.com address");
    const key = process.env.SUPABASE_SERVICE_KEY!;
    const base = process.env.SUPABASE_URL ?? "http://supabase-auth:9999";
    const password = randomBytes(18).toString("base64url") + "a1!";
    const res = await fetch(`${base}/admin/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "Rehearsal Katie" } }),
    });
    if (!res.ok) throw new Error(`gotrue create failed: ${res.status}`);
    writeFileSync(process.env.OUT!, password, { mode: 0o600 });
    const [u] = await db`SELECT id, slug, storage_folder FROM users WHERE lower(email) = lower(${email})`;
    console.log("created", email, JSON.stringify(u ?? null));
  }
  else throw new Error(`unknown MODE ${mode}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });
