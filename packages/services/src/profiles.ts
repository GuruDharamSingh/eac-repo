import { db } from '@elkdonis/db';
import { slugify, isReservedSlug } from '@elkdonis/utils';

// ============================================================================
// Profiles — one person, one identity, published on any number of orgs.
//
// Migration 084 merged three competing tables (artist_profiles,
// directory_profiles, and users itself) into two:
//
//   users        — the person. Global identity: bio, photo, links, slug.
//                  Exists whether or not they've ever logged in — an
//                  unclaimed directory entry is a `users` row with
//                  claim_status='unclaimed' and a self-referential
//                  auth_user_id (the sentinel-user pattern from migration
//                  077/pigeonshoot), not a second table.
//   org_profiles — how ONE org presents that person: role_title, is_public,
//                  sort_order. A person gets one row per org they're
//                  published on — this is what artist_profiles' PRIMARY KEY
//                  (user_id) couldn't do (one org's page, ever, globally).
//
// Authorship rule this module enforces everywhere: the artist can always
// edit their own identity (bio, photo, links, portfolio, slug) — that's
// canEditProfile. An org can only control whether that person is published
// on ITS site and under what title — that's canPublishOrgProfile. Neither
// substitutes for the other.
//
// artist_profiles / directory_profiles still exist and are still read by
// hidden-enneagram, inner-gathering, arts-collective and ifac directly —
// this module is the target those call sites migrate onto, not yet a
// replacement for their current queries.
// ============================================================================

export interface SocialLink {
  label: string | null;
  url: string;
}

export interface PortfolioItem {
  url: string;
  title: string;
  /** Stable id for grid layout purposes (react-grid-layout's `i`). Generated
   *  client-side on upload; absent on older rows, which fall back to `url`. */
  id?: string;
  /** Grid position/size (react-grid-layout units — 12-column grid, row height
   *  in px). Absent until the owner has actually rearranged the gallery once;
   *  the gallery component auto-places anything missing these. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /**
   * When the picture IS one of the person's artworks (an `artwork` row), its
   * id. `url`/`title` then hold a snapshot for components that know nothing
   * of artworks; a site that does reads the record for the live title and
   * sale status. Added with migration 146.
   */
  artworkId?: string;
  /** A second line under the title — shown on hover and in the slideshow. */
  subtitle?: string;
  /**
   * Another of the owner's galleries (its id, user_galleries.id) that this picture OPENS: in the
   * full-size view a visitor can go into that gallery instead of stepping on
   * through this one. Galleries nest by pointer — any depth, no tree table;
   * a site that shows it guards against loops. Absent = an ordinary picture.
   */
  opens?: string;
  /**
   * How the picture sits inside its tile: the focal point (0–100 %, as CSS
   * object-position) and a zoom (1 = fill the tile, up to 4). Absent = centred,
   * no zoom — how every picture has always been shown.
   */
  fx?: number;
  fy?: number;
  zoom?: number;
  /**
   * A layout the owner saved to come back to ("my layout"), separate from
   * the one on show — so trying Reset or Randomize never loses it.
   */
  saved?: { x: number; y: number; w: number; h: number };
}

export type ClaimStatus = 'unclaimed' | 'pending' | 'claimed';

/**
 * 'organization' lets a `users` row represent an external business (a
 * gallery, a curator collective, an auction house) instead of a person —
 * same sentinel/unclaimed pattern, same org_profiles publish mechanism, just
 * a different kind of subject. See migration 092.
 */
export type EntityType = 'person' | 'organization';

export interface Profile {
  userId: string;
  entityType: EntityType;
  /** 'standard' = the React page; any other value names a template directory. */
  profileLayout: string;
  slug: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  socialLinks: SocialLink[];
  portfolioUrl: string | null;
  portfolio: PortfolioItem[];
  claimStatus: ClaimStatus;
  claimedBy: string | null;
  createdBy: string | null;
  verified: boolean;
  directoryListed: boolean;
  /** Wiki-style attribution note — who/what sourced this entry, for account-less profiles. */
  sourceNote: string | null;
  /** Template-specific display extras (e.g. ArtDirect's "Classified Dossier"). Opaque to shared code. */
  oadDossier: Record<string, unknown>;
  /**
   * Optional profile sections this person has switched on (migration 105).
   *
   * Read here rather than through a per-key `hasProfileSection` call so a page
   * that renders five optional sections makes one query instead of five. The
   * keys are whatever the rendering surface asks for — 'store' is shared with
   * every org site, and the dossier template adds its own.
   */
  profileSections: Record<string, boolean>;
}

export interface OrgProfile extends Profile {
  orgId: string;
  roleTitle: string | null;
  sortOrder: number;
  isPublic: boolean;
  /** Org-defined labels — IFAC uses these to split artists from dealers. */
  tags: string[];
}

interface UserRow {
  id: string;
  entity_type: EntityType;
  profile_layout: string;
  slug: string | null;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  social_links: unknown;
  portfolio_url: string | null;
  portfolio: unknown;
  claim_status: ClaimStatus;
  claimed_by: string | null;
  created_by: string | null;
  verified: boolean;
  directory_listed: boolean;
  source_note: string | null;
  oad_dossier: unknown;
  profile_sections?: unknown;
}

interface OrgProfileRow extends UserRow {
  org_id: string;
  role_title: string | null;
  sort_order: number;
  is_public: boolean;
  tags: string[] | null;
}

function asSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((l) =>
      l && typeof l === 'object' && 'url' in l
        ? { label: (l as { label?: unknown }).label != null ? String((l as { label: unknown }).label) : null, url: String((l as { url: unknown }).url) }
        : null
    )
    .filter((l): l is SocialLink => l !== null);
}

