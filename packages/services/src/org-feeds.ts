import { db } from '@elkdonis/db';

// ============================================================================
// Per-org content feeds — the named sections of an org's public site
// ("Amrit Vela", "Yoga Classes", "Gurdwara & Langar").
//
// Replaces what used to be a CHECK constraint on threads.section listing one
// app's three sections in the shared schema (migration 073 drops it). A thread
// belongs to a feed via threads.section = org_feeds.slug — a soft reference
// with no FK, deliberately: reads across these apps are fail-soft, and an
// unrecognised section should render an empty feed rather than block a publish.
//
// Two independent switches, and the difference matters:
//
//   is_public — show in site navigation. Presentation only.
//   min_role  — who may READ the feed at all (migration 079). NULL = anyone.
//
// So a feed can be listed but locked (a visible members-only section), or
// unlisted but public (a quiet page shared by link). Callers enforce min_role
// via canViewFeed() below; content inside a feed is still separately gated by
// threads.visibility and threads.status in the read query.
// ============================================================================

/** Org roles, ordered least to most privileged. Mirrors org-membership.ts. */
const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  member: 2,
  guide: 3,
  owner: 4,
};

export interface OrgFeed {
  orgId: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  /** Real-world entity presenting this feed, for a credit line. Not a tenant. */
  presenter: string | null;
  /** Hex accent colour driving the per-feed theme token. */
  accent: string | null;
  sortOrder: number;
  /** Show in site navigation. Not an access gate — see minRole. */
  isPublic: boolean;
  /** Lowest org role that may read this feed. null = anyone. */
  minRole: 'member' | 'guide' | 'owner' | null;
  /**
   * Lowest org role that may START a topic here (migration 138). null = anyone
   * who can read it. Replies are not gated — an announcement can be answered.
   */
  postRole: 'member' | 'guide' | 'owner' | null;
}

/**
 * Whether a viewer holding `role` in this org may read `feed`.
 *
 * `role` is what getOrgRole returns: null for signed-out visitors and for
 * signed-in people who aren't members of this org — both are treated the
 * same, because neither has been let in.
 */
export function canViewFeed(
  feed: Pick<OrgFeed, 'minRole'>,
  role: string | null
): boolean {
  if (!feed.minRole) return true;
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[feed.minRole] ?? 0);
}

/** Whether a viewer holding `role` in this org may start a topic in `feed`. */
export function canPostToFeed(
  feed: Pick<OrgFeed, 'minRole' | 'postRole'>,
  role: string | null
): boolean {
  if (!canViewFeed(feed, role)) return false;
  if (!feed.postRole) return true;
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[feed.postRole] ?? 0);
}

export interface OrgFeedInput {
  name: string;
  tagline?: string | null;
  description?: string | null;
  presenter?: string | null;
  accent?: string | null;
  sortOrder?: number;
  isPublic?: boolean;
  minRole?: 'member' | 'guide' | 'owner' | null;
}

interface FeedRow {
  org_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  presenter: string | null;
  accent: string | null;
  sort_order: number;
  is_public: boolean;
  min_role: 'member' | 'guide' | 'owner' | null;
  post_role: 'member' | 'guide' | 'owner' | null;
}

function mapFeed(row: FeedRow): OrgFeed {
  return {
    orgId: row.org_id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    presenter: row.presenter,
    accent: row.accent,
    sortOrder: row.sort_order,
    isPublic: row.is_public,
    minRole: row.min_role,
    postRole: row.post_role ?? null,
  };
}

/**
 * Every feed for an org, in display order.
 *
 * `includePrivate` is for editorial surfaces (the /manage feeds screen);
 * public pages should leave it off so unpublished sections stay out of nav.
 */
export async function listOrgFeeds(
  orgId: string,
  options: { includePrivate?: boolean } = {}
): Promise<OrgFeed[]> {
  const rows = await db<FeedRow[]>`
    SELECT org_id, slug, name, tagline, description, presenter, accent, sort_order, is_public, min_role, post_role
    FROM org_feeds
    WHERE org_id = ${orgId}
      ${options.includePrivate ? db`` : db`AND is_public`}
    ORDER BY sort_order, name
  `;
  return rows.map(mapFeed);
}

/** One feed by slug, or null. */
export async function getOrgFeed(orgId: string, slug: string): Promise<OrgFeed | null> {
  const [row] = await db<FeedRow[]>`
    SELECT org_id, slug, name, tagline, description, presenter, accent, sort_order, is_public, min_role, post_role
    FROM org_feeds
    WHERE org_id = ${orgId} AND slug = ${slug}
  `;
  return row ? mapFeed(row) : null;
}

/**
 * Create or update a feed. The caller is responsible for authorisation —
 * check hasOrgRole(userId, orgId, ['owner', 'guide']) first.
 */
export async function upsertOrgFeed(
  orgId: string,
  slug: string,
  input: OrgFeedInput
): Promise<OrgFeed> {
  const [row] = await db<FeedRow[]>`
    INSERT INTO org_feeds (org_id, slug, name, tagline, description, presenter, accent, sort_order, is_public, min_role)
    VALUES (
      ${orgId}, ${slug}, ${input.name},
      ${input.tagline ?? null}, ${input.description ?? null},
      ${input.presenter ?? null}, ${input.accent ?? null},
      ${input.sortOrder ?? 0}, ${input.isPublic ?? true},
      ${input.minRole ?? null}
    )
    ON CONFLICT (org_id, slug) DO UPDATE SET
      name        = EXCLUDED.name,
      tagline     = EXCLUDED.tagline,
      description = EXCLUDED.description,
      presenter   = EXCLUDED.presenter,
      accent      = EXCLUDED.accent,
      sort_order  = EXCLUDED.sort_order,
      is_public   = EXCLUDED.is_public,
      min_role    = EXCLUDED.min_role,
      updated_at  = NOW()
    RETURNING org_id, slug, name, tagline, description, presenter, accent, sort_order, is_public, min_role
  `;
  return mapFeed(row);
}

/**
 * Remove a feed. Threads keep their `section` value — they simply stop
 * resolving to a feed and drop out of public listings rather than being
 * deleted or silently re-homed.
 */
export async function deleteOrgFeed(orgId: string, slug: string): Promise<void> {
  await db`DELETE FROM org_feeds WHERE org_id = ${orgId} AND slug = ${slug}`;
}
