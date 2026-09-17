import { db } from "@elkdonis/db";
import { OFF_FEED_KINDS } from "@elkdonis/services";

// ─── Cross-org queries ─────────────────────────────────────────────────────
// Unlike org.ts, nothing here is scoped to a single orgId — these power the
// network-wide newsroom landing page and the hub's Network/Elkdonis tabs.

export type MemberRosterItem = {
  user_id: string;
  org_id: string;
  slug: string;
  name: string;
  display_name: string;
  city: string;
  bio: string;
  disciplines: string[];
};

/**
 * Every person with a public profile, with their own org's slug/name when they
 * have one (owner or guide of a non-elkdonis org), falling back to the shared
 * 'elkdonis' org. Powers /artists, the hub's Elkdonis and Community rosters,
 * and the public newsroom landing page.
 *
 * Reads `users` (migration 084's unified identity), not `artist_profiles`.
 * That legacy table is keyed by user_id but holds only a handful of rows —
 * 3 non-stub against 22 people with slugs — so every one of those four
 * surfaces was showing a near-empty network while ArtDirect showed the real
 * one. "Has a slug" is the same rule ArtDirect's directory uses
 * (listPublicProfiles), which is what makes the two agree.
 *
 * `entity_type = 'person'` matters now that organisations are `users` rows
 * too (migration 099) — without it every org would appear in the artist
 * roster as one of its own members.
 */
export async function getMemberRoster(
  limit: number = 24
): Promise<MemberRosterItem[]> {
  try {
    return await db<MemberRosterItem[]>`
      SELECT
        u.id AS user_id,
        COALESCE(own_org.id, 'elkdonis') AS org_id,
        COALESCE(own_org.slug, 'elkdonis') AS slug,
        COALESCE(own_org.name, 'Elkdonis Arts Collective') AS name,
        u.display_name,
        COALESCE(u.city, '') AS city,
        COALESCE(u.bio, '') AS bio,
        COALESCE(
          (SELECT array_agg(DISTINCT tag)
             FROM org_profiles op, unnest(op.tags) AS tag
            WHERE op.user_id = u.id),
          '{}'
        ) AS disciplines
      FROM users u
      LEFT JOIN LATERAL (
        SELECT o.id, o.slug, o.name
        FROM user_organizations uo
        JOIN organizations o ON o.id = uo.org_id
        WHERE uo.user_id = u.id
          AND uo.role IN ('owner', 'guide')
          AND o.id != 'elkdonis'
        LIMIT 1
      ) own_org ON true
      WHERE u.slug IS NOT NULL
        AND u.display_name IS NOT NULL
        AND u.entity_type = 'person'
      ORDER BY u.display_name ASC
      LIMIT ${limit}
    `;
  } catch (err) {
    console.error("[network] getMemberRoster:", err);
    return [];
  }
}

export type NetworkEvent = {
  id: string;
  title: string;
  kind: string;
  scheduled_at: string;
  format: "in_person" | "online" | "hybrid" | null;
  location: string | null;
  org_slug: string;
  org_name: string;
  city: string | null;
};

/**
 * Upcoming public events/workshops across every org, for grouping by city
 * on the newsroom/Network tab. Grouping happens in JS (simple reduce) —
 * kept out of SQL to leave "no city set" as a plain null bucket.
 */
export async function getNetworkUpcomingEvents(
  limit: number = 20
): Promise<NetworkEvent[]> {
  try {
    return await db<NetworkEvent[]>`
      SELECT
        t.id, t.title, t.kind, t.scheduled_at, t.format, t.location,
        o.slug AS org_slug, o.name AS org_name,
        ap.city
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      -- The city is the ORG's, from its own identity row (migration 099). This
      -- was a join to artist_profiles on org_id alone, which grouped the
      -- network events list by whichever member Postgres happened to pick.
      LEFT JOIN users ap ON ap.id = o.profile_user_id
      WHERE t.status = 'published'
        AND t.visibility = 'PUBLIC'
        AND t.kind IN ('event', 'workshop')
        AND t.scheduled_at IS NOT NULL
        AND t.scheduled_at > NOW()
      ORDER BY t.scheduled_at ASC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

/** Groups events by city, with unset cities collected under "Elsewhere". */
export function groupEventsByCity(
  events: NetworkEvent[]
): Record<string, NetworkEvent[]> {
  return events.reduce<Record<string, NetworkEvent[]>>((acc, ev) => {
    const key = ev.city?.trim() || "Elsewhere";
    (acc[key] ??= []).push(ev);
    return acc;
  }, {});
}

export type NetworkFeedItem = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  excerpt: string | null;
  body: string | null;
  org_slug: string;
  org_name: string;
  published_at: string | null;
  scheduled_at: string | null;
  view_count: number | null;
  reply_count: number | null;
};

/**
 * Richer cross-org feed for the newsroom front page (adds slug/view_count/
 * reply_count over community-feed.ts's getCommunityFeed, which stays as-is
 * since community/page.tsx and the old hub already depend on its shape).
 */
export async function getNetworkFrontFeed(
  limit: number = 20
): Promise<NetworkFeedItem[]> {
  try {
    return await db<NetworkFeedItem[]>`
      SELECT
        t.id, t.slug, t.title, t.kind, t.excerpt, t.body,
        o.slug AS org_slug, o.name AS org_name,
        t.published_at, t.scheduled_at, t.view_count, t.reply_count
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      WHERE t.status = 'published'
        AND t.visibility = 'PUBLIC'
        -- Without this the front page leads with whatever is newest, which
        -- included a member's personal writing post and a Pigeonshoot
        -- trading card. OFF_FEED_KINDS is the one place that decides what
        -- stays off feeds; getCommunityFeed in this same app already applied
        -- it and this query did not.
        AND t.kind <> ALL(${OFF_FEED_KINDS})
      ORDER BY t.pinned DESC, COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

export type NetworkCounts = {
  /** People with a public identity — what the roster lists. */
  members: number;
  /** Organisations past intake — what "member orgs" actually means. */
  orgs: number;
};

/**
 * How big the network is, counted rather than inferred.
 *
 * The masthead used to print `memberOrgs.length`, which is the LENGTH OF A
 * PAGE — `getMemberRoster(24)` — so it read "24 & growing" no matter how many
 * people there were, and it labelled people as organisations. Two different
 * numbers, neither of them the one on the page.
 */
export async function getNetworkCounts(): Promise<NetworkCounts> {
  try {
    const [row] = await db<Array<{ members: string; orgs: string }>>`
      SELECT
        (SELECT COUNT(*)::text FROM users
          WHERE slug IS NOT NULL AND display_name IS NOT NULL
            AND entity_type = 'person') AS members,
        (SELECT COUNT(*)::text FROM organizations
          WHERE subdomain_confirmed) AS orgs
    `;
    return { members: Number(row?.members ?? 0), orgs: Number(row?.orgs ?? 0) };
  } catch (err) {
    console.error("[network] getNetworkCounts:", err);
    return { members: 0, orgs: 0 };
  }
}
