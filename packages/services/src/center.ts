import { db } from '@elkdonis/db';
import { getProfile } from './profiles';
import { listUserMemberships, type OrgRole } from './org-membership';
import { getOrgIdentity } from './org-domains';

// ============================================================================
// /center — the follower's home on one org's site.
//
// One read for the whole page, every section in parallel and fail-soft: a
// broken section costs its face, never the page. The shapes here are what
// @elkdonis/cms-ui/center renders; that package stays free of the data layer,
// so it declares structurally identical types of its own.
//
// Design brief: CENTER_PAGE_BRIEF_2026-09-09.md. The decisions this file
// encodes: the org feed is chronological after pins (5); a viewer/follower
// reads ORGANIZATION-visibility threads (6); the network slider is a trail
// (threads this org carries via thread_orgs) before it is a feed
// (share_to_network), and never a score; the promotion slot is a placed item
// read from site_config, with a network fallback under the `elkdonis` org (13).
// ============================================================================

export interface CenterThread {
  id: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  title: string;
  slug: string;
  kind: string;
  section: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  pinned: boolean;
  shareToNetwork: boolean;
  visibility: string;
  rsvpCount: number;
  /** Null when the viewer has no RSVP row; otherwise whether it is 'yes'. */
  viewerAttending: boolean | null;
  /** Names of OTHER orgs carrying this thread (thread_orgs). */
  carriedBy: string[];
  authorName: string | null;
  authorAvatar: string | null;
  authorSlug: string | null;
}

export interface CenterPerson {
  userId: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  slug: string | null;
  city: string | null;
  socialLinks: Array<{ label: string | null; url: string }>;
  /** How THIS org presents the person, when it has an org_profiles row. */
  orgProfile: { roleTitle: string | null; photoOverride: string | null; isPublic: boolean } | null;
}

export interface CenterOrg {
  orgId: string;
  orgSlug: string;
  orgName: string;
  tier: string;
  headline: string | null;
  avatarUrl: string | null;
  place: string | null;
  /** People holding the viewer role — followers in the UI. */
  followerCount: number;
  /** The viewer's role in this org, or null for no relation. */
  viewerRole: OrgRole | null;
  /** The org's own users row (migration 099) — what the profile surface edits. */
  profileUserId: string | null;
  /** The next scheduled thread the viewer said yes to, here. */
  nextEvent: CenterThread | null;
  /** Published, scheduled in the next 30 days. */
  upcomingCount: number;
}

export interface CenterOrgLink {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: OrgRole;
  isCurrent: boolean;
  /** The viewer's confirmed RSVPs in that org. */
  rsvpCount: number;
}

export type CenterPromoKind = 'thread' | 'artist' | 'store';

export interface CenterPromo {
  kind: CenterPromoKind;
  /** Where the placement came from: this org, the network, or the fallback rule. */
  source: 'org' | 'network' | 'fallback';
  title: string;
  blurb: string | null;
  imageUrl: string | null;
  until: string | null;
  /** Set for kind 'thread'. */
  thread: CenterThread | null;
  /** Set for kind 'artist' — a users.slug. */
  artistSlug: string | null;
  /** Set for kind 'store' — the store's org_id, for the marketplace link. */
  storeOrgId: string | null;
}

export interface CenterData {
  person: CenterPerson | null;
  org: CenterOrg | null;
  orgs: CenterOrgLink[];
  /** The org's feed, pinned first. `pinned` repeats the pinned ones for the strip. */
  feed: CenterThread[];
  pinned: CenterThread[];
  /** The soonest scheduled thing in the feed that is not already pinned. */
  featured: CenterThread | null;
  network: CenterThread[];
  promo: CenterPromo | null;
}

/** The org whose site_config carries network-level placements. */
const NETWORK_CONFIG_ORG = 'elkdonis';

const toIso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null;

interface ThreadRow {
  id: string;
  org_id: string;
  org_slug: string;
  org_name: string;
  title: string;
  slug: string;
  kind: string;
  section: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  scheduled_at: unknown;
  published_at: unknown;
  pinned: boolean;
  share_to_network: boolean;
  visibility: string;
  rsvp_count: number;
  viewer_attending: boolean | null;
  carried_by: string[] | null;
  author_name: string | null;
  author_avatar: string | null;
  author_slug: string | null;
}

