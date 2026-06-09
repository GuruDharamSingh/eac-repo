import { db } from "@elkdonis/db";
import type {
  DossierProfileData,
  DossierOperation,
  DossierChannel,
} from "@elkdonis/cms-bindings/dossier";

/**
 * ArtDirect / Online Artist Directory (OAD) data layer.
 *
 * Entries are community-contributed, claimable artist pages stored in
 * `directory_profiles` under the reserved 'oad' org namespace. They render
 * through the "Classified Artist Dossier" template via @elkdonis/cms-bindings.
 */

export const OAD_ORG_ID = "oad";

type Row = {
  slug: string;
  name: string;
  role: string | null;
  location: string | null;
  dossier_status: string | null;
  bio: unknown;
  portrait_url: string | null;
  operations: unknown;
  artworks: unknown;
  current_targets: string[] | null;
  projected_movements: string[] | null;
  verified_contacts: string[] | null;
  wanted_accomplices: string[] | null;
  financial_channels: unknown;
  links: unknown;
  email: string | null;
  website: string | null;
  claim_status: "unclaimed" | "pending" | "claimed";
  verified: boolean;
};

function bioToString(value: unknown): string | null {
  if (Array.isArray(value)) return value.filter((p) => typeof p === "string").join("\n\n") || null;
  if (typeof value === "string") return value || null;
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asOperations(operations: unknown, artworks: unknown): DossierOperation[] {
  if (Array.isArray(operations) && operations.length > 0) {
    return operations
      .map((o): DossierOperation | null =>
        o && typeof o === "object"
          ? {
              title: String((o as { title?: unknown }).title ?? ""),
              date: (o as { date?: string | null }).date ?? null,
              details: (o as { details?: string | null }).details ?? null,
              image_url: (o as { image_url?: string | null }).image_url ?? null,
            }
          : null
      )
      .filter((o): o is DossierOperation => o !== null && Boolean(o.title));
  }
  // Reuse: a simple artworks list [{url,title}] becomes operations.
  if (Array.isArray(artworks)) {
    return artworks
      .map((w): DossierOperation | null =>
        w && typeof w === "object"
          ? { title: String((w as { title?: unknown }).title ?? ""), image_url: String((w as { url?: unknown }).url ?? "") || null }
          : null
      )
      .filter((o): o is DossierOperation => o !== null && Boolean(o.title));
  }
  return [];
}

function asChannels(channels: unknown, links: unknown): DossierChannel[] {
  if (Array.isArray(channels) && channels.length > 0) {
    return channels
      .map((c): DossierChannel | null =>
        c && typeof c === "object" && "url" in c
          ? {
              title: String((c as { title?: unknown }).title ?? ""),
              description: (c as { description?: string | null }).description ?? null,
              url: String((c as { url: unknown }).url),
            }
          : null
      )
      .filter((c): c is DossierChannel => c !== null && Boolean(c.url));
  }
  // Reuse: a simple links list [{label,href}] becomes funding channels.
  if (Array.isArray(links)) {
    return links
      .map((l): DossierChannel | null =>
        l && typeof l === "object" && "href" in l
          ? { title: String((l as { label?: unknown }).label ?? ""), url: String((l as { href: unknown }).href) }
          : null
      )
      .filter((c): c is DossierChannel => c !== null && Boolean(c.url));
  }
  return [];
}

function rowToDossier(row: Row): DossierProfileData {
  return {
    slug: row.slug,
    name: row.name,
    occupation: row.role,
    location: row.location,
    dossier_status: row.dossier_status,
    bio: bioToString(row.bio),
    photo_url: row.portrait_url,
    operations: asOperations(row.operations, row.artworks),
    current_targets: asStringArray(row.current_targets),
    projected_movements: asStringArray(row.projected_movements),
    verified_contacts: asStringArray(row.verified_contacts),
    wanted_accomplices: asStringArray(row.wanted_accomplices),
    financial_channels: asChannels(row.financial_channels, row.links),
    claim_status: row.claim_status,
    verified: row.verified,
    contact_href: row.email ? `mailto:${row.email}` : row.website || null,
  };
}

export async function getDossierProfile(slug: string): Promise<DossierProfileData | null> {
  try {
    const rows = await db<Row[]>`
      SELECT slug, name, role, location, dossier_status, bio, portrait_url,
             operations, artworks, current_targets, projected_movements,
             verified_contacts, wanted_accomplices, financial_channels, links,
             email, website, claim_status, verified
      FROM directory_profiles
      WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug} AND status = 'published'
      LIMIT 1
    `;
    return rows[0] ? rowToDossier(rows[0]) : null;
  } catch (error) {
    console.error("[oad] getDossierProfile error:", error);
    return null;
  }
}

export type DossierListItem = {
  slug: string;
  name: string;
  occupation: string | null;
  location: string | null;
  region: string | null;
  country: string | null;
  portrait_url: string | null;
  claim_status: "unclaimed" | "pending" | "claimed";
  verified: boolean;
  vouch_count: number;
};

export async function listDossiers(opts: { region?: string; limit?: number } = {}): Promise<DossierListItem[]> {
  const { region, limit = 60 } = opts;
  try {
    return await db<DossierListItem[]>`
      SELECT p.slug, p.name, p.role AS occupation, p.location, p.region, p.country,
             p.portrait_url, p.claim_status, p.verified,
             COALESCE(v.n, 0)::int AS vouch_count
      FROM directory_profiles p
      LEFT JOIN (
        SELECT profile_id, COUNT(*) AS n FROM directory_vouches GROUP BY profile_id
      ) v ON v.profile_id = p.id
      WHERE p.org_id = ${OAD_ORG_ID} AND p.status = 'published'
        ${region ? db`AND p.region = ${region}` : db``}
      ORDER BY p.verified DESC, vouch_count DESC, p.sort_order ASC, p.name ASC
      LIMIT ${limit}
    `;
  } catch (error) {
    console.error("[oad] listDossiers error:", error);
    return [];
  }
}

export type DirectoryFacets = { cities: string[]; regions: string[]; countries: string[] };

export async function listDirectoryFacets(): Promise<DirectoryFacets> {
  try {
    const rows = await db<{ kind: "city" | "region" | "country"; value: string }[]>`
      SELECT 'city' AS kind, city AS value FROM directory_profiles
        WHERE org_id = ${OAD_ORG_ID} AND city IS NOT NULL AND city <> ''
      UNION
      SELECT 'region' AS kind, region AS value FROM directory_profiles
        WHERE org_id = ${OAD_ORG_ID} AND region IS NOT NULL AND region <> ''
      UNION
      SELECT 'country' AS kind, country AS value FROM directory_profiles
        WHERE org_id = ${OAD_ORG_ID} AND country IS NOT NULL AND country <> ''
      ORDER BY value ASC
    `;
    return {
      cities: rows.filter((r) => r.kind === "city").map((r) => r.value),
      regions: rows.filter((r) => r.kind === "region").map((r) => r.value),
      countries: rows.filter((r) => r.kind === "country").map((r) => r.value),
    };
  } catch {
    return { cities: [], regions: [], countries: [] };
  }
}

/** Distinct regions with dossier counts — for hub indexes / analytics. */
export async function listRegions(): Promise<{ region: string; country: string | null; count: number }[]> {
  try {
    return await db<{ region: string; country: string | null; count: number }[]>`
      SELECT region, MAX(country) AS country, COUNT(*)::int AS count
      FROM directory_profiles
      WHERE org_id = ${OAD_ORG_ID} AND status = 'published' AND region IS NOT NULL AND region <> ''
      GROUP BY region
      ORDER BY count DESC, region ASC
    `;
  } catch {
    return [];
  }
}

/**
 * Dossiers in a region — the API any community hub uses to surface
 * "artists in your region". Reusable across orgs/geographies.
 */
export async function getDossiersByRegion(region: string, limit = 12): Promise<DossierListItem[]> {
  return listDossiers({ region, limit });
}

export async function listDossierSlugs(): Promise<string[]> {
  try {
    const rows = await db<{ slug: string }[]>`
      SELECT slug FROM directory_profiles WHERE org_id = ${OAD_ORG_ID}
    `;
    return rows.map((r) => r.slug);
  } catch {
    return [];
  }
}

// ─── wiki state: meta, vouches, stewardship ──────────────────────────────────

export type DossierMeta = {
  id: string;
  slug: string;
  name: string;
  created_by: string | null;
  claim_status: "unclaimed" | "pending" | "claimed";
  claimed_by: string | null;
  verified: boolean;
  vouch_count: number;
  city: string | null;
  region: string | null;
  country: string | null;
};

export async function getDossierMeta(slug: string): Promise<DossierMeta | null> {
  try {
    const rows = await db<DossierMeta[]>`
      SELECT p.id, p.slug, p.name, p.created_by, p.claim_status, p.claimed_by, p.verified,
             p.city, p.region, p.country,
             (SELECT COUNT(*)::int FROM directory_vouches v WHERE v.profile_id = p.id) AS vouch_count
      FROM directory_profiles p
      WHERE p.org_id = ${OAD_ORG_ID} AND p.slug = ${slug}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    console.error("[oad] getDossierMeta error:", error);
    return null;
  }
}

export type DossierEditFields = {
  slug: string;
  name: string;
  occupation: string;
  city: string;
  region: string;
  country: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  location: string;
  bioText: string;
  portrait_url: string;
  website: string;
  email: string;
  linksText: string;
  source_note: string;
};

/** Raw editable values for the contribute/edit form (DB shape, not render shape). */
export async function getDossierEditFields(slug: string): Promise<DossierEditFields | null> {
  try {
    const rows = await db<
      {
        slug: string;
        name: string;
        role: string | null;
        city: string | null;
        region: string | null;
        country: string | null;
        postal_code: string | null;
        lat: number | null;
        lng: number | null;
        location: string | null;
        bio: unknown;
        portrait_url: string | null;
        website: string | null;
        email: string | null;
        links: unknown;
        source_note: string | null;
      }[]
    >`
      SELECT slug, name, role, city, region, country, postal_code, lat, lng, location, bio, portrait_url,
             website, email, links, source_note
      FROM directory_profiles
      WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    const bioText = Array.isArray(r.bio) ? (r.bio as string[]).join("\n\n") : typeof r.bio === "string" ? r.bio : "";
    const linksText = Array.isArray(r.links)
      ? (r.links as { label?: string; href?: string }[]).map((l) => `${l.label ?? ""} | ${l.href ?? ""}`).join("\n")
      : "";
    return {
      slug: r.slug,
      name: r.name,
      occupation: r.role ?? "",
      city: r.city ?? "",
      region: r.region ?? "",
      country: r.country ?? "",
      postcode: r.postal_code ?? "",
      lat: r.lat,
      lng: r.lng,
      location: r.location ?? "",
      bioText,
      portrait_url: r.portrait_url ?? "",
      website: r.website ?? "",
      email: r.email ?? "",
      linksText,
      source_note: r.source_note ?? "",
    };
  } catch (error) {
    console.error("[oad] getDossierEditFields error:", error);
    return null;
  }
}

export async function hasVouched(profileId: string, userId: string): Promise<boolean> {
  try {
    const rows = await db`
      SELECT 1 FROM directory_vouches WHERE profile_id = ${profileId} AND user_id = ${userId} LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * A user is an OAD "steward" (can verify / edit any dossier) if they own or
 * admin the collective hub org or the directory namespace org.
 */
export async function isOadSteward(userId: string): Promise<boolean> {
  try {
    const rows = await db<{ role: string }[]>`
      WITH candidate_users AS (
        SELECT ${userId}::text AS id
        UNION
        SELECT id FROM users WHERE auth_user_id = ${userId}
      )
      SELECT uo.role
      FROM user_organizations uo
      WHERE uo.user_id IN (SELECT id FROM candidate_users)
        AND uo.org_id IN ('elkdonis', ${OAD_ORG_ID})
        AND uo.role IN ('owner', 'admin')
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}
