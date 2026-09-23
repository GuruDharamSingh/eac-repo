import { db } from "@elkdonis/db";
import {
  getViewerRoles,
  getOrgFeed,
  canPostToFeed,
  listTopics,
  listUserMemberships,
  type ForumViewer,
  type ForumTopicRow,
} from "@elkdonis/services";
import { getNetworkFrontFeed, type NetworkFeedItem } from "@/lib/network";

/**
 * Data for the Elkdonis hub tab (/hub/elkdonis).
 *
 * Everything the tab shows about the collective itself lives in three forum
 * categories on the `elkdonis` org (migration 138): Announcements (only
 * stewards start topics), Feedback and Cross-post suggestions (anyone signed
 * in). "Stewards" are the owners and guides of `inner_group`, applied through
 * `organizations.steward_org_id` in services' getViewerRoles, so the forum and
 * this tab agree on who may post without a second roster.
 */

export const ELKDONIS_ORG = "elkdonis";

export const ELKDONIS_FEEDS = {
  announcements: "announcements",
  feedback: "feedback",
  crossPosts: "cross-posts",
} as const;

export type ElkdonisFeedSlug = (typeof ELKDONIS_FEEDS)[keyof typeof ELKDONIS_FEEDS];

/**
 * The public forum's base URL. The container has no FORUM_URL of its own, so
 * this falls back by host: a localhost network means the local forum on 3003,
 * anything else the live forum.
 */
export function forumBase(): string {
  const explicit = process.env.NEXT_PUBLIC_FORUM_URL ?? process.env.FORUM_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "";
  return host.startsWith("localhost") ? "http://localhost:3003" : "https://forum.arts-collective.com";
}

/** Sophia's configured address (NEXT_PUBLIC_SOPHIA_URL), or the local one in dev. */
export function sophiaBase(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SOPHIA_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "";
  return host.startsWith("localhost") ? "http://localhost:3020" : null;
}

let sophiaSeen: { at: number; up: boolean } | null = null;
/**
 * Sophia's address, but only while it actually answers — the hub must never
 * send members to a dead host, and the proxy for sophia.arts-collective.com
 * did not exist when this was written. Checked at most once every two
 * minutes, with a two-second budget; the button appears by itself the first
 * time the site is reachable.
 */
export async function sophiaLive(): Promise<string | null> {
  const base = sophiaBase();
  if (!base) return null;
  if (!sophiaSeen || Date.now() - sophiaSeen.at > 120_000) {
    let up = false;
    try {
      const res = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
      up = res.ok;
    } catch { /* unreachable */ }
    sophiaSeen = { at: Date.now(), up };
  }
  return sophiaSeen.up ? base : null;
}

export const forumHref = {
  feed: (slug: string) => `${forumBase()}/o/${ELKDONIS_ORG}/${slug}`,
  thread: (id: string, slug: string) => `${forumBase()}/t/${id}/${slug}`,
};

export async function forumViewerFor(userId: string): Promise<ForumViewer> {
  return { userId, roles: await getViewerRoles(userId) };
}

export type ViewerCard = {
  displayName: string;
  avatarUrl: string | null;
  slug: string | null;
  email: string;
  memberships: Array<{ orgName: string; orgSlug: string; role: string }>;
  /** Steward of the collective — owner/guide of inner_group, via migration 138. */
  isSteward: boolean;
  joinedAt: Date | null;
};

export async function getViewerCard(
  userId: string,
  email: string,
  viewer: ForumViewer,
): Promise<ViewerCard> {
  const [[row], memberships] = await Promise.all([
    db<Array<{ display_name: string | null; avatar_url: string | null; slug: string | null; created_at: Date | null }>>`
      SELECT display_name, avatar_url, slug, created_at FROM users WHERE id = ${userId}
    `,
    listUserMemberships(userId),
  ]);
  const feed = await getOrgFeed(ELKDONIS_ORG, ELKDONIS_FEEDS.announcements);
  return {
    displayName: row?.display_name?.trim() || email.split("@")[0],
    avatarUrl: row?.avatar_url ?? null,
    slug: row?.slug ?? null,
    email,
    memberships: memberships.map((m) => ({ orgName: m.orgName, orgSlug: m.orgSlug, role: m.role })),
    isSteward: feed ? canPostToFeed(feed, viewer.roles[ELKDONIS_ORG] ?? null) : false,
    joinedAt: row?.created_at ?? null,
  };
}

export async function getElkdonisTopics(
  feedSlug: ElkdonisFeedSlug,
  viewer: ForumViewer,
  limit: number,
  sort: "active" | "newest" = "newest",
): Promise<{ rows: ForumTopicRow[]; total: number }> {
  try {
    const page = await listTopics({ kind: "feed", orgId: ELKDONIS_ORG, feedSlug }, viewer, { limit, sort });
    return { rows: page.rows, total: page.total };
  } catch (err) {
    console.error("[elkdonis-hub] getElkdonisTopics:", feedSlug, err);
    return { rows: [], total: 0 };
  }
}

/**
 * What the promotion column slides through: recent public work from member
 * sites OTHER than the collective's own categories — the point of the space
 * is to carry one org's news to the rest of the network.
 */
export async function getCrossPostCandidates(limit = 8): Promise<NetworkFeedItem[]> {
  const feed = await getNetworkFrontFeed(limit * 3);
  // Standing meetings repeat their title every occurrence; one slide each.
  const seen = new Set<string>();
  return feed
    .filter((f) => {
      const key = `${f.org_slug}:${f.title?.trim().toLowerCase()}`;
      if (f.org_slug === ELKDONIS_ORG || !f.title?.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