function mapThread(r: ThreadRow): CenterThread {
  return {
    id: r.id,
    orgId: r.org_id,
    orgSlug: r.org_slug,
    orgName: r.org_name,
    title: r.title,
    slug: r.slug,
    kind: r.kind,
    section: r.section,
    excerpt: r.excerpt,
    coverImageUrl: r.cover_image_url,
    scheduledAt: toIso(r.scheduled_at),
    publishedAt: toIso(r.published_at),
    pinned: r.pinned,
    shareToNetwork: r.share_to_network,
    visibility: r.visibility,
    rsvpCount: r.rsvp_count ?? 0,
    viewerAttending: r.viewer_attending,
    carriedBy: r.carried_by ?? [],
    authorName: r.author_name,
    authorAvatar: r.author_avatar,
    authorSlug: r.author_slug,
  };
}

/** The columns every thread read here selects; `userId` drives viewer_attending. */
function threadSelect(userId: string) {
  return db`
    t.id, t.org_id, o.slug AS org_slug, o.name AS org_name,
    t.title, t.slug, t.kind, t.section, t.excerpt,
    t.metadata->>'coverImageUrl' AS cover_image_url,
    t.scheduled_at, t.published_at, t.pinned, t.share_to_network, t.visibility,
    (SELECT COUNT(*)::int FROM thread_rsvps r WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count,
    (SELECT r.status = 'yes' FROM thread_rsvps r WHERE r.thread_id = t.id AND r.user_id = ${userId}) AS viewer_attending,
    (SELECT COALESCE(array_agg(o2.name ORDER BY o2.name), '{}')
       FROM thread_orgs x JOIN organizations o2 ON o2.id = x.org_id
      WHERE x.thread_id = t.id AND x.org_id <> t.org_id) AS carried_by,
    a.display_name AS author_name, a.avatar_url AS author_avatar, a.slug AS author_slug
  `;
}

async function loadFeed(orgId: string, userId: string, affiliated: boolean, limit: number): Promise<CenterThread[]> {
  const rows = await db<ThreadRow[]>`
    SELECT ${threadSelect(userId)}
    FROM threads t JOIN organizations o ON o.id = t.org_id LEFT JOIN users a ON a.id = t.author_id
    WHERE t.org_id = ${orgId}
      AND t.status = 'published'
      AND (t.visibility = 'PUBLIC' OR (t.visibility = 'ORGANIZATION' AND ${affiliated}))
    ORDER BY t.pinned DESC, COALESCE(t.published_at, t.created_at) DESC
    LIMIT ${limit}
  `;
  return rows.map(mapThread);
}

/**
 * The trail first, then the feed. A thread this org carries (thread_orgs)
 * outranks one merely flagged for the network; among the rest, orgs the
 * viewer belongs to come first. Recency after that, and nothing else — the
 * brief's rule is "never a score".
 */
async function loadNetwork(orgId: string, userId: string, memberOrgIds: string[], limit: number): Promise<CenterThread[]> {
  const mine = memberOrgIds.length ? db`(t.org_id = ANY(${memberOrgIds}))` : db`FALSE`;
  const rows = await db<ThreadRow[]>`
    SELECT ${threadSelect(userId)},
           EXISTS (SELECT 1 FROM thread_orgs x WHERE x.thread_id = t.id AND x.org_id = ${orgId}) AS carried_here
    FROM threads t JOIN organizations o ON o.id = t.org_id LEFT JOIN users a ON a.id = t.author_id
    WHERE t.org_id <> ${orgId}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
      AND (t.share_to_network OR t.pinned
           OR EXISTS (SELECT 1 FROM thread_orgs x WHERE x.thread_id = t.id AND x.org_id = ${orgId}))
    ORDER BY carried_here DESC, ${mine} DESC, COALESCE(t.published_at, t.created_at) DESC
    LIMIT ${limit}
  `;
  return rows.map(mapThread);
}

async function loadNextEvent(orgId: string, userId: string): Promise<CenterThread | null> {
  const rows = await db<ThreadRow[]>`
    SELECT ${threadSelect(userId)}
    FROM thread_rsvps r
    JOIN threads t ON t.id = r.thread_id
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN users a ON a.id = t.author_id
    WHERE r.user_id = ${userId} AND r.status = 'yes'
      AND t.org_id = ${orgId} AND t.status = 'published'
      AND (t.scheduled_at > NOW()
           OR (t.recurrence_pattern IS NOT NULL
               AND (t.recurrence_until IS NULL OR t.recurrence_until > NOW())))
    ORDER BY (t.scheduled_at > NOW()) DESC, t.scheduled_at ASC
    LIMIT 1
  `;
  return rows[0] ? mapThread(rows[0]) : null;
}

async function loadNextScheduled(orgId: string, userId: string): Promise<CenterThread | null> {
  const rows = await db<ThreadRow[]>`
    SELECT ${threadSelect(userId)}
    FROM threads t JOIN organizations o ON o.id = t.org_id LEFT JOIN users a ON a.id = t.author_id
    WHERE t.org_id = ${orgId} AND t.status = 'published' AND t.visibility = 'PUBLIC'
      AND t.scheduled_at > NOW()
    ORDER BY t.scheduled_at ASC
    LIMIT 1
  `;
  return rows[0] ? mapThread(rows[0]) : null;
}

