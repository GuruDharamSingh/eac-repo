// ============================================================================
// Workshops in the Education Hub. A workshop is the network's (threads
// kind='workshop' + workshop_pages + workshop_sessions); the hub only keeps
// its own choices in lms_workshop_listings (migration 175) and links out to
// each workshop's page. It never takes a booking or a payment itself.
// ============================================================================
import { db } from '@elkdonis/db';
import type { LmsViewer, WriteResult } from './types';
import { isOrgStaff } from './util';

export type WorkshopAfterAccess = 'none' | 'free' | 'paid';

export interface HubWorkshop {
  id: string; slug: string; title: string; summary: string | null; coverUrl: string | null;
  orgId: string; orgSlug: string; orgName: string;
  /** The org's verified primary domain, when it has one. The host builds the page link from this. */
  primaryDomain: string | null;
  status: string;
  startsAt: Date | null;
  /** End of the last session; null when the workshop has no date yet. */
  endsAt: Date | null;
  sessionCount: number;
  price: number | null; currency: string;
  listed: boolean; afterAccess: WorkshopAfterAccess; afterPrice: number | null; linkOverride: string | null;
}

interface Row {
  id: string; slug: string; title: string; summary: string | null; cover_url: string | null;
  org_id: string; org_slug: string; org_name: string; primary_domain: string | null; status: string;
  starts_at: Date | null; ends_at: Date | null; session_count: number; price: string | null; currency: string | null;
  listed: boolean | null; after_access: WorkshopAfterAccess | null; after_price: string | null; link_override: string | null;
}

// Dates come from workshop_sessions when there are any, else the thread's own schedule.
const SELECT = db`
  t.id, t.slug, t.title, COALESCE(wp.description_short, t.excerpt) AS summary,
  COALESCE(wp.cover_image_url, wp.banner_image_url) AS cover_url,
  t.org_id, o.slug AS org_slug, o.name AS org_name,
  (SELECT d.domain FROM org_domains d WHERE d.org_id = o.id AND d.is_primary AND d.verified_at IS NOT NULL LIMIT 1) AS primary_domain,
  t.status,
  COALESCE((SELECT MIN(s.scheduled_at) FROM workshop_sessions s WHERE s.thread_id = t.id), t.scheduled_at) AS starts_at,
  COALESCE(
    (SELECT MAX(s.scheduled_at + make_interval(mins => COALESCE(s.duration_minutes, 0))) FROM workshop_sessions s WHERE s.thread_id = t.id),
    t.scheduled_at + make_interval(mins => COALESCE(t.duration_minutes, 0))
  ) AS ends_at,
  (SELECT COUNT(*)::int FROM workshop_sessions s WHERE s.thread_id = t.id) AS session_count,
  COALESCE(wp.price_member, t.price) AS price, t.currency,
  l.listed, l.after_access, l.after_price, l.link_override
`;

const num = (v: string | null) => (v === null ? null : Number(v));
const map = (r: Row): HubWorkshop => ({
  id: r.id, slug: r.slug, title: r.title, summary: r.summary, coverUrl: r.cover_url,
  orgId: r.org_id, orgSlug: r.org_slug, orgName: r.org_name, primaryDomain: r.primary_domain, status: r.status,
  startsAt: r.starts_at, endsAt: r.ends_at, sessionCount: r.session_count,
  price: num(r.price), currency: r.currency ?? 'USD',
  listed: Boolean(r.listed), afterAccess: r.after_access ?? 'none', afterPrice: num(r.after_price), linkOverride: r.link_override,
});

/**
 * What the hub's Workshops page shows. Coming up: listed, published, not yet
 * ended (undated counts as coming up). Previous: listed, ended, and offered
 * afterwards — archived workshops included, since a past workshop is often
 * archived on its own site but still worth taking up.
 */
export async function listHubWorkshops(now: Date = new Date()): Promise<{ upcoming: HubWorkshop[]; previous: HubWorkshop[] }> {
  const rows = await db<Row[]>`
    SELECT ${SELECT}
    FROM lms_workshop_listings l
    JOIN threads t ON t.id = l.thread_id AND t.kind = 'workshop'
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE l.listed AND t.status IN ('published', 'archived')
  `;
  const all = rows.map(map);
  const ended = (w: HubWorkshop) => w.endsAt !== null && w.endsAt.getTime() < now.getTime();
  const upcoming = all
    .filter((w) => w.status === 'published' && !ended(w))
    .sort((a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity));
  const previous = all
    .filter((w) => ended(w) && w.afterAccess !== 'none')
    .sort((a, b) => b.endsAt!.getTime() - a.endsAt!.getTime());
  return { upcoming, previous };
}

/** Workshops this viewer may list in the hub: every published or archived workshop in an org they run. */
export async function listManageableWorkshops(viewer: LmsViewer): Promise<HubWorkshop[]> {
  if (!viewer.userId) return [];
  const staffOrgs = Object.keys(viewer.roles).filter((o) => isOrgStaff(viewer, o));
  if (!viewer.isGlobalAdmin && staffOrgs.length === 0) return [];
  const rows = await db<Row[]>`
    SELECT ${SELECT}
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    LEFT JOIN lms_workshop_listings l ON l.thread_id = t.id
    WHERE t.kind = 'workshop' AND t.status IN ('published', 'archived')
      ${viewer.isGlobalAdmin ? db`` : db`AND t.org_id = ANY(${staffOrgs})`}
    ORDER BY starts_at DESC NULLS FIRST
  `;
  return rows.map(map);
}

export interface WorkshopListingInput {
  listed: boolean;
  afterAccess: WorkshopAfterAccess;
  afterPrice: number | null;
  linkOverride: string | null;
}

export async function setWorkshopListing(viewer: LmsViewer, threadId: string, input: WorkshopListingInput): Promise<WriteResult> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  const [t] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${threadId} AND kind = 'workshop'`;
  if (!t || !isOrgStaff(viewer, t.org_id)) return { ok: false, error: 'That workshop isn’t yours to list.' };
  if (!['none', 'free', 'paid'].includes(input.afterAccess)) return { ok: false, error: 'Choose what it offers once it has ended.' };
  const afterPrice = input.afterAccess === 'paid' ? input.afterPrice : null;
  if (input.afterAccess === 'paid' && !(afterPrice && afterPrice > 0)) return { ok: false, error: 'Give a price for the recordings, or choose free.' };
  let link: string | null = input.linkOverride?.trim() || null;
  if (link) {
    try {
      const u = new URL(link);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
      link = u.toString();
    } catch {
      return { ok: false, error: 'The link to its page must be a web address (https://…).' };
    }
  }
  await db`
    INSERT INTO lms_workshop_listings (thread_id, listed, after_access, after_price, link_override, updated_by, updated_at)
    VALUES (${threadId}, ${input.listed}, ${input.afterAccess}, ${afterPrice}, ${link}, ${viewer.userId}, NOW())
    ON CONFLICT (thread_id) DO UPDATE SET
      listed = EXCLUDED.listed, after_access = EXCLUDED.after_access, after_price = EXCLUDED.after_price,
      link_override = EXCLUDED.link_override, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
  return { ok: true };
}
