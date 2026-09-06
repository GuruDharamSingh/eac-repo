import "server-only";
import { db } from "@elkdonis/db";
import { ensureUniqueUserSlug, adminAssignProfile, type ClaimStatus } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type { Artwork, ExternalLink } from "@/lib/artists";

// Backed by users + org_profiles (migration 084/085) — see
// packages/services/src/profiles.ts and src/lib/directory.ts (the public
// read path this mirrors). `id` below is users.id; `kind` is derived from
// org_profiles.tags; email/website are folded into social_links (see
// directory.ts's splitLinks) rather than added as columns on `users`.

export type AdminDirectoryRow = {
  id: string;
  slug: string;
  kind: "artist" | "dealer";
  name: string;
  role: string | null;
  bio: string[];
  portrait_url: string | null;
  artworks: Artwork[];
  links: ExternalLink[];
  email: string | null;
  website: string | null;
  sort_order: number;
  status: "draft" | "published";
  updated_at: string;
  claimStatus: ClaimStatus;
};

export type DirectoryInput = {
  slug: string;
  kind: "artist" | "dealer";
  name: string;
  role: string;
  bio: string[];
  portrait_url: string;
  artworks: Artwork[];
  links: ExternalLink[];
  email: string;
  website: string;
  status: "draft" | "published";
  sort_order?: number;
};

type RawRow = {
  id: string;
  slug: string | null;
  tags: string[];
  name: string | null;
  role: string | null;
  bio: string | null;
  portrait_url: string | null;
  artworks: unknown;
  social_links: unknown;
  sort_order: number;
  is_public: boolean;
  updated_at: string;
  claim_status: ClaimStatus;
};

function socialLinksFor(links: ExternalLink[], email: string, website: string) {
  const out: { label: string; url: string }[] = links.map((l) => ({ label: l.label, url: l.href }));
  if (email) out.push({ label: "Email", url: `mailto:${email}` });
  if (website) out.push({ label: "Website", url: website });
  return out;
}

function splitSocialLinks(value: unknown): { links: ExternalLink[]; email: string | null; website: string | null } {
  const raw = Array.isArray(value) ? value : [];
  const links: ExternalLink[] = [];
  let email: string | null = null;
  let website: string | null = null;
  for (const l of raw) {
    if (!l || typeof l !== "object" || !("url" in l)) continue;
    const label = String((l as { label?: unknown }).label ?? "");
    const url = String((l as { url: unknown }).url);
    if (label === "Email" && url.startsWith("mailto:")) email = url.slice("mailto:".length);
    else if (label === "Website") website = url;
    else links.push({ label, href: url });
  }
  return { links, email, website };
}

function normalize(row: RawRow): AdminDirectoryRow {
  const { links, email, website } = splitSocialLinks(row.social_links);
  return {
    id: row.id,
    slug: row.slug ?? "",
    kind: row.tags.includes("dealer") ? "dealer" : "artist",
    name: row.name ?? "",
    role: row.role,
    bio: row.bio ? row.bio.split("\n\n") : [],
    portrait_url: row.portrait_url,
    artworks: Array.isArray(row.artworks)
      ? (row.artworks as { url: string; title: string }[]).map((w) => ({ filename: w.url, title: w.title }))
      : [],
    links,
    email,
    website,
    sort_order: row.sort_order,
    status: row.is_public ? "published" : "draft",
    updated_at: row.updated_at,
    claimStatus: row.claim_status,
  };
}

const SELECT = `u.id, u.slug, op.tags, u.display_name AS name, op.role_title AS role,
  u.bio, u.avatar_url AS portrait_url, u.portfolio AS artworks, u.social_links,
  op.sort_order, op.is_public, u.updated_at, u.claim_status`;

export async function listAllDirectory(): Promise<AdminDirectoryRow[]> {
  const rows = await db<RawRow[]>`
    SELECT ${db.unsafe(SELECT)}
    FROM org_profiles op JOIN users u ON u.id = op.user_id
    WHERE op.org_id = ${siteConfig.orgId}
    ORDER BY op.tags ASC, op.sort_order ASC, u.display_name ASC
  `;
  return rows.map(normalize);
}

function toDbArtworks(artworks: Artwork[]): { url: string; title: string }[] {
  return artworks.map((w) => ({ url: w.filename, title: w.title }));
}

