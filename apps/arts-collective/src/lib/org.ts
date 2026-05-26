import { db } from "@elkdonis/db";
import type { ArtistProfileRow } from "@/lib/profile";

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  layout_mode: "default" | "silex";
  silex_project_path: string | null;
  silex_published_path: string | null;
  silex_published_at: string | null;
  profile: ArtistProfileRow | null;
};

export async function getOrgBySlug(slug: string): Promise<OrgSummary | null> {
  try {
    let org:
      | {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          layout_mode: "default" | "silex";
          silex_project_path: string | null;
          silex_published_path: string | null;
          silex_published_at: string | null;
        }
      | undefined;

    try {
      const orgs = await db<
        {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          layout_mode: "default" | "silex";
          silex_project_path: string | null;
          silex_published_path: string | null;
          silex_published_at: string | null;
        }[]
      >`
        SELECT
          id,
          name,
          slug,
          description,
          layout_mode,
          silex_project_path,
          silex_published_path,
          silex_published_at
        FROM organizations
        WHERE slug = ${slug}
        LIMIT 1
      `;
      org = orgs[0];
    } catch {
      // Pre-migration dev DBs won't have these columns yet.
      const orgs = await db<
        { id: string; name: string; slug: string; description: string | null }[]
      >`
        SELECT id, name, slug, description
        FROM organizations
        WHERE slug = ${slug}
        LIMIT 1
      `;
      const legacyOrg = orgs[0];
      if (legacyOrg) {
        org = {
          ...legacyOrg,
          layout_mode: "default",
          silex_project_path: null,
          silex_published_path: null,
          silex_published_at: null,
        };
      }
    }

    if (!org) return null;

    let profile: ArtistProfileRow | null = null;
    try {
      const rows = await db<ArtistProfileRow[]>`
        SELECT * FROM artist_profiles WHERE org_id = ${org.id} LIMIT 1
      `;
      profile = rows[0] ?? null;
    } catch {
      profile = null;
    }

    return {
      ...org,
      layout_mode: org.layout_mode ?? "default",
      silex_project_path: org.silex_project_path ?? null,
      silex_published_path: org.silex_published_path ?? null,
      silex_published_at: org.silex_published_at ?? null,
      profile,
    };
  } catch {
    return null;
  }
}

export async function isOrgOwner(
  userId: string,
  orgId: string
): Promise<boolean> {
  try {
    const rows = await db<{ role: string }[]>`
      SELECT role FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${orgId}
      LIMIT 1
    `;
    if (rows[0]?.role === "owner") return true;

    const mappedRows = await db<{ role: string }[]>`
      SELECT uo.role
      FROM users u
      JOIN user_organizations uo ON uo.user_id = u.id
      WHERE u.auth_user_id = ${userId} AND uo.org_id = ${orgId}
      LIMIT 1
    `;
    return mappedRows[0]?.role === "owner";
  } catch {
    return false;
  }
}

export async function canEditOrgSite(
  userId: string,
  orgId: string
): Promise<boolean> {
  try {
    const rows = await db<{ role: string }[]>`
      SELECT role FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${orgId}
      LIMIT 1
    `;
    if (rows[0]?.role === "owner" || rows[0]?.role === "admin") return true;

    const mappedRows = await db<{ role: string }[]>`
      SELECT uo.role
      FROM users u
      JOIN user_organizations uo ON uo.user_id = u.id
      WHERE u.auth_user_id = ${userId} AND uo.org_id = ${orgId}
      LIMIT 1
    `;
    return mappedRows[0]?.role === "owner" || mappedRows[0]?.role === "admin";
  } catch {
    return false;
  }
}

export type EditableOrg = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin";
  nextcloud_folder_path: string | null;
  layout_mode: "default" | "silex";
  silex_published_path: string | null;
};

export async function getEditableOrgsForUser(
  userId: string
): Promise<EditableOrg[]> {
  try {
    return await db<EditableOrg[]>`
      WITH candidate_users AS (
        SELECT ${userId}::text AS id
        UNION
        SELECT id FROM users WHERE auth_user_id = ${userId}
      )
      SELECT DISTINCT ON (o.id)
        o.id,
        o.name,
        o.slug,
        uo.role,
        o.nextcloud_folder_path,
        o.layout_mode,
        o.silex_published_path
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.org_id
      WHERE uo.user_id IN (SELECT id FROM candidate_users)
        AND uo.role IN ('owner', 'admin')
      ORDER BY
        o.id,
        CASE uo.role WHEN 'owner' THEN 2 WHEN 'admin' THEN 1 ELSE 0 END DESC
    `;
  } catch {
    try {
      return await db<EditableOrg[]>`
        SELECT DISTINCT ON (o.id)
          o.id,
          o.name,
          o.slug,
          uo.role,
          o.nextcloud_folder_path,
          o.layout_mode,
          o.silex_published_path
        FROM user_organizations uo
        JOIN organizations o ON o.id = uo.org_id
        WHERE uo.user_id = ${userId}
          AND uo.role IN ('owner', 'admin')
        ORDER BY
          o.id,
          CASE uo.role WHEN 'owner' THEN 2 WHEN 'admin' THEN 1 ELSE 0 END DESC
      `;
    } catch {
      return [];
    }
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

export async function getFeaturedThread(
  orgId: string
): Promise<OrgFeedItem | null> {
  try {
    const rows = await db<OrgFeedItem[]>`
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
        AND pinned = true
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Workshop-specific queries ────────────────────────────────────────────────

export type WorkshopListItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  // sidecar (may be null if row not yet created)
  registration_status: string | null;
  discipline: string | null;
};

export async function getWorkshopThreadsForOrg(
  orgId: string
): Promise<WorkshopListItem[]> {
  try {
    return await db<WorkshopListItem[]>`
      SELECT
        t.id, t.slug, t.title, t.status, t.scheduled_at,
        wp.registration_status, wp.discipline
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.org_id = ${orgId} AND t.kind = 'workshop'
      ORDER BY COALESCE(t.scheduled_at, t.created_at) DESC
    `;
  } catch {
    return [];
  }
}

import type { WorkshopPageData } from "@/lib/cms/workshop-render";

export type WorkshopPageDataWithTheme = WorkshopPageData & {
  theme_overrides: Record<string, string> | null;
};

/**
 * Returns the primary workshop for an org — pinned first, then latest published.
 * Used by SilexLayout to bind live DB values into a Silex-published page.
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

export async function getThreadWithWorkshopPage(
  orgId: string,
  slug: string
): Promise<WorkshopPageDataWithTheme | null> {
  try {
    type Row = WorkshopPageDataWithTheme & { org_id: string };
    const rows = await db<Row[]>`
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
        COALESCE(wp.theme_overrides, '{}') AS theme_overrides,

        ap.display_name  AS facilitator_name,
        ap.bio           AS facilitator_bio,
        ap.photo_url     AS facilitator_photo,
        ap.pronouns      AS facilitator_pronouns,

        t.org_id
      FROM threads t
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      LEFT JOIN artist_profiles ap ON ap.org_id = t.org_id
      WHERE t.org_id = ${orgId}
        AND t.slug    = ${slug}
        AND t.kind    = 'workshop'
        AND t.status  = 'published'
        AND t.visibility = 'PUBLIC'
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { org_id: _, ...data } = row;
    return data as WorkshopPageDataWithTheme;
  } catch {
    return null;
  }
}
