import {
  listOrgProfiles,
  getOrgProfileBySlug,
  type OrgProfile,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type { IFACProfile, Artwork, ExternalLink } from "@/lib/artists";

export type { IFACProfile, Artwork, ExternalLink };

// Backed by users + org_profiles (migration 084/085) rather than the
// now-legacy directory_profiles table — see packages/services/src/profiles.ts
// for the identity/publish split, and migration 085 for why "artist" vs
// "dealer" lives in org_profiles.tags instead of a `kind` column: it's
// IFAC's own categorization, not something every org has.
type ProfileRow = {
  user_id: string;
  slug: string | null;
  tags: string[];
  name: string | null;
  role: string | null;
  bio: string | null;
  portrait_url: string | null;
  artworks: unknown;
  social_links: unknown;
  claim_status: "unclaimed" | "pending" | "claimed";
};

function asArtworks(value: unknown): Artwork[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((w): Artwork | null => {
      if (!w || typeof w !== "object" || !("url" in w)) return null;
      const r = w as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === "number" ? v : undefined);
      return {
        filename: String(r.url),
        title: String(r.title ?? ""),
        id: typeof r.id === "string" ? r.id : undefined,
        x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
      };
    })
    .filter((w): w is Artwork => w !== null);
}

/**
 * social_links carries the artist's real links plus, when present, one
 * "Email" (mailto:) and one "Website" entry — reusing the generic link list
 * rather than adding IFAC-only email/website columns to `users`. Split back
 * out here so the rest of the app keeps the same IFACProfile shape it always
 * had.
 */
function splitLinks(value: unknown): { links: ExternalLink[]; email?: string; website?: string } {
  const raw = Array.isArray(value) ? value : [];
  const links: ExternalLink[] = [];
  let email: string | undefined;
  let website: string | undefined;

  for (const l of raw) {
    if (!l || typeof l !== "object" || !("url" in l)) continue;
    const label = String((l as { label?: unknown }).label ?? "");
    const url = String((l as { url: unknown }).url);
    if (label === "Email" && url.startsWith("mailto:")) {
      email = url.slice("mailto:".length);
    } else if (label === "Website") {
      website = url;
    } else {
      links.push({ label, href: url });
    }
  }
  return { links, email, website };
}

function rowToProfile(row: ProfileRow, kind: "artist" | "dealer"): IFACProfile {
  const { links, email, website } = splitLinks(row.social_links);
  return {
    userId: row.user_id,
    slug: row.slug ?? "",
    name: row.name ?? "",
    kind,
    role: row.role ?? "",
    bio: row.bio ? row.bio.split("\n\n") : [],
    portrait: row.portrait_url ?? "",
    artworks: asArtworks(row.artworks),
    links,
    email,
    website,
    claimStatus: row.claim_status,
  };
}

/**
 * The shared profile service returns camelCase OrgProfile; everything below
 * this file already speaks the snake_case ProfileRow shape. Adapting here
 * rather than rewriting rowToProfile keeps the rendered page byte-identical
 * while the data source moves onto @elkdonis/services.
 */
function serviceToRow(p: OrgProfile): ProfileRow {
  return {
    user_id: p.userId,
    slug: p.slug,
    tags: p.tags,
    name: p.displayName,
    role: p.roleTitle,
    bio: p.bio,
    portrait_url: p.avatarUrl,
    artworks: p.portfolio,
    social_links: p.socialLinks,
    claim_status: p.claimStatus,
  };
}

/**
 * List published profiles of a kind, from the database (pictures from Nextcloud).
 */
export async function listDirectory(kind: "artist" | "dealer"): Promise<IFACProfile[]> {
  const rows = await listOrgProfiles(siteConfig.orgId, {
    onlyPublic: true,
    tags: [kind],
  });
  // No static fallback any more: the bundled roster carried copies of every
  // picture in the app itself, so an outage or an empty table quietly served
  // pictures that were not the ones in the artists' own Nextcloud folders.
  // Every profile and picture now comes from the database and Nextcloud.
  return rows.map((r) => rowToProfile(serviceToRow(r), kind));
}

/**
 * Fetch one profile by slug (artist or dealer), from the database.
 *
 * A row that EXISTS but is not public means unpublished — not "fall through to
 * the bundled copy". That distinction is what makes unlisting someone in
 * /manage actually take them off the site: 23 of the roster are also hardcoded
 * in artists.ts, so the old `row && row.isPublic` test sent every unlisted one
 * of them straight into the static fallback and kept their page live. The
 * fallback is only for a slug the database has never heard of.
 */
export async function getDirectoryProfile(slug: string): Promise<IFACProfile | undefined> {
  // includePrivate: an unpublished row must read as "unpublished", not as
  // "no such profile" — otherwise the static fallback below resurrects it.
  const row = await getOrgProfileBySlug(siteConfig.orgId, slug, { includePrivate: true });
  if (row) {
    if (!row.isPublic) return undefined;
    const kind = row.tags.includes("dealer") ? "dealer" : "artist";
    return rowToProfile(serviceToRow(row), kind);
  }
  // A slug the database has never heard of is not a profile (see listDirectory).
  return undefined;
}

/** All slugs of a kind — used for generateStaticParams. */
export async function listDirectorySlugs(kind: "artist" | "dealer"): Promise<string[]> {
  const rows = await listOrgProfiles(siteConfig.orgId, {
    onlyPublic: true,
    tags: [kind],
  });
  return rows.map((r) => r.slug).filter((s): s is string => Boolean(s));
}