function asPortfolio(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((w): PortfolioItem | null => {
      if (!w || typeof w !== 'object' || !('url' in w)) return null;
      const r = w as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      return {
        url: String(r.url),
        title: String(r.title ?? ''),
        id: typeof r.id === 'string' ? r.id : undefined,
        x: num(r.x),
        y: num(r.y),
        w: num(r.w),
        h: num(r.h),
      };
    })
    .filter((w): w is PortfolioItem => w !== null);
}

/**
 * Marks a value for jsonb serialization via postgres.js's `.json()`, so it's
 * sent as real JSON rather than double-encoded as a JSON *string* (which is
 * what happens if a jsonb column is fed a plain `JSON.stringify(...)` value
 * through a tagged-template placeholder — it typechecks and doesn't error,
 * it just silently stores the text as a JSON string scalar instead of the
 * array/object it looks like).
 *
 * A raw `db.json(value)` call doesn't typecheck for SocialLink[]/PortfolioItem[]
 * etc.: postgres.js's JSONValue type requires an index signature, and a
 * plain named interface never structurally satisfies one even when every
 * property value is JSON-safe. The cast here is that known-safe bridge,
 * confirmed against real writes/reads — not a widening of what's accepted.
 */
function jsonb(value: unknown): ReturnType<typeof db.json> {
  return db.json(value as Parameters<typeof db.json>[0]);
}

function asDossier(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * `profile_sections` as booleans.
 *
 * Coerced rather than trusted: the column is JSONB written by several apps'
 * server actions, and a key that arrives as the string "true" or as 1 must not
 * read as off — nor must an arbitrary truthy object read as on.
 */
function asSectionFlags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = v === true || v === 'true' || v === 1;
  }
  return out;
}

function mapUser(row: UserRow): Profile {
  return {
    userId: row.id,
    entityType: row.entity_type,
    profileLayout: row.profile_layout ?? 'dossier',
    slug: row.slug,
    displayName: row.display_name ?? 'Member',
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    pronouns: row.pronouns,
    city: row.city,
    region: row.region,
    country: row.country,
    postalCode: row.postal_code,
    lat: row.lat,
    lng: row.lng,
    socialLinks: asSocialLinks(row.social_links),
    portfolioUrl: row.portfolio_url,
    portfolio: asPortfolio(row.portfolio),
    claimStatus: row.claim_status,
    claimedBy: row.claimed_by,
    createdBy: row.created_by,
    verified: row.verified,
    directoryListed: row.directory_listed ?? true,
    sourceNote: row.source_note,
    oadDossier: asDossier(row.oad_dossier),
    profileSections: asSectionFlags(row.profile_sections),
  };
}

function mapOrgProfile(row: OrgProfileRow): OrgProfile {
  return {
    ...mapUser(row),
    orgId: row.org_id,
    roleTitle: row.role_title,
    sortOrder: row.sort_order,
    isPublic: row.is_public,
    tags: row.tags ?? [],
  };
}

const USER_COLS = `id, entity_type, slug, display_name, headline, bio, avatar_url, pronouns, city, region, country, postal_code, lat, lng, social_links, portfolio_url, portfolio, claim_status, claimed_by, created_by, verified, directory_listed, source_note, oad_dossier, profile_sections, profile_layout`;
const ORG_PROFILE_COLS = `u.id, u.entity_type, u.slug, u.display_name, u.headline, u.bio, u.avatar_url, u.pronouns, u.city, u.region, u.country, u.postal_code, u.lat, u.lng, u.social_links, u.portfolio_url, u.portfolio, u.claim_status, u.claimed_by, u.created_by, u.verified, u.directory_listed, u.source_note, u.oad_dossier, u.profile_sections, u.profile_layout, op.org_id, op.role_title, op.sort_order, op.is_public, op.tags`;

/** A person's global identity, independent of any org. */
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const rows = await db<UserRow[]>`SELECT ${db.unsafe(USER_COLS)} FROM users WHERE id = ${userId} LIMIT 1`;
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    console.error(`[profiles] getProfile(${userId}):`, err);
    return null;
  }
}

/** Resolve a person by their global ArtDirect-style slug. */
export async function getProfileBySlug(slug: string): Promise<Profile | null> {
  try {
    const rows = await db<UserRow[]>`SELECT ${db.unsafe(USER_COLS)} FROM users WHERE slug = ${slug} LIMIT 1`;
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    console.error(`[profiles] getProfileBySlug(${slug}):`, err);
    return null;
  }
}

/** One org's roster. Mirrors amrit-canada's getGuides / ifac's listDirectory. */
export async function listOrgProfiles(
  orgId: string,
  opts: { onlyPublic?: boolean; tags?: string[] } = {}
): Promise<OrgProfile[]> {
  const onlyPublic = opts.onlyPublic ?? true;
  const tags = opts.tags?.length ? opts.tags : null;
  try {
    const rows = await db<OrgProfileRow[]>`
      SELECT ${db.unsafe(ORG_PROFILE_COLS)}
      FROM org_profiles op JOIN users u ON u.id = op.user_id
      WHERE op.org_id = ${orgId}
        ${onlyPublic ? db`AND op.is_public` : db``}
        ${tags ? db`AND op.tags @> ${tags}` : db``}
      ORDER BY op.sort_order, u.display_name
    `;
    return rows.map(mapOrgProfile);
  } catch (err) {
    console.error(`[profiles] listOrgProfiles(${orgId}):`, err);
    return [];
  }
}

