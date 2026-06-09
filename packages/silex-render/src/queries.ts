import { db } from "@elkdonis/db";
import type { WorkshopPageData } from "@elkdonis/cms-bindings";

/**
 * Read-query subset needed to render a published org site + its live embeds.
 * Backed by @elkdonis/db. Kept self-contained so any app can render a site
 * without importing app-local libs. (Consolidating these into
 * @elkdonis/services is later cleanup.)
 *
 * NOTE: OrgSummary here intentionally omits the artist `profile` — the render
 * pipeline never reads it. Callers that pass a richer org object (e.g.
 * arts-collective's OrgSummary, which adds `profile`) are structurally
 * compatible.
 */

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  layout_mode: "default" | "silex";
  silex_project_path: string | null;
  silex_published_path: string | null;
  silex_published_at: string | null;
};

export async function getOrgBySlug(slug: string): Promise<OrgSummary | null> {
  try {
    try {
      const orgs = await db<OrgSummary[]>`
        SELECT
          id, name, slug, description,
          layout_mode, silex_project_path, silex_published_path, silex_published_at
        FROM organizations
        WHERE slug = ${slug}
        LIMIT 1
      `;
      if (orgs[0]) {
        return {
          ...orgs[0],
          layout_mode: orgs[0].layout_mode ?? "default",
          silex_project_path: orgs[0].silex_project_path ?? null,
          silex_published_path: orgs[0].silex_published_path ?? null,
          silex_published_at: orgs[0].silex_published_at ?? null,
        };
      }
      return null;
    } catch {
      // Pre-migration dev DBs won't have the silex columns yet.
      const orgs = await db<
        { id: string; name: string; slug: string; description: string | null }[]
      >`
        SELECT id, name, slug, description
        FROM organizations
        WHERE slug = ${slug}
        LIMIT 1
      `;
      const legacy = orgs[0];
      if (!legacy) return null;
      return {
        ...legacy,
        layout_mode: "default",
        silex_project_path: null,
        silex_published_path: null,
        silex_published_at: null,
      };
    }
  } catch {
    return null;
  }
}

export type OrgFeedSession = {
  id?: string;
  title?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  location?: string;
  meeting_url?: string;
};

export type OrgFeedItem = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  excerpt: string | null;
  body: string | null;
  pinned: boolean;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: "in_person" | "online" | "hybrid" | null;
  meeting_url: string | null;
  is_rsvp_enabled: boolean | null;
  attendee_limit: number | null;
  price: string | number | null;
  currency: string | null;
  sessions: OrgFeedSession[] | null;
  share_to_network: boolean | null;
  published_at: string | null;
  created_at: string;
  view_count: number | null;
  reply_count: number | null;
  nextcloud_talk_token: string | null;
  nextcloud_doc_url: string | null;
};

export async function getOrgFeed(
  orgId: string,
  limit: number = 20
): Promise<OrgFeedItem[]> {
  try {
    return await db<OrgFeedItem[]>`
      SELECT
        id, slug, title, kind, excerpt, body, pinned,
        scheduled_at, duration_minutes, location, format, meeting_url,
        is_rsvp_enabled, attendee_limit,
        price, currency, sessions, share_to_network,
        published_at, created_at,
        view_count, reply_count,
        nextcloud_talk_token, nextcloud_doc_url
      FROM threads
      WHERE org_id = ${orgId}
        AND status = 'published'
        AND visibility = 'PUBLIC'
      ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

/**
 * Primary workshop for an org — pinned first, then latest published. Used to
 * bind live DB values into data-trait slots in the published HTML.
 */
export async function getOrgWorkshopForTemplate(
  orgId: string
): Promise<WorkshopPageData | null> {
  try {
    const rows = await db<(WorkshopPageData & { org_id: string })[]>`
      SELECT
        t.id, t.slug, t.title, t.body,
        t.scheduled_at, t.duration_minutes, t.location, t.format,
        t.attendee_limit, t.price, t.currency, t.sessions,

        wp.subtitle, wp.description_short, wp.discipline, wp.series_label,
        wp.level, wp.language,
        wp.session_count, wp.session_duration_hrs,
        wp.recurrence_label, wp.location_address, wp.accessibility_notes,
        wp.price_sliding_min, wp.price_member, wp.sliding_scale_note,
        wp.registration_url, wp.registration_deadline, wp.registration_status,
        wp.author_note,
        wp.cover_image_url, wp.gallery_image_urls, wp.promo_video_url,
        wp.optional_sections,

        ap.display_name  AS facilitator_name,
        ap.bio           AS facilitator_bio,
        ap.photo_url     AS facilitator_photo,
        ap.pronouns      AS facilitator_pronouns,

        t.org_id
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      LEFT JOIN artist_profiles ap ON ap.org_id = t.org_id
      WHERE t.org_id   = ${orgId}
        AND t.kind      = 'workshop'
        AND t.status    = 'published'
        AND t.visibility = 'PUBLIC'
      ORDER BY t.pinned DESC, t.published_at DESC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { org_id: _, ...data } = row;
    return data as WorkshopPageData;
  } catch {
    return null;
  }
}

export type CommunityFeedItem = {
  id: string;
  title: string;
  kind: string;
  excerpt: string | null;
  orgSlug: string;
  orgName: string;
  publishedAt: string | null;
  scheduledAt: string | null;
};

export async function getCommunityFeed(
  limit: number = 12
): Promise<CommunityFeedItem[]> {
  try {
    const rows = await db<
      {
        id: string;
        title: string;
        kind: string;
        excerpt: string | null;
        org_slug: string;
        org_name: string;
        published_at: string | null;
        scheduled_at: string | null;
      }[]
    >`
      SELECT t.id, t.title, t.kind, t.excerpt,
             o.slug AS org_slug, o.name AS org_name,
             t.published_at, t.scheduled_at
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      WHERE t.status = 'published'
        AND t.visibility = 'PUBLIC'
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      excerpt: r.excerpt,
      orgSlug: r.org_slug,
      orgName: r.org_name,
      publishedAt: r.published_at,
      scheduledAt: r.scheduled_at,
    }));
  } catch {
    return [];
  }
}
