import { db } from "@elkdonis/db";
import { getOrgRole, hasOrgRole } from "@elkdonis/services";
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
  subdomain_confirmed: boolean;
  tier: string;
  /** Service-account path (EAC_Network/<org>). Null until first provisioning —
   *  the hub shows that state rather than pretending the folder exists. */
  nextcloud_folder_path: string | null;
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
          subdomain_confirmed: boolean;
          tier: string;
          nextcloud_folder_path: string | null;
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
          subdomain_confirmed: boolean;
          tier: string;
          nextcloud_folder_path: string | null;
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
          silex_published_at,
          subdomain_confirmed,
          tier,
          nextcloud_folder_path
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
          subdomain_confirmed: true,
          tier: "free",
          nextcloud_folder_path: null,
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
      // Default TRUE on a pre-082 database: the gate is opt-in, and a missing
      // column must never hide a site that is already live.
      subdomain_confirmed: org.subdomain_confirmed ?? true,
      tier: org.tier ?? "free",
      nextcloud_folder_path: org.nextcloud_folder_path ?? null,
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
    return (await getOrgRole(userId, orgId)) === "owner";
  } catch {
    return false;
  }
}

/**
 * Owners and guides can edit/post on the org's behalf — guide is the "next
 * higher" role an owner promotes a member to (edit/post rights, short of
 * full ownership). This previously checked for a role value of 'admin',
 * which the database's own CHECK constraint never allowed (owner/guide/
 * member/viewer only) — that branch could never match anything.
 */
export async function canEditOrgSite(
  userId: string,
  orgId: string
): Promise<boolean> {
  try {
    return await hasOrgRole(userId, orgId, ["owner", "guide"]);
  } catch {
    return false;
  }
}

export type EditableOrg = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "guide";
  nextcloud_folder_path: string | null;
  layout_mode: "default" | "silex";
  silex_published_path: string | null;
};

export async function getEditableOrgsForUser(
  userId: string
): Promise<EditableOrg[]> {
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
        AND uo.role IN ('owner', 'guide')
      ORDER BY
        o.id,
        CASE uo.role WHEN 'owner' THEN 2 WHEN 'guide' THEN 1 ELSE 0 END DESC
    `;
  } catch {
    return [];
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
 * The org's one featured thread — what /offering promotes.
 *
 * Pinned wins; with nothing pinned it falls back to the most recent published
 * thread, so an org's landing page is never blank just because nobody has
 * used the pin toggle yet (at the time this was written, no org in the
 * network had pinned anything at all). Pinning stays the deliberate override.
 */
export async function getOfferingThread(
  orgId: string
): Promise<OrgFeedItem | null> {
  const pinned = await getFeaturedThread(orgId);
  if (pinned) return pinned;
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
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
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

export type OrgAnnouncement = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  pinned: boolean;
  published_at: string | null;
  created_at: string;
};

/**
 * Guide/owner-only announcements for an org. Reuses `threads` with
 * kind='post', visibility='ORGANIZATION' rather than a dedicated table —
 * the existing CreateContentDialog + createThreadAction already write and
 * gate this shape (canEditOrgSite), so no migration is needed.
 */
export async function getOrgAnnouncements(
  orgId: string,
  limit: number = 10
): Promise<OrgAnnouncement[]> {
  try {
    return await db<OrgAnnouncement[]>`
      SELECT id, slug, title, excerpt, body, pinned, published_at, created_at
      FROM threads
      WHERE org_id = ${orgId}
        AND kind = 'post'
        AND visibility = 'ORGANIZATION'
        AND status = 'published'
      ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC
      LIMIT ${limit}
    `;
  } catch {
    return [];
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