export async function getOrgProfileBySlug(
  orgId: string,
  slug: string,
  options: { includePrivate?: boolean } = {}
): Promise<OrgProfile | null> {
  try {
    // `includePrivate` lets a caller tell "this org has no such profile" apart
    // from "it has one and has chosen not to publish it" — the returned row
    // carries `isPublic` for that. Default false, so every existing caller
    // keeps the published-only behaviour it was written against.
    //
    // Why the distinction is worth a parameter: a site that falls back to
    // bundled static content when this returns null cannot honour an
    // unpublished row without it. IFAC did exactly that, and unlisting one of
    // the thirteen artists who are also hardcoded in its artists.ts left their
    // page live — the admin had pressed the button and nothing had happened.
    const rows = options.includePrivate
      ? await db<OrgProfileRow[]>`
          SELECT ${db.unsafe(ORG_PROFILE_COLS)}
          FROM org_profiles op JOIN users u ON u.id = op.user_id
          WHERE op.org_id = ${orgId} AND u.slug = ${slug}
          LIMIT 1
        `
      : await db<OrgProfileRow[]>`
          SELECT ${db.unsafe(ORG_PROFILE_COLS)}
          FROM org_profiles op JOIN users u ON u.id = op.user_id
          WHERE op.org_id = ${orgId} AND op.is_public AND u.slug = ${slug}
          LIMIT 1
        `;
    return rows[0] ? mapOrgProfile(rows[0]) : null;
  } catch (err) {
    console.error(`[profiles] getOrgProfileBySlug(${orgId}, ${slug}):`, err);
    return null;
  }
}

/** Every org a person is published (or draft-published) on. */
/** An org this person is published on, with enough to render a link. */
export interface ProfileOrgMembership extends OrgProfile {
  orgName: string;
  orgSlug: string;
}

/**
 * Every org this person appears on.
 *
 * Joins organizations because the only reason to ask this question is to show
 * or link the orgs — returning bare ids would make every caller do the join
 * again. `onlyPublic` matters for directory surfaces: a member signup drafts
 * an org_profile for every org someone joins, so an unfiltered list would
 * expose orgs that have not chosen to publish them.
 */
export async function listProfileOrgs(
  userId: string,
  opts: { onlyPublic?: boolean } = {}
): Promise<ProfileOrgMembership[]> {
  try {
    const rows = await db<Array<OrgProfileRow & { org_name: string; org_slug: string }>>`
      SELECT ${db.unsafe(ORG_PROFILE_COLS)}, o.name AS org_name, o.slug AS org_slug
      FROM org_profiles op
      JOIN users u ON u.id = op.user_id
      JOIN organizations o ON o.id = op.org_id
      WHERE op.user_id = ${userId}
        ${opts.onlyPublic ? db`AND op.is_public` : db``}
      ORDER BY o.name
    `;
    return rows.map((r) => ({
      ...mapOrgProfile(r),
      orgName: r.org_name,
      orgSlug: r.org_slug,
    }));
  } catch (err) {
    console.error(`[profiles] listProfileOrgs(${userId}):`, err);
    return [];
  }
}

/**
 * Every org_profiles row for one entity_type, across every org — the read
 * model for a network-wide console managing profiles by kind (e.g.
 * arts-collective's associated-organizations admin) rather than one org's
 * own roster. Same join as listProfileOrgs, scoped by entity_type instead
 * of by one user.
 */
export async function listOrgProfilesByEntityType(
  entityType: EntityType,
  opts: { onlyPublic?: boolean } = {}
): Promise<ProfileOrgMembership[]> {
  try {
    const rows = await db<Array<OrgProfileRow & { org_name: string; org_slug: string }>>`
      SELECT ${db.unsafe(ORG_PROFILE_COLS)}, o.name AS org_name, o.slug AS org_slug
      FROM org_profiles op
      JOIN users u ON u.id = op.user_id
      JOIN organizations o ON o.id = op.org_id
      WHERE u.entity_type = ${entityType}
        ${opts.onlyPublic ? db`AND op.is_public` : db``}
      ORDER BY o.name, u.display_name
    `;
    return rows.map((r) => ({
      ...mapOrgProfile(r),
      orgName: r.org_name,
      orgSlug: r.org_slug,
    }));
  } catch (err) {
    console.error(`[profiles] listOrgProfilesByEntityType(${entityType}):`, err);
    return [];
  }
}

/**
 * Removes an org's publish row for this profile. If this was an unclaimed
 * sentinel's last org, the users row goes with it too — nothing else can
 * ever reach it once it has no org_profiles row and no owner.
 */
export async function unpublishOrgProfile(orgId: string, userId: string): Promise<boolean> {
  const deleted = await db`
    DELETE FROM org_profiles WHERE org_id = ${orgId} AND user_id = ${userId}
    RETURNING user_id
  `;
  if (deleted.length === 0) return false;

  await db`
    DELETE FROM users
    WHERE id = ${userId} AND claim_status = 'unclaimed'
      AND NOT EXISTS (SELECT 1 FROM org_profiles WHERE user_id = ${userId})
  `;
  return true;
}

