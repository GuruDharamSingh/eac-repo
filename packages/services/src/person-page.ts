import { db } from '@elkdonis/db';
import {
  canEditProfile,
  getOrgProfileBySlug,
  getProfileBySlug,
  type OrgProfile,
  type PortfolioItem,
  type Profile,
} from './profiles';
import { listUserGalleries, type UserGallerySummary } from './galleries';
import { listWriting, type WritingSummary } from './writing';
import { OFF_FEED_KINDS } from './thread-kinds';
import { PERSONAL_ORG_ID, listedOnClause, listListableOrgs, listThreadListings } from './thread-listing';

// ============================================================================
// Person pages — one network profile, presented per org.
//
// Design: docs/open/PERSON_PAGES_BRIEF_2026-09-26.md.
//
// A section S of person P shows on org X when
//     X offers S                      organizations.person_page.sections
//                                     (empty = every section)
//     AND P allows S on X             org_profiles.sections[S]
//                                     ?? users.profile_sections[S]
//                                     ?? SECTION_DEFAULTS[S]
// and the renderer hides an empty section unless the viewer can edit.
//
// Content on X's page is what X shows: homed on X or listed there
// (thread_orgs; see thread-listing.ts). ArtDirect is PERSONAL_ORG_ID and
// shows everything the person authored that the viewer may read.
// ============================================================================

export const PERSON_SECTIONS = ['portfolio', 'galleries', 'blog', 'services', 'posts', 'events', 'store'] as const;
export type PersonSection = (typeof PERSON_SECTIONS)[number];

/** Human labels, for switches and headings. */
export const PERSON_SECTION_LABELS: Record<PersonSection, string> = {
  portfolio: 'Featured work',
  galleries: 'Galleries',
  blog: 'Writing',
  services: 'Services',
  posts: 'Posts',
  events: 'Events',
  store: 'Store',
};

/**
 * Default when neither the org row nor the person's own setting says.
 * `blog` and `store` were opt-in before this module (profile_sections) and
 * stay so; the rest were shown by every site that had them.
 */
const SECTION_DEFAULTS: Record<PersonSection, boolean> = {
  portfolio: true,
  galleries: true,
  blog: false,
  // Shown by default; an empty section is hidden from visitors anyway.
  services: true,
  posts: true,
  events: true,
  store: false,
};

/** Thread kinds the `events` section carries; `posts` carries the other feed kinds. */
export const EVENT_KINDS = ['event', 'meeting', 'workshop', 'reading_group'];

/**
 * Thread kinds the `services` section carries: offerings a visitor books and
 * pays for (2026-09-27). Kept out of `posts`.
 */
export const SERVICE_KINDS = ['service'];

function isSection(key: string): key is PersonSection {
  return (PERSON_SECTIONS as readonly string[]).includes(key);
}

