import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import {
  artists as staticArtists,
  dealers as staticDealers,
  type IFACProfile,
  type Artwork,
  type ExternalLink,
} from "@/lib/artists";

export type { IFACProfile, Artwork, ExternalLink };

type DirectoryRow = {
  slug: string;
  kind: "artist" | "dealer";
  name: string;
  role: string | null;
  bio: unknown;
  portrait_url: string | null;
  artworks: unknown;
  links: unknown;
  email: string | null;
  website: string | null;
  status: "draft" | "published";
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asArtworks(value: unknown): Artwork[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((w) =>
      w && typeof w === "object" && "url" in w
        ? { filename: String((w as { url: unknown }).url), title: String((w as { title?: unknown }).title ?? "") }
        : null
    )
    .filter((w): w is Artwork => w !== null);
}

function asLinks(value: unknown): ExternalLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((l) =>
      l && typeof l === "object" && "href" in l
        ? { label: String((l as { label?: unknown }).label ?? ""), href: String((l as { href: unknown }).href) }
        : null
    )
    .filter((l): l is ExternalLink => l !== null);
}

function rowToProfile(row: DirectoryRow): IFACProfile {
  return {
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    role: row.role ?? "",
    bio: asStringArray(row.bio),
    portrait: row.portrait_url ?? "",
    artworks: asArtworks(row.artworks),
    links: asLinks(row.links),
    email: row.email ?? undefined,
    website: row.website ?? undefined,
  };
}

const SELECT_COLS = `slug, kind, name, role, bio, portrait_url, artworks, links, email, website, status`;

/**
 * List published profiles of a kind. Falls back to the bundled static roster
 * if the DB is empty or unreachable, so the site never renders blank.
 */
export async function listDirectory(kind: "artist" | "dealer"): Promise<IFACProfile[]> {
  try {
    const rows = await db<DirectoryRow[]>`
      SELECT slug, kind, name, role, bio, portrait_url, artworks, links, email, website, status
      FROM directory_profiles
      WHERE org_id = ${siteConfig.orgId}
        AND kind = ${kind}
        AND status = 'published'
      ORDER BY sort_order ASC, name ASC
    `;
    if (rows.length > 0) return rows.map(rowToProfile);
  } catch (error) {
    console.error("[ifac] listDirectory error:", error);
  }
  return kind === "artist" ? staticArtists : staticDealers;
}

/**
 * Fetch one profile by slug (artist or dealer). DB first, static fallback.
 */
export async function getDirectoryProfile(slug: string): Promise<IFACProfile | undefined> {
  try {
    const rows = await db<DirectoryRow[]>`
      SELECT slug, kind, name, role, bio, portrait_url, artworks, links, email, website, status
      FROM directory_profiles
      WHERE org_id = ${siteConfig.orgId}
        AND slug = ${slug}
        AND status = 'published'
      LIMIT 1
    `;
    if (rows[0]) return rowToProfile(rows[0]);
  } catch (error) {
    console.error("[ifac] getDirectoryProfile error:", error);
  }
  return (
    staticArtists.find((p) => p.slug === slug) ??
    staticDealers.find((p) => p.slug === slug)
  );
}

/** All slugs of a kind — used for generateStaticParams. */
export async function listDirectorySlugs(kind: "artist" | "dealer"): Promise<string[]> {
  try {
    const rows = await db<{ slug: string }[]>`
      SELECT slug FROM directory_profiles
      WHERE org_id = ${siteConfig.orgId} AND kind = ${kind}
    `;
    if (rows.length > 0) return rows.map((r) => r.slug);
  } catch {
    // fall through to static
  }
  return (kind === "artist" ? staticArtists : staticDealers).map((p) => p.slug);
}