export async function canEditProfile(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true;
  try {
    const rows = await db<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${viewerId} LIMIT 1`;
    return rows[0]?.is_admin ?? false;
  } catch (err) {
    console.error(`[profiles] canEditProfile(${viewerId}, ${targetUserId}):`, err);
    return false;
  }
}

/**
 * Publish control (is_public, role_title, sort_order) on ONE org's page.
 * The subject may always toggle their own — self-publishing is authorship,
 * not moderation — otherwise it's owner/guide of that org, or a global admin.
 */
export async function canPublishOrgProfile(viewerId: string, orgId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true;
  try {
    const [row] = await db<{ role: string | null; is_admin: boolean }[]>`
      SELECT
        (SELECT role FROM user_organizations WHERE user_id = ${viewerId} AND org_id = ${orgId} LIMIT 1) AS role,
        (SELECT is_admin FROM users WHERE id = ${viewerId} LIMIT 1) AS is_admin
    `;
    return row?.is_admin === true || row?.role === 'owner' || row?.role === 'guide';
  } catch (err) {
    console.error(`[profiles] canPublishOrgProfile(${viewerId}, ${orgId}, ${targetUserId}):`, err);
    return false;
  }
}

/**
 * A slug derived from `base` no other user holds — mirrors ensureUniqueThreadSlug.
 *
 * A reserved word (a route or a network subdomain — see RESERVED_SLUGS) is
 * treated as already taken, so "hub" becomes "hub-2" rather than shadowing
 * the /hub route on ArtDirect's root catch-all.
 */
export async function ensureUniqueUserSlug(base: string, excludeUserId?: string): Promise<string> {
  const root = slugify(base) || 'member';
  let candidate = root;
  let n = 1;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (isReservedSlug(candidate)) {
      n += 1;
      candidate = `${root}-${n}`;
      continue;
    }
    const rows = excludeUserId
      ? await db<Array<{ id: string }>>`SELECT id FROM users WHERE slug = ${candidate} AND id <> ${excludeUserId} LIMIT 1`
      : await db<Array<{ id: string }>>`SELECT id FROM users WHERE slug = ${candidate} LIMIT 1`;

    if (!rows[0]) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }

  return `${root}-${Date.now()}`;
}

export interface UpdateProfileInput {
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  pronouns?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  socialLinks?: SocialLink[];
  portfolioUrl?: string | null;
  portfolio?: PortfolioItem[];
  slug?: string | null;
  oadDossier?: Record<string, unknown>;
  sourceNote?: string | null;
}

/** Self-editable identity fields. Caller must have checked canEditProfile. */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
  const sets: Record<string, unknown> = {};
  if (input.displayName !== undefined) sets.display_name = input.displayName;
  if (input.headline !== undefined) sets.headline = input.headline;
  if (input.bio !== undefined) sets.bio = input.bio;
  if (input.avatarUrl !== undefined) sets.avatar_url = input.avatarUrl;
  if (input.pronouns !== undefined) sets.pronouns = input.pronouns;
  if (input.city !== undefined) sets.city = input.city;
  if (input.region !== undefined) sets.region = input.region;
  if (input.country !== undefined) sets.country = input.country;
  if (input.postalCode !== undefined) sets.postal_code = input.postalCode;
  if (input.lat !== undefined) sets.lat = input.lat;
  if (input.lng !== undefined) sets.lng = input.lng;
  if (input.socialLinks !== undefined) sets.social_links = jsonb(input.socialLinks);
  if (input.portfolioUrl !== undefined) sets.portfolio_url = input.portfolioUrl;
  if (input.oadDossier !== undefined) sets.oad_dossier = jsonb(input.oadDossier);
  if (input.sourceNote !== undefined) sets.source_note = input.sourceNote;
  if (input.portfolio !== undefined) sets.portfolio = jsonb(input.portfolio);
  if (input.slug !== undefined) {
    if (input.slug === null) {
      sets.slug = null;
    } else {
      // Never write a slug raw: this is a person's URL on ArtDirect and, since
      // the network's subdomains share the namespace, potentially a hostname.
      // Callers wanting a guaranteed-free slug run ensureUniqueUserSlug first;
      // this is the floor beneath them.
      const normalized = slugify(input.slug);
      if (!normalized) throw new Error('invalid_slug');
      if (isReservedSlug(normalized)) throw new Error('reserved_slug');
      sets.slug = normalized;
    }
  }

  if (Object.keys(sets).length === 0) return;
  await db`UPDATE users SET ${db(sets)}, updated_at = NOW() WHERE id = ${userId}`;
}

export interface CreateUnclaimedProfileInput {
  displayName: string;
  /** Derived from displayName if omitted. */
  slug?: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  socialLinks?: SocialLink[];
  sourceNote?: string | null;
  oadDossier?: Record<string, unknown>;
  createdBy?: string | null;
  entityType?: EntityType;
  /** 'standard' = the plain React page. Defaults to 'dossier' (the DB
   *  default, written for people) — callers creating an organization
   *  profile should pass 'standard' explicitly. */
  profileLayout?: string;
}

/**
 * Opens a new claimable profile for someone with no account yet — "open a
 * file on an artist you know" (ArtDirect), or an org roster seeded from a
 * static/legacy source (IFAC). A sentinel: self-referential auth_user_id
 * (never logs in — see migration 084), claim_status='unclaimed' until a
 * real account claims it via requestClaim/approveClaim.
 */
export type CreateProfileResult = { ok: true; userId: string; slug: string } | { ok: false; error: string };

export async function createUnclaimedProfile(
  input: CreateUnclaimedProfileInput
): Promise<CreateProfileResult> {
  const slug = await ensureUniqueUserSlug(input.slug || input.displayName);
  const newId = crypto.randomUUID();
  try {
    await db`
      INSERT INTO users (
        id, auth_user_id, display_name, headline, bio, avatar_url,
        city, region, country, postal_code, lat, lng, social_links,
        slug, source_note, oad_dossier, created_by, claim_status,
        entity_type, profile_layout
      ) VALUES (
        ${newId}, ${newId}, ${input.displayName}, ${input.headline ?? null}, ${input.bio ?? null}, ${input.avatarUrl ?? null},
        ${input.city ?? null}, ${input.region ?? null}, ${input.country ?? null},
        ${input.postalCode ?? null}, ${input.lat ?? null}, ${input.lng ?? null}, ${jsonb(input.socialLinks ?? [])},
        ${slug}, ${input.sourceNote ?? null}, ${jsonb(input.oadDossier ?? {})}, ${input.createdBy ?? null}, 'unclaimed',
        ${input.entityType ?? 'person'}, ${input.profileLayout ?? 'dossier'}
      )
    `;
    return { ok: true, userId: newId, slug };
  } catch (err) {
    console.error('[profiles] createUnclaimedProfile:', err);
    return { ok: false, error: 'Could not create the profile.' };
  }
}

export interface UpsertOrgProfileInput {
  roleTitle?: string | null;
  sortOrder?: number;
  isPublic?: boolean;
  /** Org-defined labels (e.g. IFAC's artist/dealer split). Omit to leave
   *  existing tags untouched on an update. */
  tags?: string[];
}

/** Org-scoped publish control. Caller must have checked canPublishOrgProfile. */
export async function upsertOrgProfile(orgId: string, userId: string, input: UpsertOrgProfileInput): Promise<void> {
  await db`
    INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public, tags)
    VALUES (${orgId}, ${userId}, ${input.roleTitle ?? null}, ${input.sortOrder ?? 0}, ${input.isPublic ?? false}, ${db.array(input.tags ?? [])})
    ON CONFLICT (org_id, user_id) DO UPDATE SET
      role_title = COALESCE(${input.roleTitle ?? null}, org_profiles.role_title),
      sort_order = ${input.sortOrder ?? 0},
      is_public  = ${input.isPublic ?? false},
      tags       = ${input.tags !== undefined ? db.array(input.tags) : db`org_profiles.tags`}
  `;
}

// ---------------------------------------------------------------------------
// Claim flow — for sentinel (claim_status='unclaimed') rows opened by a
// community member for someone who doesn't have an account yet.
// ---------------------------------------------------------------------------

/** A real, signed-in user asserts they are the person behind `sentinelUserId`. */
export async function requestClaim(sentinelUserId: string, claimantUserId: string): Promise<{ ok: boolean; error?: string }> {
  const [sentinel] = await db<{ claim_status: ClaimStatus }[]>`
    SELECT claim_status FROM users WHERE id = ${sentinelUserId} LIMIT 1
  `;
  if (!sentinel) return { ok: false, error: 'Profile not found.' };
  if (sentinel.claim_status === 'claimed') return { ok: false, error: 'This profile is already claimed.' };

  await db`UPDATE users SET claim_status = 'pending', claimed_by = ${claimantUserId} WHERE id = ${sentinelUserId}`;
  return { ok: true };
}

/**
 * Folds a sentinel (unclaimed/pending) profile into the real account that
 * claimed it. A sentinel can never log in (self-referential auth_user_id —
 * see migration 084), so a claim always means "this is the same person as
 * an existing account," never "activate this row" — the merge, not a status
 * flip, is the operation.
 *
 * Identity fields fill in only where the target's are still empty, so a
 * claim can never overwrite something the real person already wrote
 * themself. org_profiles publishing moves over per-org (skipped where the
 * target already has a row for that org — their own edits win). Threads,
 * media, and other identity pointers are repointed before the sentinel row
 * is deleted, so nothing is left dangling; day-to-day engagement rows
 * (reactions, RSVPs, poll votes, etc.) are left to cascade-delete, since a
 * sentinel — never having had a session — cannot genuinely hold any.
 */

/**
 * Tables whose rows would be destroyed, not moved, by the DELETE at the end of
 * mergeProfile — every one has a user_id FK with ON DELETE CASCADE.
 *
 * mergeProfile carries org_profiles, org_intake and user_organizations, and
 * reassigns threads.author_id / media.uploaded_by. Everything below is simply
 * lost. That is harmless for a sentinel (it has never logged in, so all of
 * these are empty — verified 0 rows across every unclaimed profile on
 * 2026-09-07), but adminAssignProfile also merges two REAL accounts, and there
 * the loss would be silent and unrecoverable — including
 * `org_agreement_acceptances`, which is the consent record the payout model
 * depends on.
 *
 * Rather than move seventeen tables with seventeen different unique
 * constraints and semantics, the merge refuses when any of them is non-empty.
 * A loud failure that names the tables is recoverable; silent deletion is not.
 */
const UNCARRIED_ON_MERGE = [
  'thread_rsvps', 'org_agreement_acceptances', 'org_followers',
  'content_drafts', 'questionnaire_responses', 'question_poll_votes',
  'availability_poll_responses', 'artwork_favorite', 'bookmarks', 'watches',
  'reactions', 'notifications', 'conversation_participant',
  'thread_cycle_events', 'artist_profiles',
] as const;

/** Tables where `sentinelUserId` still holds rows the merge cannot carry. */
async function uncarriedRows(sentinelUserId: string): Promise<string[]> {
  const found: string[] = [];
  for (const table of UNCARRIED_ON_MERGE) {
    try {
      const [row] = await db<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM ${db.unsafe(table)} WHERE user_id = ${sentinelUserId}
      `;
      if ((row?.n ?? 0) > 0) found.push(`${table} (${row.n})`);
    } catch {
      // Table absent in this deployment — not a reason to block a merge.
    }
  }
  return found;
}

