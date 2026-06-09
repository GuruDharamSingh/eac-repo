import "server-only";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { Artwork, ExternalLink } from "@/lib/artists";

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

type RawRow = Omit<AdminDirectoryRow, "bio" | "artworks" | "links"> & {
  bio: unknown;
  artworks: unknown;
  links: unknown;
};

function normalize(row: RawRow): AdminDirectoryRow {
  return {
    ...row,
    bio: Array.isArray(row.bio) ? (row.bio as string[]) : [],
    artworks: Array.isArray(row.artworks)
      ? (row.artworks as { url: string; title: string }[]).map((w) => ({ filename: w.url, title: w.title }))
      : [],
    links: Array.isArray(row.links) ? (row.links as ExternalLink[]) : [],
  };
}

export async function listAllDirectory(): Promise<AdminDirectoryRow[]> {
  const rows = await db<RawRow[]>`
    SELECT id, slug, kind, name, role, bio, portrait_url, artworks, links,
           email, website, sort_order, status, updated_at
    FROM directory_profiles
    WHERE org_id = ${siteConfig.orgId}
    ORDER BY kind ASC, sort_order ASC, name ASC
  `;
  return rows.map(normalize);
}

// Store artworks as { url, title } in the DB (matches the public read mapping).
function toDbArtworks(artworks: Artwork[]): { url: string; title: string }[] {
  return artworks.map((w) => ({ url: w.filename, title: w.title }));
}

export async function createProfile(input: DirectoryInput): Promise<AdminDirectoryRow> {
  const [maxRow] = await db<{ max: number | null }[]>`
    SELECT MAX(sort_order) AS max FROM directory_profiles
    WHERE org_id = ${siteConfig.orgId} AND kind = ${input.kind}
  `;
  const sortOrder = input.sort_order ?? (maxRow?.max ?? -1) + 1;

  const [row] = await db<RawRow[]>`
    INSERT INTO directory_profiles
      (org_id, slug, kind, name, role, bio, portrait_url, artworks, links, email, website, sort_order, status)
    VALUES (
      ${siteConfig.orgId}, ${input.slug}, ${input.kind}, ${input.name},
      ${input.role || null}, ${db.json(input.bio)}, ${input.portrait_url || null},
      ${db.json(toDbArtworks(input.artworks))}, ${db.json(input.links)},
      ${input.email || null}, ${input.website || null}, ${sortOrder}, ${input.status}
    )
    RETURNING id, slug, kind, name, role, bio, portrait_url, artworks, links,
              email, website, sort_order, status, updated_at
  `;
  return normalize(row);
}

export async function updateProfile(id: string, input: DirectoryInput): Promise<AdminDirectoryRow | null> {
  const [row] = await db<RawRow[]>`
    UPDATE directory_profiles SET
      slug = ${input.slug},
      kind = ${input.kind},
      name = ${input.name},
      role = ${input.role || null},
      bio = ${db.json(input.bio)},
      portrait_url = ${input.portrait_url || null},
      artworks = ${db.json(toDbArtworks(input.artworks))},
      links = ${db.json(input.links)},
      email = ${input.email || null},
      website = ${input.website || null},
      status = ${input.status},
      sort_order = COALESCE(${input.sort_order ?? null}, sort_order),
      updated_at = NOW()
    WHERE id = ${id} AND org_id = ${siteConfig.orgId}
    RETURNING id, slug, kind, name, role, bio, portrait_url, artworks, links,
              email, website, sort_order, status, updated_at
  `;
  return row ? normalize(row) : null;
}

export async function deleteProfile(id: string): Promise<boolean> {
  const rows = await db`
    DELETE FROM directory_profiles
    WHERE id = ${id} AND org_id = ${siteConfig.orgId}
    RETURNING id
  `;
  return rows.length > 0;
}
