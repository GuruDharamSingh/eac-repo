// ============================================================================
// The Education Hub around the courses: Inner/Outer, guides, traditions, and
// the weekly schedule of a site's offerings (migration 177). Offerings are
// the network's threads; the hub reads them and keeps only its own choices.
// ============================================================================
import { db } from '@elkdonis/db';
import { expandOccurrences } from '@elkdonis/utils';
import type { LmsViewer, WriteResult } from './types';
import { canEditCourse, getCourseById } from './content';
import { isOrgStaff, newId, slugify } from './util';

export type Realm = 'inner' | 'outer';
export type RealmItemKind = 'course' | 'thread';
const REALMS: Realm[] = ['inner', 'outer'];
const asRealm = (v: unknown): Realm | null => (REALMS.includes(v as Realm) ? (v as Realm) : null);

/** Organisers: anyone who runs an org (owner/guide, stewardship applied) or a site admin. */
export function canCurateHub(viewer: LmsViewer): boolean {
  return Boolean(viewer.userId) && (Boolean(viewer.isGlobalAdmin) || Object.keys(viewer.roles).some((o) => isOrgStaff(viewer, o)));
}

// ── Inner / Outer ──────────────────────────────────────────────────────────
export async function getRealms(kind: RealmItemKind, ids: string[]): Promise<Map<string, Realm>> {
  if (!ids.length) return new Map();
  const rows = await db<Array<{ item_id: string; realm: Realm }>>`
    SELECT item_id, realm FROM lms_realms WHERE item_kind = ${kind} AND item_id = ANY(${ids})
  `;
  return new Map(rows.map((r) => [r.item_id, r.realm]));
}

/** An item shows on a side when it is sorted there, or not sorted at all. */
export const onSide = (realm: Realm | null | undefined, side: Realm | null) => !side || !realm || realm === side;

/** Sort one item. `realm` null clears it, so it shows on both sides again. */
export async function setRealm(viewer: LmsViewer, kind: RealmItemKind, id: string, realm: Realm | null): Promise<WriteResult> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  if (kind === 'course') {
    const course = await getCourseById(id);
    if (!course || !(await canEditCourse(viewer, course))) return { ok: false, error: 'You can’t change this course.' };
  } else {
    const [t] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${id}`;
    if (!t || !isOrgStaff(viewer, t.org_id)) return { ok: false, error: 'That isn’t yours to sort.' };
  }
  if (realm === null) {
    await db`DELETE FROM lms_realms WHERE item_kind = ${kind} AND item_id = ${id}`;
  } else {
    await db`
      INSERT INTO lms_realms (item_kind, item_id, realm, updated_by) VALUES (${kind}, ${id}, ${realm}, ${viewer.userId})
      ON CONFLICT (item_kind, item_id) DO UPDATE SET realm = EXCLUDED.realm, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
  }
  return { ok: true };
}

// ── traditions ─────────────────────────────────────────────────────────────
export interface Tradition { id: string; slug: string; name: string; description: string | null }

export async function listTraditions(): Promise<Tradition[]> {
  return [...(await db<Tradition[]>`SELECT id, slug, name, description FROM lms_traditions ORDER BY sort_order, name`)];
}

export async function saveTradition(viewer: LmsViewer, input: { id?: string; name: string; description: string | null }): Promise<WriteResult> {
  if (!canCurateHub(viewer)) return { ok: false, error: 'Only organisers can change traditions.' };
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Give the tradition a name.' };
  const description = input.description?.trim() || null;
  if (input.id) {
    const upd = await db`UPDATE lms_traditions SET name = ${name}, description = ${description}, updated_by = ${viewer.userId}, updated_at = NOW() WHERE id = ${input.id} RETURNING id`;
    return upd.length ? { ok: true } : { ok: false, error: 'No such tradition.' };
  }
  let slug = slugify(name) || newId().toLowerCase();
  const [taken] = await db`SELECT 1 FROM lms_traditions WHERE slug = ${slug}`;
  if (taken) slug = `${slug}-${newId().slice(0, 4).toLowerCase()}`;
  await db`INSERT INTO lms_traditions (id, slug, name, description, updated_by) VALUES (${newId()}, ${slug}, ${name}, ${description}, ${viewer.userId})`;
  return { ok: true };
}

export async function deleteTradition(viewer: LmsViewer, id: string): Promise<WriteResult> {
  if (!canCurateHub(viewer)) return { ok: false, error: 'Only organisers can change traditions.' };
  await db`DELETE FROM lms_traditions WHERE id = ${id}`;
  return { ok: true };
}

// ── guides ─────────────────────────────────────────────────────────────────
export interface Guide {
  userId: string; slug: string | null; name: string;
  /** The hub's own bio, else the account's. */
  bio: string | null;
  photoUrl: string | null;
  realm: Realm | null; isListed: boolean;
  traditions: Array<{ id: string; slug: string; name: string }>;
}

export async function listGuides(opts: { listedOnly?: boolean } = {}): Promise<Guide[]> {
  const rows = await db<Array<{
    user_id: string; slug: string | null; name: string | null; bio: string | null; photo_url: string | null;
    realm: Realm | null; is_listed: boolean; traditions: Guide['traditions'] | null;
  }>>`
    SELECT g.user_id, u.slug, u.display_name AS name, COALESCE(g.bio, u.bio) AS bio, COALESCE(g.photo_url, u.avatar_url) AS photo_url,
           g.realm, g.is_listed,
           (SELECT json_agg(json_build_object('id', t.id, 'slug', t.slug, 'name', t.name) ORDER BY t.sort_order, t.name)
              FROM lms_guide_traditions gt JOIN lms_traditions t ON t.id = gt.tradition_id WHERE gt.user_id = g.user_id) AS traditions
    FROM lms_guides g JOIN users u ON u.id = g.user_id
    ${opts.listedOnly ? db`WHERE g.is_listed` : db``}
    ORDER BY g.sort_order, u.display_name
  `;
  return rows.map((r) => ({
    userId: r.user_id, slug: r.slug, name: r.name ?? 'A guide', bio: r.bio, photoUrl: r.photo_url,
    realm: r.realm, isListed: r.is_listed, traditions: r.traditions ?? [],
  }));
}