/**
 * Orgs where BOTH people already run a storefront.
 *
 * A store is unique per (org_id, owner_user_id), so the sentinel's cannot
 * simply be repointed at someone who already has one there — and the two hold
 * different inventory, payout settings and commission rates, which is a human
 * decision, not something a merge may guess at. Checked before anything is
 * written so the refusal costs nothing.
 */
async function storeOwnershipClashes(sentinelUserId: string, targetUserId: string): Promise<string[]> {
  try {
    const rows = await db<{ org_id: string }[]>`
      SELECT s.org_id FROM store s
      WHERE s.owner_user_id = ${sentinelUserId}
        AND EXISTS (
          SELECT 1 FROM store t
          WHERE t.org_id = s.org_id AND t.owner_user_id = ${targetUserId}
        )
    `;
    return rows.map((r) => r.org_id);
  } catch {
    // No store table in this deployment — not a reason to block a merge.
    return [];
  }
}

export async function mergeProfile(sentinelUserId: string, targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  if (sentinelUserId === targetUserId) return { ok: false, error: 'Cannot merge a profile into itself.' };

  const [sentinel] = await db<{ id: string; slug: string | null }[]>`SELECT id, slug FROM users WHERE id = ${sentinelUserId} LIMIT 1`;
  const [target] = await db<{ id: string }[]>`SELECT id FROM users WHERE id = ${targetUserId} LIMIT 1`;
  if (!sentinel) return { ok: false, error: 'Profile not found.' };
  if (!target) return { ok: false, error: 'Target account not found.' };

  const clashingStores = await storeOwnershipClashes(sentinelUserId, targetUserId);
  if (clashingStores.length > 0) {
    return {
      ok: false,
      error:
        `Both accounts already run a store in ${clashingStores.join(', ')}. ` +
        `Decide which one keeps the inventory and close the other first — a ` +
        `merge cannot choose between two storefronts.`,
    };
  }

  const stranded = await uncarriedRows(sentinelUserId);
  if (stranded.length > 0) {
    return {
      ok: false,
      error:
        `This profile still holds rows the merge cannot move, and they would be ` +
        `deleted: ${stranded.join(', ')}. Move or clear them first.`,
    };
  }

  // Free the sentinel's slug first — slug is globally unique, so if the
  // target is about to claim it below, the sentinel can't be still holding
  // it at the same instant. Captured above, before it's cleared here.
  await db`UPDATE users SET slug = NULL WHERE id = ${sentinelUserId}`;

  await db`
    UPDATE users u SET
      slug          = COALESCE(u.slug, ${sentinel.slug}),
      bio           = COALESCE(u.bio, s.bio),
      avatar_url    = COALESCE(u.avatar_url, s.avatar_url),
      pronouns      = COALESCE(u.pronouns, s.pronouns),
      city          = COALESCE(u.city, s.city),
      region        = COALESCE(u.region, s.region),
      country       = COALESCE(u.country, s.country),
      social_links  = CASE WHEN u.social_links = '[]'::jsonb THEN s.social_links ELSE u.social_links END,
      portfolio_url = COALESCE(u.portfolio_url, s.portfolio_url),
      portfolio     = CASE WHEN u.portfolio = '[]'::jsonb THEN s.portfolio ELSE u.portfolio END,
      oad_dossier   = CASE WHEN u.oad_dossier = '{}'::jsonb THEN s.oad_dossier ELSE u.oad_dossier END,
      verified      = u.verified OR s.verified,
      updated_at    = NOW()
    FROM users s
    WHERE u.id = ${targetUserId} AND s.id = ${sentinelUserId}
  `;

  await db`
    INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public, tags)
    SELECT org_id, ${targetUserId}, role_title, sort_order, is_public, tags
    FROM org_profiles WHERE user_id = ${sentinelUserId}
    ON CONFLICT (org_id, user_id) DO NOTHING
  `;
  await db`
    INSERT INTO org_intake (org_id, user_id, answers)
    SELECT org_id, ${targetUserId}, answers FROM org_intake WHERE user_id = ${sentinelUserId}
    ON CONFLICT (org_id, user_id) DO NOTHING
  `;
  // Memberships and roles, kept at the STRONGER of the two.
  //
  // Without this the sentinel's `user_organizations` rows were destroyed rather
  // than moved: the DELETE below cascades (user_organizations_user_id_fkey is
  // ON DELETE CASCADE), so anyone who claimed a profile silently lost every org
  // role that profile held. An org whose only owner was an unclaimed sentinel
  // became unadministrable the moment that person signed up.
  await db`
    INSERT INTO user_organizations (user_id, org_id, role)
    SELECT ${targetUserId}, org_id, role
    FROM user_organizations WHERE user_id = ${sentinelUserId}
    ON CONFLICT (user_id, org_id) DO UPDATE
      SET role = CASE
        WHEN 'owner'  IN (user_organizations.role, EXCLUDED.role) THEN 'owner'
        WHEN 'guide'  IN (user_organizations.role, EXCLUDED.role) THEN 'guide'
        WHEN 'member' IN (user_organizations.role, EXCLUDED.role) THEN 'member'
        ELSE 'viewer'
      END
  `;
  await db`DELETE FROM user_organizations WHERE user_id = ${sentinelUserId}`;
  await db`DELETE FROM org_profiles WHERE user_id = ${sentinelUserId}`;
  await db`DELETE FROM org_intake WHERE user_id = ${sentinelUserId}`;

  await db`UPDATE threads SET author_id = ${targetUserId} WHERE author_id = ${sentinelUserId}`;
  await db`UPDATE media SET uploaded_by = ${targetUserId} WHERE uploaded_by = ${sentinelUserId}`;

  // A person's storefront and the work in it follow them into their real
  // account — the same principle as threads and media above, and the reason
  // the identity fields are COALESCEd rather than overwritten: what the
  // person made is theirs.
  //
  // Not optional: `store.owner_user_id` is ON DELETE CASCADE, so leaving it
  // pointed at the sentinel means the DELETE below takes the store and every
  // artwork in it. In practice it aborted instead — `artwork.artist_user_id`
  // is NO ACTION, so the delete raised a bare foreign-key violation and the
  // guide who clicked "this is so-and-so" saw a Postgres error with no
  // explanation (found 2026-09-20 on IFAC, whose owner Eric Brummel is an
  // unclaimed sentinel holding a store of six works).
  await db`UPDATE store SET owner_user_id = ${targetUserId} WHERE owner_user_id = ${sentinelUserId}`.catch(
    (err: unknown) => {
      console.error(`[profiles] mergeProfile store carry (${sentinelUserId}):`, err);
      throw err;
    }
  );
  await db`UPDATE artwork SET artist_user_id = ${targetUserId} WHERE artist_user_id = ${sentinelUserId}`.catch(
    (err: unknown) => {
      console.error(`[profiles] mergeProfile artwork carry (${sentinelUserId}):`, err);
      throw err;
    }
  );
  // Standing in someone ELSE's store — an org's storefront they help run —
  // moves too. It was on the refusal list above, which meant a roster entry
  // that had been made an owner of its org's store could never be claimed at
  // all: the merge refused, naming a table nobody could act on. The primary
  // key is (store_id, user_id), so a target who already stands in that store
  // keeps the standing they have.
  await db`
    INSERT INTO store_member (store_id, user_id, role, added_by)
    SELECT store_id, ${targetUserId}, role, added_by
    FROM store_member WHERE user_id = ${sentinelUserId}
    ON CONFLICT (store_id, user_id) DO NOTHING
  `;
  await db`DELETE FROM store_member WHERE user_id = ${sentinelUserId}`;
  await db`UPDATE users SET claimed_by = ${targetUserId} WHERE claimed_by = ${sentinelUserId}`;
  await db`UPDATE users SET created_by = ${targetUserId} WHERE created_by = ${sentinelUserId}`;

  await db`DELETE FROM users WHERE id = ${sentinelUserId}`;
  return { ok: true };
}

