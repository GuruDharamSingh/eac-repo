import { db } from "@elkdonis/db";
import {
  getMeetingSeries,
  getMeetingSeriesWeek,
  getPresentedSeriesId,
  getStandingMeetingId,
  isSubscribedToSeries,
  type MeetingSeries,
  type SeriesReader,
  type SeriesSession,
} from "@elkdonis/services";
import type { SeriesSite } from "../config";

type Viewer = NonNullable<Awaited<ReturnType<SeriesSite["getViewer"]>>>;

/**
 * Who is asking, for the audience rule (members-only series; services
 * meeting-series.ts `SeriesReader`): the request's forum viewer, else a
 * signed-out visitor.
 */
export async function readerOf(site: SeriesSite): Promise<SeriesReader> {
  try {
    return await site.getForumViewer();
  } catch {
    return null;
  }
}

/**
 * The series an org presents on its landing page: `site_config` key
 * `presented_series`, falling back to the org's standing meeting. Kept
 * separate from the standing meeting on purpose: the collective's own
 * weekly meeting and the series it presents to the public are different
 * gatherings.
 */
export async function getPresentedSeries(site: SeriesSite, options: { count?: number } = {}): Promise<MeetingSeries | null> {
  const id =
    (await getPresentedSeriesId(site.orgId).catch(() => null)) ??
    (await getStandingMeetingId(site.orgId).catch(() => null));
  if (!id) return null;
  return getMeetingSeries(site.orgId, { threadId: id }, { count: options.count ?? 6, viewer: await readerOf(site) }).catch(() => null);
}

export async function getSeriesBySlug(site: SeriesSite, slug: string, options: { count?: number; pastCount?: number } = {}): Promise<MeetingSeries | null> {
  return getMeetingSeries(site.orgId, { slug }, { count: options.count ?? 8, pastCount: options.pastCount ?? 0, viewer: await readerOf(site) }).catch(() => null);
}

/**
 * Week `n` of a series with the weeks around it, for `/series/<slug>/<n>`.
 * Resolves by the week's stored number (`series_sessions`, migration 203)
 * first, then by the series rule, so a link keeps pointing at the same week
 * after a move or a schedule change.
 */
export async function getSeriesWeek(
  site: SeriesSite,
  slug: string,
  n: number
): Promise<{ series: MeetingSeries; week: SeriesSession } | null> {
  return getMeetingSeriesWeek(site.orgId, { slug }, n, { count: 13, pastCount: 12, viewer: await readerOf(site) }).catch(() => null);
}

/**
 * A cancelled week that had been published: its page stays reachable from
 * links already sent and says it is cancelled, with no RSVP or join link.
 */
export function isAnnouncedCancellation(week: SeriesSession): boolean {
  return week.isCancelled && Boolean(week.publishedAt && week.title);
}

export interface HostCard {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** The host's page here (`site.hostHref`) when the host has a public page here. */
  href: string | null;
  roleTitle: string | null;
}

/** Portraits and page links for the people hosting the loaded weeks. */
export async function hostCards(site: SeriesSite, series: MeetingSeries): Promise<Record<string, HostCard>> {
  const ids = Array.from(
    new Set(
      series.sessions.flatMap((s) => [s.host?.userId, s.coHost?.userId]).filter((id): id is string => Boolean(id))
    )
  );
  if (ids.length === 0) return {};
  const rows = await db<
    Array<{ id: string; display_name: string | null; avatar_url: string | null; slug: string | null; tags: string[] | null; is_public: boolean | null; role_title: string | null }>
  >`
    SELECT u.id, u.display_name, u.avatar_url, u.slug, p.tags, p.is_public, p.role_title
    FROM users u
    LEFT JOIN org_profiles p ON p.user_id = u.id AND p.org_id = ${site.orgId}
    WHERE u.id = ANY(${ids}::uuid[])
  `;
  const out: Record<string, HostCard> = {};
  for (const r of rows) {
    out[r.id] = {
      userId: r.id,
      name: r.display_name ?? site.shortName,
      avatarUrl: r.avatar_url,
      href: r.is_public && r.slug ? site.hostHref({ slug: r.slug, tags: r.tags ?? [] }) : null,
      roleTitle: r.role_title,
    };
  }
  return out;
}

// ─── Drafts, materials, subscriptions (2026-10-10) ───────────────────────────
//
// Drafts: a week shows on the public pages and in mail only once it has a
// title and an organiser has published it (`SeriesSession.isPublished`, from
// `series_sessions.published_at`, migration 203). Everything else is a draft,
// seen only in the planner and by the week's host on its page. A cancelled
// week is never `isPublished`, so every list built on it skips it; a moved
// week's `at` is its new time.

/** The weeks the public may see, in order. */
export function publicSessions(series: MeetingSeries): SeriesSession[] {
  return series.sessions.filter((s) => s.isPublished);
}

/**
 * The week a public page leads with: the first coming week that is
 * published. A draft "this week" is skipped rather than shown empty; null
 * when nothing coming is published, and the page falls back to the series'
 * own description.
 */
export function nextPublicSession(series: MeetingSeries): SeriesSession | null {
  return series.sessions.find((s) => !s.isPast && s.isPublished) ?? null;
}

/** Whether the viewer may open this week while it is a draft: an organiser, or its host or co-host. */
export function canSeeDraftWeek(viewer: Viewer | null, week: SeriesSession): boolean {
  if (!viewer) return false;
  return viewer.canEdit || week.host?.userId === viewer.userId || week.coHost?.userId === viewer.userId;
}

/**
 * Materials (developer decision 2026-10-10): signed-in viewers with any role in
 * the org, `viewer` included. Signed-out visitors and signed-in people with no
 * role see a locked line instead, and the page carries no links.
 */
export function canSeeMaterials(viewer: Viewer | null): boolean {
  return Boolean(viewer && viewer.role !== null);
}

/** Whether this user follows the series (status `subscribed` on its own thread, migration 202). */
export async function isViewerSubscribed(series: MeetingSeries, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return isSubscribedToSeries(series.id, userId).catch(() => false);
}

/**
 * The org's series, by the rule the reminder tick uses: published, recurring,
 * kind `series` / `meeting` / `event`, and either kind `series`,
 * `metadata.series` set, or the presented series. Null for another org's id.
 */
export async function findOrgSeries(site: SeriesSite, id: string): Promise<{ id: string; title: string } | null> {
  const presented = await getPresentedSeriesId(site.orgId).catch(() => null);
  const [row] = await db<Array<{ id: string; title: string }>>`
    SELECT id, title FROM threads
    WHERE org_id = ${site.orgId}
      AND id = ${id}
      AND status = 'published'
      AND kind IN ('series', 'meeting', 'event')
      AND recurrence_pattern IS NOT NULL
      AND (kind = 'series' OR metadata ? 'series' OR id = ${presented ?? ""})
  `;
  return row ?? null;
}
