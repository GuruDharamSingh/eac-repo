/**
 * Moves IFAC's committed static images (apps/ifac/public/ifac/artists|dealers/)
 * into Nextcloud, alongside every other org's media, and repoints each
 * member's users.avatar_url / users.portfolio at the new /api/media proxy
 * URLs.
 *
 * Only migrates files actually referenced by src/lib/artists.ts (portrait +
 * each artwork) — the public/ifac/* folders also carry legacy static-site
 * cruft (index.html, old vote buttons, etc.) that was never really "member
 * media" and shouldn't follow into Nextcloud.
 *
 * Idempotent: skips a member entirely once their users.avatar_url already
 * points at /api/media/ — safe to re-run after a partial failure. Does NOT
 * delete the local files; that's a manual follow-up once this is verified.
 *
 * Run from apps/ifac:
 *   DATABASE_URL=... NEXTCLOUD_URL=... NEXTCLOUD_ADMIN_USER=... NEXTCLOUD_ADMIN_PASSWORD=... \
 *     pnpm exec tsx scripts/migrate-media-to-nextcloud.ts
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "../../../packages/db/node_modules/postgres/src/index.js";
import { artists, dealers, type IFACProfile } from "../src/lib/artists.ts";

const ORG_ID = "ifac";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = join(__dirname, "..", "public", "ifac");

const DATABASE_URL = process.env.DATABASE_URL;
const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL;
const NC_USER = process.env.NEXTCLOUD_ADMIN_USER;
const NC_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD;

if (!DATABASE_URL || !NEXTCLOUD_URL || !NC_USER || !NC_PASS) {
  console.error("DATABASE_URL, NEXTCLOUD_URL, NEXTCLOUD_ADMIN_USER, NEXTCLOUD_ADMIN_PASSWORD are required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
const NC_AUTH = "Basic " + Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64");

function localPathFor(kind: "artist" | "dealer", slug: string, filename: string): string {
  return join(PUBLIC_ROOT, `${kind}s`, slug, filename);
}

function contentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
}

async function uploadToNextcloud(ncPath: string, buffer: Buffer, mime: string): Promise<boolean> {
  const url = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER!)}/${ncPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await fetch(url, { method: "PUT", headers: { Authorization: NC_AUTH, "Content-Type": mime }, body: buffer });
  if (!res.ok) console.error(`  ✗ upload failed (${res.status}): ${ncPath}`);
  return res.ok;
}

function proxyUrl(ncPath: string): string {
  return `/api/media/${ncPath}`;
}

/** One member: portrait + each artwork. Returns [] on any missing local file rather than partially uploading. */
async function migrateMember(kind: "artist" | "dealer", p: IFACProfile) {
  const [row] = await sql<{ id: string; avatar_url: string | null }[]>`
    SELECT id, avatar_url FROM users WHERE slug = ${p.slug} LIMIT 1
  `;
  if (!row) {
    console.log(`  ⊘ ${p.slug}: no users row (seed-directory.ts must run first)`);
    return;
  }
  if (row.avatar_url?.startsWith("/api/media/")) {
    console.log(`  ⊘ ${p.slug}: already migrated`);
    return;
  }

  console.log(`  → ${p.slug} (${p.name})`);
  let avatarUrl: string | null = null;
  const portfolio: { url: string; title: string }[] = [];

  // Portrait: p.portrait is a URL like /ifac/artists/andrepace/image.jpg
  if (p.portrait) {
    const filename = decodeURIComponent(p.portrait.split("/").pop()!);
    const local = localPathFor(kind, p.slug, filename);
    const ncPath = `EAC_Network/${ORG_ID}/Media/Images/${p.slug}/${filename}`;
    try {
      const buf = await readFile(local);
      if (await uploadToNextcloud(ncPath, buf, contentType(filename))) {
        avatarUrl = proxyUrl(ncPath);
      }
    } catch (err) {
      console.error(`    portrait missing on disk: ${local}`);
    }
  }

  for (const work of p.artworks) {
    const filename = decodeURIComponent(work.filename.split("/").pop()!);
    const local = localPathFor(kind, p.slug, filename);
    const ncPath = `EAC_Network/${ORG_ID}/Media/Images/${p.slug}/${filename}`;
    try {
      const buf = await readFile(local);
      if (await uploadToNextcloud(ncPath, buf, contentType(filename))) {
        portfolio.push({ url: proxyUrl(ncPath), title: work.title });
      }
    } catch (err) {
      console.error(`    artwork missing on disk: ${local}`);
    }
  }

  await sql`
    UPDATE users SET
      avatar_url = COALESCE(${avatarUrl}, avatar_url),
      portfolio = ${sql.json(portfolio)},
      updated_at = NOW()
    WHERE id = ${row.id}
  `;
  console.log(`    ✓ ${portfolio.length} artwork(s)${avatarUrl ? " + portrait" : ""}`);
}

async function main() {
  for (const p of artists) await migrateMember("artist", p);
  for (const p of dealers) await migrateMember("dealer", p);
  console.log("✓ Migration pass complete");
  await sql.end();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await sql.end();
  process.exit(1);
});