/** A steward (global admin) approves a pending claim — merges the sentinel into the claimant's account. */
export async function approveClaim(sentinelUserId: string, approverId: string): Promise<{ ok: boolean; error?: string }> {
  const [approver] = await db<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${approverId} LIMIT 1`;
  if (!approver?.is_admin) return { ok: false, error: 'Not authorized to approve claims.' };

  const [sentinel] = await db<{ claim_status: ClaimStatus; claimed_by: string | null }[]>`
    SELECT claim_status, claimed_by FROM users WHERE id = ${sentinelUserId} LIMIT 1
  `;
  if (!sentinel || sentinel.claim_status !== 'pending' || !sentinel.claimed_by) {
    return { ok: false, error: 'No pending claim on this profile.' };
  }

  return mergeProfile(sentinelUserId, sentinel.claimed_by);
}

/**
 * A steward directly confirms `targetUserId` is the person behind
 * `sentinelUserId` — the admin-initiated counterpart to
 * requestClaim/approveClaim, for when the org already knows who someone is
 * and the person hasn't (or can't) click "claim" themself. Skips the
 * pending-request step entirely; same merge either way.
 *
 * Caller must have already checked authorization — same trust convention as
 * upsertOrgProfile. What "authorized" means is app-specific (an org's own
 * owner/guide gate, e.g. IFAC's canManageIfac), so it isn't baked in here.
 */
export async function adminAssignProfile(sentinelUserId: string, targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  const [sentinel] = await db<{ claim_status: ClaimStatus }[]>`
    SELECT claim_status FROM users WHERE id = ${sentinelUserId} LIMIT 1
  `;
  if (!sentinel) return { ok: false, error: 'Profile not found.' };
  if (sentinel.claim_status === 'claimed') return { ok: false, error: 'This profile is already claimed.' };

  return mergeProfile(sentinelUserId, targetUserId);
}

// ---------------------------------------------------------------------------
// Global directory — anyone with a slug is publicly reachable somewhere
// (self-published via /account, published by an org, or opened as an
// unclaimed dossier). ArtDirect renders this list; "having a slug" is the
// one signal it needs, rather than a second is-listed flag to keep in sync.
// ---------------------------------------------------------------------------

export interface ProfileListItem extends Profile {
  vouchCount: number;
}

export async function listPublicProfiles(
  opts: { region?: string; entityType?: EntityType; limit?: number } = {}
): Promise<ProfileListItem[]> {
  const limit = opts.limit ?? 60;
  try {
    const rows = await db<Array<UserRow & { vouch_count: number }>>`
      SELECT ${db.unsafe(USER_COLS)}, COALESCE(v.n, 0)::int AS vouch_count
      FROM users u
      LEFT JOIN (SELECT subject_id, COUNT(*) AS n FROM profile_vouches GROUP BY subject_id) v ON v.subject_id = u.id
      WHERE u.slug IS NOT NULL
        AND u.directory_listed
        ${opts.region ? db`AND u.region = ${opts.region}` : db``}
        ${opts.entityType ? db`AND u.entity_type = ${opts.entityType}` : db``}
      ORDER BY u.verified DESC, vouch_count DESC, u.display_name ASC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ ...mapUser(r), vouchCount: r.vouch_count }));
  } catch (err) {
    console.error('[profiles] listPublicProfiles:', err);
    return [];
  }
}