function flag(v: unknown): boolean | null {
  if (v === true || v === 'true' || v === 1) return true;
  if (v === false || v === 'false' || v === 0) return false;
  return null;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** The sections an org's person pages offer, in its order. */
export function offeredSections(personPage: unknown): PersonSection[] {
  const cfg = asObject(personPage);
  const listed = Array.isArray(cfg.sections) ? cfg.sections.filter((k): k is PersonSection => typeof k === 'string' && isSection(k)) : [];
  const offered = listed.length ? listed : [...PERSON_SECTIONS];
  const order = Array.isArray(cfg.order) ? cfg.order.filter((k): k is PersonSection => typeof k === 'string' && isSection(k)) : [];
  return [...order.filter((k) => offered.includes(k)), ...offered.filter((k) => !order.includes(k))];
}

/** The person's own order for their ArtDirect page: listed keys first, the rest in default order. */
function personalOrder(order: unknown): PersonSection[] {
  const listed = Array.isArray(order) ? order.filter((k): k is PersonSection => typeof k === 'string' && isSection(k)) : [];
  const unique = listed.filter((k, i) => listed.indexOf(k) === i);
  return [...unique, ...PERSON_SECTIONS.filter((k) => !unique.includes(k))];
}

/**
 * Set the caller's own section order on ArtDirect. Unknown keys are dropped;
 * missing ones fall back to their default position. `userId` must come from
 * the session.
 */
export async function setPersonSectionOrder(userId: string, order: string[]): Promise<PersonSection[]> {
  const clean = personalOrder(order);
  await db`UPDATE users SET profile_section_order = ${clean}, updated_at = NOW() WHERE id = ${userId}`;
  return clean;
}

export interface PersonSectionState {
  key: PersonSection;
  label: string;
  /** The org offers it at all. */
  offered: boolean;
  /** The person's network-wide default (users.profile_sections, then SECTION_DEFAULTS). */
  personDefault: boolean;
  /** This org's override (org_profiles.sections); null = inherits the default. */
  orgOverride: boolean | null;
  /** Effective: offered AND (override ?? default). */
  on: boolean;
}

/**
 * Section states for one person on one org, in the org's order (offered
 * sections first). For PERSONAL_ORG_ID only the person's defaults apply.
 */
export async function resolvePersonSections(userId: string, orgId: string): Promise<PersonSectionState[]> {
  const [row] = await db<{ profile_sections: unknown; profile_section_order: string[] | null; sections: unknown; person_page: unknown }[]>`
    SELECT u.profile_sections, u.profile_section_order,
           (SELECT op.sections FROM org_profiles op WHERE op.user_id = u.id AND op.org_id = ${orgId}) AS sections,
           (SELECT o.person_page FROM organizations o WHERE o.id = ${orgId}) AS person_page
    FROM users u WHERE u.id = ${userId}
  `;
  const personal = asObject(row?.profile_sections);
  const overrides = orgId === PERSONAL_ORG_ID ? {} : asObject(row?.sections);
  // On ArtDirect the person orders their own page (users.profile_section_order,
  // migration 172); on an org, the org's order applies.
  const offered = orgId === PERSONAL_ORG_ID
    ? personalOrder(row?.profile_section_order)
    : offeredSections(row?.person_page);
  const ordered = [...offered, ...PERSON_SECTIONS.filter((k) => !offered.includes(k))];
  return ordered.map((key) => {
    const personDefault = flag(personal[key]) ?? SECTION_DEFAULTS[key];
    const orgOverride = flag(overrides[key]);
    const isOffered = offered.includes(key);
    return {
      key,
      label: PERSON_SECTION_LABELS[key],
      offered: isOffered,
      personDefault,
      orgOverride,
      on: isOffered && (orgOverride ?? personDefault),
    };
  });
}

/**
 * Set (true/false) or clear (null) the caller's own override for one section
 * on one org. Writes only an existing org_profiles row: a person has one on
 * every org they are a member of (migration 149 trigger, presence.ts).
 * `userId` must come from the session.
 */
export async function setPersonOrgSection(
  userId: string,
  orgId: string,
  section: string,
  on: boolean | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSection(section)) return { ok: false, error: 'Unknown section.' };
  if (orgId === PERSONAL_ORG_ID) return { ok: false, error: 'Use your page settings for ArtDirect.' };
  try {
    const rows = on === null
      ? await db`
          UPDATE org_profiles SET sections = sections - ${section}
          WHERE user_id = ${userId} AND org_id = ${orgId} RETURNING 1`
      : await db`
          UPDATE org_profiles SET sections = sections || ${db.json({ [section]: on })}
          WHERE user_id = ${userId} AND org_id = ${orgId} RETURNING 1`;
    if (rows.length === 0) return { ok: false, error: 'You have no page on that site.' };
    return { ok: true };
  } catch (err) {
    console.error(`[person-page] setPersonOrgSection(${userId}, ${orgId}, ${section}):`, err);
    return { ok: false, error: 'Could not save that.' };
  }
}

export interface PersonThread {
  id: string;
  /** Home org. Differs from the page's org when the post is listed there. */
  orgId: string;
  orgName: string;
  orgSlug: string;
  /** The home org's primary domain, when verified; for links out. */
  orgDomain: string | null;
  kind: string;
  section: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  location: string | null;
  status: string;
  /** Major units; set on priced kinds (services), null otherwise. */
  price: number | null;
  currency: string | null;
  /** Sliding-scale floor from the workshop_pages sidecar, major units. */
  priceSlidingMin: number | null;
}

/**
 * A person's threads as one org shows them: homed or listed there. Off-feed
 * kinds (writing, wiki, documents) are excluded; writing has its own section.
 * Visitors see published PUBLIC posts; the person themselves also sees drafts.
 */
