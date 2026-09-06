/**
 * Seed users + org_profiles for org 'ifac' from the canonical static roster
 * in src/lib/artists.ts.
 *
 * Superseded directory_profiles (migration 084 merged it into users +
 * org_profiles — see packages/services/src/profiles.ts). Each roster member
 * with no matching account becomes their own sentinel `users` row
 * (claim_status='unclaimed', self-referential auth_user_id — same pattern
 * as the pigeonshoot anonymous author, migration 077) rather than a shared
 * placeholder, so each can independently be claimed later.
 *
 * Idempotent by slug: an existing sentinel (or claimed) row for that slug is
 * updated in place rather than duplicated. Portrait/artworks paths still
 * point at the bundled /ifac/... static files — the Nextcloud media
 * migration (packages/db or apps/ifac/scripts/migrate-media-to-nextcloud.ts)
 * repoints them once the files are uploaded.
 *
 * Run:
 *   DATABASE_URL=... node --experimental-strip-types apps/ifac/scripts/seed-directory.ts
 * or from apps/ifac:
 *   pnpm seed:directory
 */
import postgres from "../../../packages/db/node_modules/postgres/src/index.js";
import { artists, dealers, type IFACProfile } from "../src/lib/artists.ts";

const ORG_ID = "ifac";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

async function seed() {
  const all: IFACProfile[] = [...artists, ...dealers];
  let n = 0;

  for (let i = 0; i < all.length; i++) {
    const p = all[i];

    const portfolio = p.artworks.map((w) => ({ url: w.filename, title: w.title }));
    const socialLinks: { label: string; url: string }[] = p.links.map((l) => ({
      label: l.label,
      url: l.href,
    }));
    if (p.email) socialLinks.push({ label: "Email", url: `mailto:${p.email}` });
    if (p.website) socialLinks.push({ label: "Website", url: p.website });

    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE slug = ${p.slug} LIMIT 1
    `;

    let userId: string;
    if (existing) {
      userId = existing.id;
      await sql`
        UPDATE users SET
          display_name = ${p.name}, bio = ${p.bio.join("\n\n") || null},
          avatar_url = ${p.portrait || null}, social_links = ${sql.json(socialLinks)},
          portfolio = ${sql.json(portfolio)}, updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      // auth_user_id must equal id (users_auth_user_id_matches_id check) — a
      // sentinel row that can never log in, same convention as the
      // pigeonshoot anonymous-author user (migration 077). Generated once in
      // JS so both columns get the identical value.
      const newId = crypto.randomUUID();
      const rows = await sql<{ id: string }[]>`
        INSERT INTO users (id, auth_user_id, display_name, bio, avatar_url, slug, social_links, portfolio, claim_status)
        VALUES (${newId}, ${newId}, ${p.name}, ${p.bio.join("\n\n") || null}, ${p.portrait || null},
                ${p.slug}, ${sql.json(socialLinks)}, ${sql.json(portfolio)}, 'unclaimed')
        RETURNING id
      `;
      userId = rows[0].id;
    }

    await sql`
      INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public, tags)
      VALUES (${ORG_ID}, ${userId}, ${p.role}, ${i}, true, ${sql.array([p.kind])})
      ON CONFLICT (org_id, user_id) DO UPDATE SET
        role_title = EXCLUDED.role_title, sort_order = EXCLUDED.sort_order,
        is_public = true, tags = EXCLUDED.tags, updated_at = NOW()
    `;
    n++;
  }

  console.log(`✓ Seeded ${n} profiles for org '${ORG_ID}'`);
  await sql.end();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
