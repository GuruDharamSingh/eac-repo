import {
  getProfileBySlug,
  listPublicProfiles,
  listProfileGeoFacets,
  hasVouched as hasVouchedFor,
  type Profile,
  type ProfileListItem,
  type EntityType,
} from "@elkdonis/services";
import { db } from "@elkdonis/db";
import type {
  DossierProfileData,
  DossierOperation,
  DossierChannel,
} from "@elkdonis/cms-bindings/dossier";

/**
 * ArtDirect / Online Artist Directory (OAD) data layer.
 *
 * Backed by users + org_profiles (migration 084/086) rather than
 * directory_profiles. Every principal has a global slug — it is the profile
 * URL and the Nextcloud folder name — so listing is gated separately on
 * users.directory_listed (migration 100). That split is what lets sentinel
 * and system accounts hold a stable slug without appearing here. A slug
 * itself may have come from signup, from opening an unclaimed file on
 * ArtDirect, or from being published on any org's own site (IFAC,
 * amrit_canada, ...). See packages/services/src/profiles.ts for the full
 * model — this is the org-agnostic global directory view of it, rendered
 * through the "Classified Artist Dossier" template via @elkdonis/cms-bindings.
 */

function bioToString(bio: string | null): string | null {
  return bio;
}

function asOperations(dossier: Record<string, unknown>, portfolio: Profile["portfolio"]): DossierOperation[] {
  const ops = dossier.operations;
  if (Array.isArray(ops) && ops.length > 0) {
    return ops
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
  // Reuse: the plain portfolio [{url,title}] becomes operations when no
  // dossier-specific operations were written.
  return portfolio
    .map((w): DossierOperation | null => (w.title ? { title: w.title, image_url: w.url || null } : null))
    .filter((o): o is DossierOperation => o !== null);
}

function asChannels(dossier: Record<string, unknown>, socialLinks: Profile["socialLinks"]): DossierChannel[] {
  const channels = dossier.financial_channels;
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
  // Reuse: a simple links list becomes funding channels when nothing
  // dossier-specific was written.
  return socialLinks.map((l) => ({ title: l.label ?? "", url: l.url }));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function contactHref(profile: Profile): string | null {
  const email = profile.socialLinks.find((l) => l.label === "Email" && l.url.startsWith("mailto:"));
  if (email) return email.url;
  const website = profile.socialLinks.find((l) => l.label === "Website");
  return website?.url ?? null;
}

function profileToDossier(profile: Profile): DossierProfileData {
  const d = profile.oadDossier;
  return {
    slug: profile.slug ?? profile.userId,
    name: profile.displayName,
    occupation: profile.headline,
    location: (d.location as string | undefined) ?? ([profile.city, profile.region].filter(Boolean).join(", ") || null),
    dossier_status: (d.dossier_status as string | undefined) ?? null,
    bio: bioToString(profile.bio),
    photo_url: profile.avatarUrl,
    operations: asOperations(d, profile.portfolio),
    current_targets: asStringArray(d.current_targets),
    projected_movements: asStringArray(d.projected_movements),
    verified_contacts: asStringArray(d.verified_contacts),
    wanted_accomplices: asStringArray(d.wanted_accomplices),
    financial_channels: asChannels(d, profile.socialLinks),
    claim_status: profile.claimStatus,
    verified: profile.verified,
    contact_href: contactHref(profile),
  };
}

export async function getDossierProfile(slug: string): Promise<DossierProfileData | null> {
  const profile = await getProfileBySlug(slug);
  return profile ? profileToDossier(profile) : null;
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
  entity_type: EntityType;
};

function toListItem(p: ProfileListItem): DossierListItem {
  return {
    slug: p.slug ?? p.userId,
    name: p.displayName,
    occupation: p.headline,
    location: (p.oadDossier.location as string | undefined) ?? null,
    region: p.region,
    country: p.country,
    portrait_url: p.avatarUrl,
    claim_status: p.claimStatus,
    verified: p.verified,
    vouch_count: p.vouchCount,
    entity_type: p.entityType,
  };
}

export async function listDossiers(
  opts: { region?: string; entityType?: EntityType; limit?: number } = {}
): Promise<DossierListItem[]> {
  const rows = await listPublicProfiles(opts);
  return rows.map(toListItem);
}

export type DirectoryFacets = { cities: string[]; regions: string[]; countries: string[] };

export async function listDirectoryFacets(): Promise<DirectoryFacets> {
  return listProfileGeoFacets();
}

/** Distinct regions with dossier counts — for hub indexes / analytics. */
export async function listRegions(): Promise<{ region: string; country: string | null; count: number }[]> {
  try {
    return await db<{ region: string; country: string | null; count: number }[]>`
      SELECT region, MAX(country) AS country, COUNT(*)::int AS count
      FROM users
      WHERE slug IS NOT NULL AND region IS NOT NULL AND region <> ''
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
    const rows = await db<{ slug: string }[]>`SELECT slug FROM users WHERE slug IS NOT NULL`;
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
  const profile = await getProfileBySlug(slug);
  if (!profile) return null;
  const [row] = await db<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM profile_vouches WHERE subject_id = ${profile.userId}
  `.catch(() => [{ n: 0 }]);
  return {
    id: profile.userId,
    slug: profile.slug ?? profile.userId,
    name: profile.displayName,
    created_by: profile.createdBy,
    claim_status: profile.claimStatus,
    claimed_by: profile.claimedBy,
    verified: profile.verified,
    vouch_count: row?.n ?? 0,
    city: profile.city,
    region: profile.region,
    country: profile.country,
  };
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
  const p = await getProfileBySlug(slug);
  if (!p) return null;

  const email = p.socialLinks.find((l) => l.label === "Email" && l.url.startsWith("mailto:"));
  const website = p.socialLinks.find((l) => l.label === "Website");
  const otherLinks = p.socialLinks.filter((l) => l !== email && l !== website);

  return {
    slug: p.slug ?? p.userId,
    name: p.displayName,
    occupation: p.headline ?? "",
    city: p.city ?? "",
    region: p.region ?? "",
    country: p.country ?? "",
    postcode: p.postalCode ?? "",
    lat: p.lat,
    lng: p.lng,
    location: (p.oadDossier.location as string | undefined) ?? "",
    bioText: p.bio ?? "",
    portrait_url: p.avatarUrl ?? "",
    website: website?.url ?? "",
    email: email ? email.url.slice("mailto:".length) : "",
    linksText: otherLinks.map((l) => `${l.label ?? ""} | ${l.url}`).join("\n"),
    source_note: p.sourceNote ?? "",
  };
}

export async function hasVouched(subjectUserId: string, voucherId: string): Promise<boolean> {
  return hasVouchedFor(subjectUserId, voucherId);
}

/**
 * A user is an OAD "steward" (can verify / edit any dossier) if they own or
 * admin the collective hub org, or are a global admin.
 */
export async function isOadSteward(userId: string): Promise<boolean> {
  try {
    const rows = await db<{ role: string }[]>`
      WITH candidate_users AS (
        SELECT ${userId}::text AS id
        UNION
        SELECT id::text FROM users WHERE auth_user_id = ${userId}
      )
      SELECT uo.role
      FROM user_organizations uo
      WHERE uo.user_id::text IN (SELECT id FROM candidate_users)
        AND uo.org_id = 'elkdonis'
        AND uo.role IN ('owner', 'admin')
      LIMIT 1
    `;
    if (rows.length > 0) return true;
    const [admin] = await db<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`;
    return admin?.is_admin ?? false;
  } catch {
    return false;
  }
}
