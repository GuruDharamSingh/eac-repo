import { db } from '@elkdonis/db';

// ============================================================================
// Where an org lives.
//
// org_domains (migration 081) maps a custom domain to an org. Its primary,
// verified row IS the org's public home — whether that home is served by
// arts-collective under a custom domain or by the org's own app (amrit-canada
// on amritcanada.ca, ifac on ifacgroup.com). No separate "external_url"
// column: a verified primary domain already says it, and the same rule serves
// both cases. An org with no verified primary domain lives at its network
// subdomain, which the caller derives from the slug (see arts-collective's
// lib/org-url.ts) — this module only answers the data question.
// ============================================================================

export interface OrgHome {
  orgId: string;
  orgSlug: string;
  orgName: string;
  tier: string;
  /** Verified primary custom domain, or null when the org lives at its
   *  network subdomain. */
  primaryDomain: string | null;
}

/**
 * An organisation's OWN identity — the `users` row (entity_type='organization')
 * that migration 099 gave it. Distinct from any member's profile: the bio and
 * portrait here are the org's, which is precisely what arts-collective could
 * not express while it was reading an arbitrary member's artist_profiles row.
 *
 * `claimStatus` says which kind of org this is: 'claimed' means someone holds
 * `owner` and edits it themselves; 'unclaimed' is an associated org, staff-
 * edited and updated by suggestion after review.
 */
export interface OrgIdentity {
  orgId: string;
  orgSlug: string;
  orgName: string;
  tier: string;
  primaryDomain: string | null;
  /** Null only if the org predates migration 099 and was never linked. */
  profileUserId: string | null;
  profileSlug: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  socialLinks: Array<{ label: string | null; url: string }>;
  claimStatus: string | null;
}

export async function getOrgIdentity(orgSlug: string): Promise<OrgIdentity | null> {
  try {
    const [row] = await db<Array<{
      org_id: string;
      org_slug: string;
      org_name: string;
      tier: string;
      primary_domain: string | null;
      profile_user_id: string | null;
      profile_slug: string | null;
      headline: string | null;
      bio: string | null;
      avatar_url: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      social_links: Array<{ label: string | null; url: string }> | null;
      claim_status: string | null;
    }>>`
      SELECT
        o.id AS org_id, o.slug AS org_slug, o.name AS org_name, o.tier,
        (
          SELECT d.domain FROM org_domains d
          WHERE d.org_id = o.id AND d.is_primary AND d.verified_at IS NOT NULL
          LIMIT 1
        ) AS primary_domain,
        o.profile_user_id,
        u.slug AS profile_slug,
        u.headline, u.bio, u.avatar_url, u.city, u.region, u.country,
        u.social_links, u.claim_status
      FROM organizations o
      LEFT JOIN users u ON u.id = o.profile_user_id
      WHERE o.slug = ${orgSlug}
      LIMIT 1
    `;
    if (!row) return null;
    return {
      orgId: row.org_id,
      orgSlug: row.org_slug,
      orgName: row.org_name,
      tier: row.tier,
      primaryDomain: row.primary_domain,
      profileUserId: row.profile_user_id,
      profileSlug: row.profile_slug,
      headline: row.headline,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      city: row.city,
      region: row.region,
      country: row.country,
      socialLinks: row.social_links ?? [],
      claimStatus: row.claim_status,
    };
  } catch (err) {
    console.error(`[org-domains] getOrgIdentity(${orgSlug}):`, err);
    return null;
  }
}

/**
 * Who may edit an ORGANISATION's identity.
 *
 * `canEditProfile`'s self-or-admin rule cannot answer this: nobody logs in as
 * the org, so there is no "self". Authority comes from holding owner/guide in
 * that org, or from being a network admin — which is also what makes an
 * unclaimed (associated) org staff-only, since it has no owner to qualify.
 */
export async function canEditOrgIdentity(userId: string, orgId: string): Promise<boolean> {
  try {
    const [row] = await db<Array<{ role: string | null; is_admin: boolean }>>`
      SELECT
        (SELECT uo.role FROM user_organizations uo
          WHERE uo.user_id = ${userId} AND uo.org_id = ${orgId} LIMIT 1) AS role,
        (SELECT u.is_admin FROM users u WHERE u.id = ${userId} LIMIT 1) AS is_admin
    `;
    return row?.is_admin === true || row?.role === 'owner' || row?.role === 'guide';
  } catch (err) {
    console.error(`[org-domains] canEditOrgIdentity(${userId}, ${orgId}):`, err);
    return false;
  }
}

/** The org's verified primary custom domain, or null. */
export async function getPrimaryDomain(orgId: string): Promise<string | null> {
  try {
    const [row] = await db<Array<{ domain: string }>>`
      SELECT domain FROM org_domains
      WHERE org_id = ${orgId} AND is_primary AND verified_at IS NOT NULL
      LIMIT 1
    `;
    return row?.domain ?? null;
  } catch (err) {
    console.error(`[org-domains] getPrimaryDomain(${orgId}):`, err);
    return null;
  }
}

/**
 * Every org with its home, one query — for pages that render many org links
 * (rosters, feeds, the community org list) so they don't look each one up.
 */
export async function listOrgHomes(): Promise<OrgHome[]> {
  try {
    const rows = await db<Array<{
      org_id: string;
      org_slug: string;
      org_name: string;
      tier: string;
      primary_domain: string | null;
    }>>`
      SELECT
        o.id   AS org_id,
        o.slug AS org_slug,
        o.name AS org_name,
        o.tier,
        (
          SELECT d.domain FROM org_domains d
          WHERE d.org_id = o.id AND d.is_primary AND d.verified_at IS NOT NULL
          LIMIT 1
        ) AS primary_domain
      FROM organizations o
      ORDER BY o.name
    `;
    return rows.map((r) => ({
      orgId: r.org_id,
      orgSlug: r.org_slug,
      orgName: r.org_name,
      tier: r.tier,
      primaryDomain: r.primary_domain,
    }));
  } catch (err) {
    console.error('[org-domains] listOrgHomes:', err);
    return [];
  }
}

export async function getOrgHomeBySlug(orgSlug: string): Promise<OrgHome | null> {
  try {
    const [row] = await db<Array<{
      org_id: string;
      org_slug: string;
      org_name: string;
      tier: string;
      primary_domain: string | null;
    }>>`
      SELECT
        o.id   AS org_id,
        o.slug AS org_slug,
        o.name AS org_name,
        o.tier,
        (
          SELECT d.domain FROM org_domains d
          WHERE d.org_id = o.id AND d.is_primary AND d.verified_at IS NOT NULL
          LIMIT 1
        ) AS primary_domain
      FROM organizations o
      WHERE o.slug = ${orgSlug}
      LIMIT 1
    `;
    if (!row) return null;
    return {
      orgId: row.org_id,
      orgSlug: row.org_slug,
      orgName: row.org_name,
      tier: row.tier,
      primaryDomain: row.primary_domain,
    };
  } catch (err) {
    console.error(`[org-domains] getOrgHomeBySlug(${orgSlug}):`, err);
    return null;
  }
}