/** Add someone who already has an account. */
export async function addGuideByEmail(viewer: LmsViewer, email: string): Promise<WriteResult> {
  if (!canCurateHub(viewer)) return { ok: false, error: 'Only organisers can add guides.' };
  const [u] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = lower(${email.trim()})`;
  if (!u) return { ok: false, error: 'No account has that email. They need to sign up on the network first.' };
  await db`INSERT INTO lms_guides (user_id, updated_by) VALUES (${u.id}, ${viewer.userId}) ON CONFLICT (user_id) DO NOTHING`;
  return { ok: true };
}

export async function saveGuide(viewer: LmsViewer, userId: string, input: { bio: string | null; photoUrl: string | null; realm: Realm | null; isListed: boolean; traditionIds: string[] }): Promise<WriteResult> {
  if (!canCurateHub(viewer)) return { ok: false, error: 'Only organisers can change guides.' };
  let photo = input.photoUrl?.trim() || null;
  if (photo) {
    try {
      const u = new URL(photo, 'https://x.invalid');
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
      return { ok: false, error: 'The photo must be a web address (https://…) or a path on this site.' };
    }
  }
  const result = await db.begin(async (tx) => {
    const upd = await tx`
      UPDATE lms_guides SET bio = ${input.bio?.trim() || null}, photo_url = ${photo}, realm = ${asRealm(input.realm)},
        is_listed = ${input.isListed}, updated_by = ${viewer.userId}, updated_at = NOW()
      WHERE user_id = ${userId} RETURNING user_id
    `;
    if (!upd.length) return false;
    await tx`DELETE FROM lms_guide_traditions WHERE user_id = ${userId}`;
    const ids = [...new Set(input.traditionIds)].filter(Boolean);
    if (ids.length) {
      await tx`INSERT INTO lms_guide_traditions (user_id, tradition_id) SELECT ${userId}, id FROM lms_traditions WHERE id = ANY(${ids})`;
    }
    return true;
  });
  return result ? { ok: true } : { ok: false, error: 'That person isn’t on the guide list.' };
}

export async function removeGuide(viewer: LmsViewer, userId: string): Promise<WriteResult> {
  if (!canCurateHub(viewer)) return { ok: false, error: 'Only organisers can change guides.' };
  await db`DELETE FROM lms_guides WHERE user_id = ${userId}`;
  return { ok: true };
}

// ── the weekly schedule ────────────────────────────────────────────────────
export interface Offering {
  id: string; slug: string; kind: string; title: string; excerpt: string | null;
  orgId: string; orgSlug: string; primaryDomain: string | null;
  scheduledAt: Date | null; recurrencePattern: string | null; recurrenceUntil: Date | null; durationMinutes: number | null;
  format: string | null; location: string | null; leader: string | null;
  realm: Realm | null;
}

/** A site's published, public offerings: the threads in one of its feeds. */
export async function listOfferings(source: { orgId: string; section: string }): Promise<Offering[]> {
  const rows = await db<Array<{
    id: string; slug: string; kind: string; title: string; excerpt: string | null; org_id: string; org_slug: string; primary_domain: string | null;
    scheduled_at: Date | null; recurrence_pattern: string | null; recurrence_until: Date | null; duration_minutes: number | null;
    format: string | null; location: string | null; leader: string | null; realm: Realm | null;
  }>>`
    SELECT t.id, t.slug, t.kind, t.title, t.excerpt, t.org_id, o.slug AS org_slug,
           (SELECT d.domain FROM org_domains d WHERE d.org_id = o.id AND d.is_primary AND d.verified_at IS NOT NULL LIMIT 1) AS primary_domain,
           t.scheduled_at, t.recurrence_pattern, t.recurrence_until, t.duration_minutes, t.format, t.location,
           u.display_name AS leader, r.realm
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN users u ON u.id = t.author_id
    LEFT JOIN lms_realms r ON r.item_kind = 'thread' AND r.item_id = t.id
    WHERE t.org_id = ${source.orgId} AND t.section = ${source.section}
      AND t.status = 'published' AND upper(t.visibility) = 'PUBLIC'
    ORDER BY t.scheduled_at NULLS LAST, t.title
  `;
  return rows.map((r) => ({
    id: r.id, slug: r.slug, kind: r.kind, title: r.title, excerpt: r.excerpt, orgId: r.org_id, orgSlug: r.org_slug, primaryDomain: r.primary_domain,
    scheduledAt: r.scheduled_at, recurrencePattern: r.recurrence_pattern, recurrenceUntil: r.recurrence_until, durationMinutes: r.duration_minutes,
    format: r.format, location: r.location, leader: r.leader, realm: r.realm,
  }));
}

/** Every occurrence of the offerings in [from, to), respecting each one's end date. */
export function scheduleBetween(offerings: Offering[], from: Date, to: Date): Array<{ offering: Offering; at: Date }> {
  return expandOccurrences(offerings, from, to)
    .filter(({ item, at }) => !item.recurrenceUntil || at.getTime() <= new Date(item.recurrenceUntil).getTime())
    .map(({ item, at }) => ({ offering: item, at }));
}