export async function listProfileGeoFacets(): Promise<{ cities: string[]; regions: string[]; countries: string[] }> {
  try {
    const rows = await db<{ kind: 'city' | 'region' | 'country'; value: string }[]>`
      SELECT 'city' AS kind, city AS value FROM users WHERE slug IS NOT NULL AND directory_listed AND city IS NOT NULL AND city <> ''
      UNION
      SELECT 'region' AS kind, region AS value FROM users WHERE slug IS NOT NULL AND directory_listed AND region IS NOT NULL AND region <> ''
      UNION
      SELECT 'country' AS kind, country AS value FROM users WHERE slug IS NOT NULL AND directory_listed AND country IS NOT NULL AND country <> ''
      ORDER BY value ASC
    `;
    return {
      cities: rows.filter((r) => r.kind === 'city').map((r) => r.value),
      regions: rows.filter((r) => r.kind === 'region').map((r) => r.value),
      countries: rows.filter((r) => r.kind === 'country').map((r) => r.value),
    };
  } catch {
    return { cities: [], regions: [], countries: [] };
  }
}

// ---------------------------------------------------------------------------
// Vouches — community verification. Anyone with an account can vouch once
// per person; the count is social proof, a steward flips `verified` for the
// badge (see reviewDossier-equivalent callers).
// ---------------------------------------------------------------------------