async function loadThreadById(id: string, userId: string): Promise<CenterThread | null> {
  const rows = await db<ThreadRow[]>`
    SELECT ${threadSelect(userId)}
    FROM threads t JOIN organizations o ON o.id = t.org_id LEFT JOIN users a ON a.id = t.author_id
    WHERE t.id = ${id} AND t.status = 'published' AND t.visibility = 'PUBLIC'
    LIMIT 1
  `;
  return rows[0] ? mapThread(rows[0]) : null;
}

async function loadOrg(orgId: string, userId: string, viewerRole: OrgRole | null): Promise<CenterOrg | null> {
  const [org] = await db<Array<{ id: string; slug: string; name: string; tier: string; profile_user_id: string | null }>>`
    SELECT id, slug, name, tier, profile_user_id FROM organizations WHERE id = ${orgId} LIMIT 1
  `;
  if (!org) return null;

  const [identity, [{ count: followerCount }], [{ count: upcomingCount }], nextEvent] = await Promise.all([
    getOrgIdentity(org.slug).catch(() => null),
    db<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM user_organizations WHERE org_id = ${orgId} AND role = 'viewer'
    `,
    db<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM threads
      WHERE org_id = ${orgId} AND status = 'published'
        AND scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    `,
    loadNextEvent(orgId, userId).catch(() => null),
  ]);

  const place = [identity?.city, identity?.region, identity?.country].filter(Boolean).join(', ') || null;

  return {
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    tier: org.tier,
    headline: identity?.headline ?? null,
    avatarUrl: identity?.avatarUrl ?? null,
    place,
    followerCount,
    viewerRole,
    profileUserId: org.profile_user_id,
    nextEvent,
    upcomingCount,
  };
}

async function loadPerson(orgId: string, userId: string): Promise<CenterPerson | null> {
  const [profile, orgRows] = await Promise.all([
    getProfile(userId),
    db<Array<{ role_title: string | null; photo_override: string | null; is_public: boolean }>>`
      SELECT role_title, photo_override, is_public FROM org_profiles
      WHERE org_id = ${orgId} AND user_id = ${userId} LIMIT 1
    `,
  ]);
  if (!profile) return null;
  const op = orgRows[0];
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    headline: profile.headline,
    avatarUrl: profile.avatarUrl,
    slug: profile.slug,
    city: profile.city,
    socialLinks: profile.socialLinks,
    orgProfile: op
      ? { roleTitle: op.role_title, photoOverride: op.photo_override, isPublic: op.is_public }
      : null,
  };
}