export async function listPersonThreads(
  userId: string,
  opts: { orgId: string; viewerId?: string | null; kinds?: string[]; excludeKinds?: string[]; order?: 'filed' | 'scheduled'; limit?: number }
): Promise<PersonThread[]> {
  const isSelf = Boolean(opts.viewerId && opts.viewerId === userId);
  const limit = Math.min(opts.limit ?? 12, 100);
  const exclude = [...OFF_FEED_KINDS, ...(opts.excludeKinds ?? [])];
  try {
    const rows = await db<Array<{
      id: string; org_id: string; org_name: string; org_slug: string; org_domain: string | null;
      kind: string; section: string | null; title: string; slug: string; excerpt: string | null;
      cover_image_url: string | null; published_at: Date | null; scheduled_at: Date | null;
      location: string | null; status: string;
      price: string | null; currency: string | null; price_sliding_min: string | null;
    }>>`
      SELECT t.id, t.org_id, o.name AS org_name, o.slug AS org_slug,
             (SELECT d.domain FROM org_domains d
               WHERE d.org_id = t.org_id AND d.is_primary AND d.verified_at IS NOT NULL LIMIT 1) AS org_domain,
             t.kind, t.section, t.title, t.slug, t.excerpt,
             t.metadata->>'coverImageUrl' AS cover_image_url,
             t.published_at, t.scheduled_at, t.location, t.status,
             t.price, t.currency,
             (SELECT wp.price_sliding_min FROM workshop_pages wp WHERE wp.thread_id = t.id) AS price_sliding_min
      FROM threads t JOIN organizations o ON o.id = t.org_id
      WHERE t.author_id = ${userId}
        AND ${listedOnClause(opts.orgId)}
        AND t.kind <> ALL(${exclude})
        ${opts.kinds?.length ? db`AND t.kind = ANY(${opts.kinds})` : db``}
        ${isSelf ? db`AND t.status <> 'archived'` : db`AND t.status = 'published' AND t.visibility = 'PUBLIC'`}
      ORDER BY ${opts.order === 'scheduled'
        ? db`t.scheduled_at DESC NULLS LAST`
        : db`COALESCE(t.published_at, t.created_at) DESC`}
      LIMIT ${limit}
    `;
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
    return rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.org_name,
      orgSlug: r.org_slug,
      orgDomain: r.org_domain,
      kind: r.kind,
      section: r.section,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      coverImageUrl: r.cover_image_url,
      publishedAt: iso(r.published_at),
      scheduledAt: iso(r.scheduled_at),
      location: r.location,
      status: r.status,
      price: r.price == null ? null : Number(r.price),
      currency: r.currency,
      priceSlidingMin: r.price_sliding_min == null ? null : Number(r.price_sliding_min),
    }));
  } catch (err) {
    console.error(`[person-page] listPersonThreads(${userId}, ${opts.orgId}):`, err);
    return [];
  }
}

/**
 * Where a thread reads on its home site: the org's verified primary domain,
 * else its network subdomain page (`<networkUrl>/sites/<slug>`), then
 * `/<section|posts>/<slug>`. `localOrgId` + `localHref` let a site keep its
 * own route for posts homed on it.
 */
export function personThreadHref(
  t: PersonThread,
  opts: { networkUrl: string; localOrgId?: string; localHref?: (t: PersonThread) => string | null }
): string {
  if (opts.localOrgId && t.orgId === opts.localOrgId && opts.localHref) {
    const local = opts.localHref(t);
    if (local) return local;
  }
  const base = t.orgDomain ? `https://${t.orgDomain}` : `${opts.networkUrl.replace(/\/$/, '')}/sites/${t.orgSlug}`;
  return `${base}/${t.section ?? 'posts'}/${t.slug}`;
}

export interface PersonPageData {
  profile: Profile;
  /** The org's row for this person; null on ArtDirect. */
  orgProfile: OrgProfile | null;
  orgId: string;
  viewerId: string | null;
  /** Viewer is the person. */
  isSelf: boolean;
  /** Viewer may edit the identity (self or global admin). */
  canEdit: boolean;
  /** Effective switches, in the org's order. */
  sections: PersonSectionState[];
  /** Effective switch per key. */
  show: Record<PersonSection, boolean>;
  portfolio: PortfolioItem[];
  galleries: UserGallerySummary[];
  writing: WritingSummary[];
  posts: PersonThread[];
  events: PersonThread[];
  /** Bookable offerings (SERVICE_KINDS). */
  services: PersonThread[];
}

export interface GetPersonPageOptions {
  /** The org whose site renders the page; PERSONAL_ORG_ID for ArtDirect. */
  orgId: string;
  viewerId?: string | null;
  /** Org pages: require one of these org_profiles tags (IFAC artist/dealer). */
  tags?: string[];
  writingLimit?: number;
  threadLimit?: number;
  /**
   * `user_galleries.hidden_on` site key; defaults to orgId. Pass null for no
   * per-site filter.
   */
  gallerySite?: string | null;
}

/**
 * Everything a person page renders except the store (commerce is not a
 * services dependency; callers load it when `show.store`).
 *
 * Returns null when the person does not exist, or on an org page when they
 * are not published there and the viewer is neither them nor an admin.
 */