export async function hasVouched(subjectId: string, voucherId: string): Promise<boolean> {
  try {
    const rows = await db`SELECT 1 FROM profile_vouches WHERE subject_id = ${subjectId} AND voucher_id = ${voucherId} LIMIT 1`;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function vouchForProfile(subjectId: string, voucherId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  if (subjectId === voucherId) return { ok: false, error: 'Cannot vouch for your own profile.' };
  try {
    await db`
      INSERT INTO profile_vouches (subject_id, voucher_id, note)
      VALUES (${subjectId}, ${voucherId}, ${note ?? null})
      ON CONFLICT (subject_id, voucher_id) DO NOTHING
    `;
    return { ok: true };
  } catch (err) {
    console.error(`[profiles] vouchForProfile(${subjectId}, ${voucherId}):`, err);
    return { ok: false, error: 'Could not record your vouch.' };
  }
}

/** Global admin only — flips the verified badge. Org-level review stays out of this module. */
export async function setProfileVerified(subjectId: string, approverId: string, verified: boolean): Promise<{ ok: boolean; error?: string }> {
  const [approver] = await db<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${approverId} LIMIT 1`;
  if (!approver?.is_admin) return { ok: false, error: 'Not authorized to verify profiles.' };

  await db`UPDATE users SET verified = ${verified}, verified_at = ${verified ? new Date() : null} WHERE id = ${subjectId}`;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Amalgamation — everything a person has published, across the platform or
// scoped to one org. The point of a profile page: it shouldn't go stale just
// because nobody edited the bio.
// ---------------------------------------------------------------------------

export interface AuthoredThread {
  id: string;
  orgId: string;
  /** Joined so cross-org lists can label rows without a second query. */
  orgName: string;
  title: string;
  slug: string;
  kind: string;
  section: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  /** 'published' | 'draft'. Only ever 'draft' when the viewer is the author. */
  status: string;
  /**
   * When the thing happens, for the dated kinds. Null for a post or a piece of
   * writing, which is what lets ONE query back both "what they have published"
   * and "where they are appearing" — a profile needs both lists and they come
   * from the same rows.
   */
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
}

/**
 * What this person has published — optionally scoped to one org, one kind.
 *
 * Backs two different surfaces:
 *   - a directory profile ("everything Dana has published across the network")
 *   - a per-org author blog ("Dana's posts on amrit-canada")
 *
 * Draft visibility is deliberately not a boolean. Passing `viewerId` and
 * having it match `userId` is the ONLY way to see unpublished work, so a
 * caller cannot leak someone's drafts by setting a flag it didn't think
 * about. An author viewing their own page sees drafts and members-only
 * posts; everyone else sees published + PUBLIC, and archived is never
 * returned to anyone.
 */
export async function getAuthoredThreads(
  userId: string,
  opts: {
    orgId?: string;
    /** e.g. 'post' for a blog index. Omit for everything they've made. */
    kind?: string;
    /**
     * Several kinds at once — `['event','meeting','workshop']` for an
     * appearances list, `['post','writing']` for a blog index. Applied on top
     * of `kind` rather than instead of it, so passing both narrows.
     */
    kinds?: readonly string[];
    limit?: number;
    /** Set to the signed-in user. Drafts appear only when it equals userId. */
    viewerId?: string;
    /** Only rows that have a date on them. */
    scheduledOnly?: boolean;
    /**
     * Ordering. 'filed' is newest-published first (a blog); 'scheduled' is by
     * date, soonest first, which is what an appearances list wants.
     */
    order?: "filed" | "scheduled";
  } = {}
): Promise<AuthoredThread[]> {
  const limit = opts.limit ?? 20;
  const isSelf = Boolean(opts.viewerId && opts.viewerId === userId);

  try {
    const rows = await db<
      Array<
        AuthoredThread & {
          published_at: string | null;
          cover_image_url: string | null;
          scheduled_at: string | null;
          duration_minutes: number | null;
        }
      >
    >`
      SELECT t.id, t.org_id AS "orgId", o.name AS org_name,
             t.title, t.slug, t.kind, t.section, t.excerpt,
             t.metadata->>'coverImageUrl' AS cover_image_url,
             t.published_at, t.status,
             t.scheduled_at, t.duration_minutes, t.location
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      WHERE t.author_id = ${userId}
        ${opts.orgId ? db`AND t.org_id = ${opts.orgId}` : db``}
        ${opts.kind ? db`AND t.kind = ${opts.kind}` : db``}
        ${opts.kinds?.length ? db`AND t.kind = ANY(${opts.kinds as string[]})` : db``}
        ${opts.scheduledOnly ? db`AND t.scheduled_at IS NOT NULL` : db``}
        ${
          isSelf
            ? db`AND t.status <> 'archived'`
            : db`AND t.status = 'published' AND t.visibility = 'PUBLIC'`
        }
      ${
        opts.order === "scheduled"
          ? db`ORDER BY t.scheduled_at DESC NULLS LAST`
          : db`ORDER BY COALESCE(t.published_at, t.created_at) DESC`
      }
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      orgName: (r as unknown as { org_name: string }).org_name,
      title: r.title,
      slug: r.slug,
      kind: r.kind,
      section: r.section,
      excerpt: r.excerpt,
      coverImageUrl: r.cover_image_url,
      publishedAt: r.published_at,
      status: (r as unknown as { status: string }).status,
      scheduledAt: r.scheduled_at,
      durationMinutes: r.duration_minutes,
      location: r.location,
    }));
  } catch (err) {
    console.error(`[profiles] getAuthoredThreads(${userId}):`, err);
    return [];
  }
}

export interface AuthoredMedia {
  id: string;
  orgId: string;
  url: string;
  type: string | null;
  caption: string | null;
  createdAt: string;
}

export async function getAuthoredMedia(
  userId: string,
  opts: { orgId?: string; limit?: number } = {}
): Promise<AuthoredMedia[]> {
  const limit = opts.limit ?? 40;
  try {
    const rows = opts.orgId
      ? await db<AuthoredMedia[]>`
          SELECT id, org_id AS "orgId", url, type, caption, created_at AS "createdAt"
          FROM media WHERE uploaded_by = ${userId} AND org_id = ${opts.orgId}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      : await db<AuthoredMedia[]>`
          SELECT id, org_id AS "orgId", url, type, caption, created_at AS "createdAt"
          FROM media WHERE uploaded_by = ${userId}
          ORDER BY created_at DESC LIMIT ${limit}
        `;
    return rows;
  } catch (err) {
    console.error(`[profiles] getAuthoredMedia(${userId}):`, err);
    return [];
  }
}