async function loadOrgs(orgId: string, userId: string): Promise<CenterOrgLink[]> {
  const [memberships, counts] = await Promise.all([
    listUserMemberships(userId),
    db<Array<{ org_id: string; count: number }>>`
      SELECT t.org_id, COUNT(*)::int AS count
      FROM thread_rsvps r JOIN threads t ON t.id = r.thread_id
      WHERE r.user_id = ${userId} AND r.status = 'yes'
      GROUP BY t.org_id
    `,
  ]);
  const byOrg = new Map(counts.map((c) => [c.org_id, c.count]));
  // The org you are standing in leads the rail; the rest keep their name order.
  return memberships
    .map((m) => ({
      orgId: m.orgId,
      orgSlug: m.orgSlug,
      orgName: m.orgName,
      role: m.role,
      isCurrent: m.orgId === orgId,
      rsvpCount: byOrg.get(m.orgId) ?? 0,
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}

// ── The promotion slot (decision 13) ───────────────────────────────────────

export interface CenterPromoConfig {
  kind: CenterPromoKind;
  ref: string;
  blurb?: string;
  until?: string;
  placed_by?: string;
}

function isPromoConfig(v: unknown): v is CenterPromoConfig {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === 'thread' || o.kind === 'artist' || o.kind === 'store') &&
    typeof o.ref === 'string' &&
    o.ref.length > 0
  );
}

async function readPromoConfig(orgId: string): Promise<{ cfg: CenterPromoConfig; source: 'org' | 'network' } | null> {
  const rows = await db<Array<{ org_id: string; value: unknown }>>`
    SELECT org_id, value FROM site_config
    WHERE key = 'center_promo' AND org_id IN (${orgId}, ${NETWORK_CONFIG_ORG})
  `;
  const pick = (id: string) => rows.find((r) => r.org_id === id)?.value;
  const own = pick(orgId);
  const stillLive = (c: CenterPromoConfig) => !c.until || new Date(c.until).getTime() > Date.now();
  if (isPromoConfig(own) && stillLive(own)) return { cfg: own, source: 'org' };
  const net = pick(NETWORK_CONFIG_ORG);
  if (isPromoConfig(net) && stillLive(net)) return { cfg: net, source: 'network' };
  return null;
}

/**
 * Resolve a placement to something renderable. An unknown ref is not an
 * error: it falls through to the next source, and finally to the org's own
 * next scheduled event, so the slot is never empty for an active org.
 */
async function loadPromo(orgId: string, userId: string): Promise<CenterPromo | null> {
  const placed = await readPromoConfig(orgId).catch(() => null);
  if (placed) {
    const { cfg, source } = placed;
    const base = { source, blurb: cfg.blurb ?? null, until: cfg.until ?? null };
    if (cfg.kind === 'thread') {
      const thread = await loadThreadById(cfg.ref, userId).catch(() => null);
      if (thread) {
        return {
          ...base,
          kind: 'thread',
          title: thread.title,
          imageUrl: thread.coverImageUrl,
          thread,
          artistSlug: null,
          storeOrgId: null,
        };
      }
    } else if (cfg.kind === 'artist') {
      const [u] = await db<Array<{ slug: string; display_name: string | null; headline: string | null; avatar_url: string | null }>>`
        SELECT slug, display_name, headline, avatar_url FROM users
        WHERE slug = ${cfg.ref} AND entity_type = 'person' LIMIT 1
      `.catch(() => []);
      if (u) {
        return {
          ...base,
          kind: 'artist',
          title: u.display_name ?? u.slug,
          blurb: base.blurb ?? u.headline,
          imageUrl: u.avatar_url,
          thread: null,
          artistSlug: u.slug,
          storeOrgId: null,
        };
      }
    } else if (cfg.kind === 'store') {
      const [s] = await db<Array<{ org_id: string; display_name: string | null; headline: string | null; photo_url: string | null }>>`
        SELECT org_id, display_name, headline, photo_url FROM store WHERE org_id = ${cfg.ref} LIMIT 1
      `.catch(() => []);
      if (s) {
        return {
          ...base,
          kind: 'store',
          title: s.display_name ?? 'The store',
          blurb: base.blurb ?? s.headline,
          imageUrl: s.photo_url,
          thread: null,
          artistSlug: null,
          storeOrgId: s.org_id,
        };
      }
    }
  }

  const next = await loadNextScheduled(orgId, userId).catch(() => null);
  if (!next) return null;
  return {
    kind: 'thread',
    source: 'fallback',
    title: next.title,
    blurb: next.excerpt,
    imageUrl: next.coverImageUrl,
    until: next.scheduledAt,
    thread: next,
    artistSlug: null,
    storeOrgId: null,
  };
}

// ── The page read ──────────────────────────────────────────────────────────

export interface LoadCenterOptions {
  orgId: string;
  userId: string;
  /** The viewer's role in `orgId`, or null. Decides ORGANIZATION reads. */
  viewerRole: OrgRole | null;
  feedLimit?: number;
  networkLimit?: number;
}

export async function loadCenter(opts: LoadCenterOptions): Promise<CenterData> {
  const { orgId, userId, viewerRole } = opts;
  const feedLimit = opts.feedLimit ?? 12;
  const networkLimit = opts.networkLimit ?? 12;
  const affiliated = viewerRole !== null;

  const soft = <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> =>
    p.catch((err) => {
      console.error(`[center] ${label} (${orgId}, ${userId}):`, err);
      return fallback;
    });

  const orgs = await soft('orgs', loadOrgs(orgId, userId), [] as CenterOrgLink[]);
  const memberOrgIds = orgs.map((o) => o.orgId);

  const [person, org, feed, network, promo] = await Promise.all([
    soft('person', loadPerson(orgId, userId), null),
    soft('org', loadOrg(orgId, userId, viewerRole), null),
    soft('feed', loadFeed(orgId, userId, affiliated, feedLimit), [] as CenterThread[]),
    soft('network', loadNetwork(orgId, userId, memberOrgIds, networkLimit), [] as CenterThread[]),
    soft('promo', loadPromo(orgId, userId), null),
  ]);

  // Pins get their own strip on the page, so featured is the soonest
  // scheduled thing that is NOT pinned; failing that, nothing — an empty
  // featured slot is honest.
  const pinned = feed.filter((t) => t.pinned);
  const featured =
    feed
      .filter((t) => !t.pinned && t.scheduledAt && new Date(t.scheduledAt).getTime() > Date.now())
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0] ??
    null;

  return { person, org, orgs, feed, pinned, featured, network, promo };
}
