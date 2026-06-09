/**
 * Seed directory_profiles for org 'ifac' from the canonical static roster in
 * src/lib/artists.ts. Idempotent: upserts on (org_id, slug), preserving any
 * admin edits to fields not derived from the static source would be lost, so
 * this is intended for first-time seeding / re-seeding from source of truth.
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
    const artworks = p.artworks.map((w) => ({ url: w.filename, title: w.title }));
    const links = p.links.map((l) => ({ label: l.label, href: l.href }));

    await sql`
      INSERT INTO directory_profiles
        (org_id, slug, kind, name, role, bio, portrait_url, artworks, links, email, website, sort_order, status)
      VALUES (
        ${ORG_ID},
        ${p.slug},
        ${p.kind},
        ${p.name},
        ${p.role},
        ${sql.json(p.bio)},
        ${p.portrait},
        ${sql.json(artworks)},
        ${sql.json(links)},
        ${p.email ?? null},
        ${p.website ?? null},
        ${i},
        'published'
      )
      ON CONFLICT (org_id, slug) DO UPDATE SET
        kind = EXCLUDED.kind,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        bio = EXCLUDED.bio,
        portrait_url = EXCLUDED.portrait_url,
        artworks = EXCLUDED.artworks,
        links = EXCLUDED.links,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `;
    n++;
  }

  console.log(`✓ Seeded ${n} directory profiles for org '${ORG_ID}'`);
  await sql.end();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