/** New roster entry with no account yet — a claimable sentinel, same shape as the seed script. */
export async function createProfile(input: DirectoryInput): Promise<AdminDirectoryRow> {
  const [maxRow] = await db<{ max: number | null }[]>`
    SELECT MAX(op.sort_order) AS max FROM org_profiles op
    WHERE op.org_id = ${siteConfig.orgId} AND op.tags @> ARRAY[${input.kind}]
  `;
  const sortOrder = input.sort_order ?? (maxRow?.max ?? -1) + 1;
  const slug = await ensureUniqueUserSlug(input.slug || input.name);
  const socialLinks = socialLinksFor(input.links, input.email, input.website);
  const newId = crypto.randomUUID();

  await db`
    INSERT INTO users (id, auth_user_id, display_name, bio, avatar_url, slug, social_links, portfolio, claim_status)
    VALUES (${newId}, ${newId}, ${input.name}, ${input.bio.join("\n\n") || null}, ${input.portrait_url || null},
            ${slug}, ${db.json(socialLinks)}, ${db.json(toDbArtworks(input.artworks))}, 'unclaimed')
  `;
  await db`
    INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public, tags)
    VALUES (${siteConfig.orgId}, ${newId}, ${input.role || null}, ${sortOrder},
            ${input.status === "published"}, ${db.array([input.kind])})
  `;

  const [row] = await db<RawRow[]>`SELECT ${db.unsafe(SELECT)} FROM org_profiles op JOIN users u ON u.id = op.user_id WHERE u.id = ${newId}`;
  return normalize(row);
}

export async function updateProfile(id: string, input: DirectoryInput): Promise<AdminDirectoryRow | null> {
  const [existing] = await db<{ slug: string | null }[]>`SELECT slug FROM users WHERE id = ${id}`;
  if (!existing) return null;

  const slug = input.slug && input.slug !== existing.slug
    ? await ensureUniqueUserSlug(input.slug, id)
    : existing.slug;
  const socialLinks = socialLinksFor(input.links, input.email, input.website);

  await db`
    UPDATE users SET
      display_name = ${input.name}, bio = ${input.bio.join("\n\n") || null},
      avatar_url = ${input.portrait_url || null}, slug = ${slug || null},
      social_links = ${db.json(socialLinks)}, portfolio = ${db.json(toDbArtworks(input.artworks))},
      updated_at = NOW()
    WHERE id = ${id}
  `;
  const result = await db`
    UPDATE org_profiles SET
      role_title = ${input.role || null},
      is_public = ${input.status === "published"},
      sort_order = COALESCE(${input.sort_order ?? null}, sort_order),
      tags = ${db.array([input.kind])}, updated_at = NOW()
    WHERE org_id = ${siteConfig.orgId} AND user_id = ${id}
    RETURNING user_id
  `;
  if (result.length === 0) return null;

  const [row] = await db<RawRow[]>`SELECT ${db.unsafe(SELECT)} FROM org_profiles op JOIN users u ON u.id = op.user_id WHERE u.id = ${id} AND op.org_id = ${siteConfig.orgId}`;
  return row ? normalize(row) : null;
}

/**
 * Removes this roster entry from IFAC. If it's an unclaimed sentinel with no
 * other org publishing it, the underlying users row is removed too — an
 * admin-opened placeholder with nowhere else it's published shouldn't linger.
 * A claimed account, or one published elsewhere, is only un-published here.
 */
export async function deleteProfile(id: string): Promise<boolean> {
  const rows = await db`
    DELETE FROM org_profiles WHERE org_id = ${siteConfig.orgId} AND user_id = ${id}
    RETURNING user_id
  `;
  if (rows.length === 0) return false;

  await db`
    DELETE FROM users
    WHERE id = ${id} AND claim_status = 'unclaimed'
      AND NOT EXISTS (SELECT 1 FROM org_profiles WHERE user_id = ${id})
  `;
  return true;
}

export type AssignableMember = {
  userId: string;
  email: string;
  displayName: string | null;
};

/**
 * Real (claimed) IFAC members an unclaimed roster row can be matched to —
 * the pool for the admin's "this is actually so-and-so" dropdown. Signed-up
 * members only (user_organizations), not other unclaimed sentinels — you
 * can't match a placeholder to another placeholder.
 */
export async function listAssignableMembers(): Promise<AssignableMember[]> {
  return db<AssignableMember[]>`
    SELECT u.id AS "userId", u.email, u.display_name AS "displayName"
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${siteConfig.orgId} AND u.claim_status = 'claimed'
    ORDER BY u.display_name NULLS LAST, u.email
  `;
}

/**
 * Admin-confirmed match: `memberId` (a real, signed-up IFAC member) IS the
 * person behind this unclaimed roster row. Skips the self-service claim
 * request — for when the org already knows who someone is. Authorization is
 * this file's job (server actions calling this must have checked
 * canManageIfac first — see api/admin/directory/route.ts), matching
 * adminAssignProfile's trust convention.
 */
export async function assignProfile(sentinelId: string, memberId: string): Promise<{ ok: boolean; error?: string }> {
  return adminAssignProfile(sentinelId, memberId);
}
