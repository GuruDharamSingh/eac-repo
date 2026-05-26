import { db } from "@elkdonis/db";
import { isAdmin, type Session } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";
import { defaultEvents, defaultSiteContent } from "@/lib/default-content";
import type { IfacContact, IfacSiteContent, IfacUser, PublicEvent } from "@/lib/types";

const SECTION_KEYS = [
  "hero",
  "about",
  "signup",
  "rsvp",
  "gallery",
  "dealers",
  "blog",
  "videos",
  "social",
  "embeds",
  "footer",
] as const;

export type IfacSectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: string): value is IfacSectionKey {
  return SECTION_KEYS.includes(value as IfacSectionKey);
}

export async function getSiteContent(): Promise<IfacSiteContent> {
  try {
    const rows = await db<{ section_key: IfacSectionKey; content: unknown }[]>`
      SELECT section_key, content
      FROM org_site_sections
      WHERE org_id = ${siteConfig.orgId}
    `;

    const content: IfacSiteContent = structuredClone(defaultSiteContent);
    for (const row of rows) {
      if (isSectionKey(row.section_key)) {
        content[row.section_key] = {
          ...content[row.section_key],
          ...(typeof row.content === "object" && row.content !== null ? row.content : {}),
        } as never;
      }
    }
    return content;
  } catch (error) {
    console.error("[ifac] getSiteContent error:", error);
    return defaultSiteContent;
  }
}

export async function getUpcomingEvents(limit = 6): Promise<PublicEvent[]> {
  try {
    const rows = await db<PublicEvent[]>`
      SELECT
        t.id,
        t.title,
        t.slug,
        t.body,
        t.location,
        t.scheduled_at,
        t.duration_minutes,
        t.is_online,
        t.meeting_url,
        t.attendee_limit,
        COUNT(gs.id)::int AS rsvp_count
      FROM threads t
      LEFT JOIN guest_submissions gs ON gs.thread_id = t.id AND gs.kind = 'rsvp'
      WHERE t.org_id = ${siteConfig.orgId}
        AND t.kind IN ('event', 'meeting', 'workshop')
        AND t.status = 'published'
        AND (t.scheduled_at IS NULL OR t.scheduled_at >= NOW() - INTERVAL '12 hours')
      GROUP BY t.id
      ORDER BY t.scheduled_at ASC NULLS LAST, t.created_at DESC
      LIMIT ${limit}
    `;
    return rows.length > 0 ? rows : defaultEvents;
  } catch (error) {
    console.error("[ifac] getUpcomingEvents error:", error);
    return defaultEvents;
  }
}

export async function getContacts(limit = 40): Promise<IfacContact[]> {
  try {
    return db<IfacContact[]>`
      SELECT id, email, name, message, status, source, created_at
      FROM contacts
      WHERE org_id = ${siteConfig.orgId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } catch (error) {
    console.error("[ifac] getContacts error:", error);
    return [];
  }
}

export async function getIfacUsers(limit = 80): Promise<IfacUser[]> {
  try {
    return db<IfacUser[]>`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.is_admin,
        uo.role,
        uo.joined_at
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${siteConfig.orgId}
      ORDER BY uo.joined_at DESC
      LIMIT ${limit}
    `;
  } catch (error) {
    console.error("[ifac] getIfacUsers error:", error);
    return [];
  }
}

export async function canManageIfac(session: Session): Promise<boolean> {
  if (!session.user) return false;
  if (siteConfig.ownerEmails.includes(session.user.email)) return true;
  if (await isAdmin(session.user.id)) return true;

  const userId = session.user.db_user_id ?? session.user.id;
  try {
    const [membership] = await db<{ role: string }[]>`
      SELECT role
      FROM user_organizations
      WHERE user_id = ${userId}
        AND org_id = ${siteConfig.orgId}
        AND role IN ('owner', 'guide')
      LIMIT 1
    `;
    return Boolean(membership);
  } catch (error) {
    console.error("[ifac] canManageIfac error:", error);
    return false;
  }
}

export function formatEventDate(value: string | null): string {
  if (!value) return "Date to be announced";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