export async function getPersonPage(slug: string, opts: GetPersonPageOptions): Promise<PersonPageData | null> {
  const viewerId = opts.viewerId ?? null;
  const onNetwork = opts.orgId === PERSONAL_ORG_ID;

  let profile: Profile | null;
  let orgProfile: OrgProfile | null = null;
  if (onNetwork) {
    profile = await getProfileBySlug(slug);
  } else {
    orgProfile = await getOrgProfileBySlug(opts.orgId, slug, { includePrivate: true });
    profile = orgProfile;
  }
  if (!profile) return null;
  if (orgProfile && opts.tags?.length && !opts.tags.some((t) => orgProfile!.tags.includes(t))) return null;

  const isSelf = Boolean(viewerId && viewerId === profile.userId);
  const canEdit = Boolean(viewerId && (await canEditProfile(viewerId, profile.userId)));
  if (orgProfile && !orgProfile.isPublic && !canEdit) return null;

  const sections = await resolvePersonSections(profile.userId, opts.orgId);
  const show = Object.fromEntries(sections.map((s) => [s.key, s.on])) as Record<PersonSection, boolean>;
  const want = (k: PersonSection) => show[k] || canEdit;
  const gallerySite = opts.gallerySite === undefined ? (onNetwork ? null : opts.orgId) : opts.gallerySite;
  const threadLimit = opts.threadLimit ?? 12;

  const [galleries, writing, posts, events, services] = await Promise.all([
    want('galleries')
      ? listUserGalleries(profile.userId, { onlyPublic: !canEdit, ...(gallerySite ? { site: gallerySite } : {}) })
      : Promise.resolve([]),
    want('blog')
      ? listWriting(profile.userId, {
          ...(onNetwork ? {} : { orgId: opts.orgId }),
          includeDrafts: canEdit,
          limit: opts.writingLimit ?? 6,
        })
      : Promise.resolve([]),
    show.posts
      ? listPersonThreads(profile.userId, { orgId: opts.orgId, viewerId, excludeKinds: [...EVENT_KINDS, ...SERVICE_KINDS], limit: threadLimit })
      : Promise.resolve([]),
    show.events
      ? listPersonThreads(profile.userId, { orgId: opts.orgId, viewerId, kinds: EVENT_KINDS, order: 'scheduled', limit: threadLimit })
      : Promise.resolve([]),
    want('services')
      ? listPersonThreads(profile.userId, { orgId: opts.orgId, viewerId, kinds: SERVICE_KINDS, limit: threadLimit })
      : Promise.resolve([]),
  ]);

  return {
    profile,
    orgProfile,
    orgId: opts.orgId,
    viewerId,
    isSelf,
    canEdit,
    sections,
    show,
    portfolio: want('portfolio') ? profile.portfolio : [],
    galleries,
    writing,
    posts,
    events,
    services,
  };
}

export interface MyListablePost {
  id: string;
  title: string;
  kind: string;
  homeOrgId: string;
  homeOrgName: string;
  publishedAt: string | null;
  /** Orgs listing it, excluding home. */
  listedOn: string[];
}

/**
 * The caller's own public posts with their listings — the list behind
 * "Show on" in the profile popup. Wiki pages and members-only posts are
 * left out: they cannot be listed elsewhere.
 */
export async function listMyListablePosts(userId: string, opts: { limit?: number } = {}): Promise<{
  posts: MyListablePost[];
  orgs: Awaited<ReturnType<typeof listListableOrgs>>;
}> {
  const limit = Math.min(opts.limit ?? 50, 200);
  try {
    const [rows, orgs] = await Promise.all([
      db<Array<{ id: string; title: string; kind: string; org_id: string; org_name: string; published_at: Date | null; listed_on: string[] | null }>>`
        SELECT t.id, t.title, t.kind, t.org_id, o.name AS org_name, t.published_at,
               ARRAY(SELECT x.org_id FROM thread_orgs x WHERE x.thread_id = t.id AND x.org_id <> t.org_id ORDER BY x.org_id) AS listed_on
        FROM threads t JOIN organizations o ON o.id = t.org_id
        WHERE t.author_id = ${userId}
          AND t.visibility = 'PUBLIC'
          AND t.status IN ('draft', 'published')
          AND t.kind <> 'wiki_page'
        ORDER BY COALESCE(t.published_at, t.updated_at) DESC
        LIMIT ${limit}
      `,
      listListableOrgs(userId),
    ]);
    return {
      posts: rows.map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        homeOrgId: r.org_id,
        homeOrgName: r.org_name,
        publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
        listedOn: r.listed_on ?? [],
      })),
      orgs,
    };
  } catch (err) {
    console.error(`[person-page] listMyListablePosts(${userId}):`, err);
    return { posts: [], orgs: [] };
  }
}


