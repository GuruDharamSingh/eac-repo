import { db } from '@elkdonis/db';

// ============================================================================
// Featured person (2026-11-06): who a block on a site page shows, read per
// request from what the platform already stores. A page keeps only a
// reference:
//
//   user:<uuid>                 this person
//   thread:<id>:author          whoever is the thread's author (threads.author_id)
//   thread:<id>:next-host       the person in the next upcoming meeting_hosts row of
//                               the thread or of its series' sessions, with that
//                               row's stored role
//   thread:<id>:next-guide      the guide of the tour's next scheduled departure
//                               (tour_departures.guide_user_id)
//
// No roles are made up: the labels are the stored ones. People who RSVP'd are
// not offered. A person is shown only with a public profile in the site's org
// (org_profiles.is_public) and as a person (users.entity_type: elktours' places are
// organisation profiles in the same roster); a thread is read only when it is the org's,
// published, PUBLIC and without a minimum role. Anything else draws nothing.
// Server only: it imports the database client.
// ============================================================================

export type PersonFollow = 'author' | 'next-host' | 'next-guide';

export interface FeaturedPerson {
  userId: string;
  /** For a link to the person's page on the site; the host decides the path. */
  slug: string | null;
  displayName: string;
  /** org_profiles.role_title, as stored. */
  roleTitle: string | null;
  bio: string | null;
  photoUrl: string | null;
  city: string | null;
  /** Present when the reference follows a record: the stored role and when. */
  via?: { label: string; at: string | null; thread: string };
}

export interface PersonSource {
  /** "org", or "thread:<id>". */
  ref: string;
  label: string;
  hint?: string;
}

export interface PersonChoice {
  /** What the page stores. */
  value: string;
  label: string;
  hint?: string;
  /** Changes by itself as the record changes. */
  follows?: boolean;
  /** Listed so an owner sees why someone is missing; cannot be chosen. */
  disabled?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THREAD_ID = /^[A-Za-z0-9_-]{1,21}$/;
/** Kinds that are not a record with people of their own: a session is reached through its series. Tours and experiences are, though OFF_FEED_KINDS lists them. */
const NOT_A_SOURCE = ['wiki_page', 'document', 'series_session'];
const FOLLOWS: readonly PersonFollow[] = ['author', 'next-host', 'next-guide'];

export type PersonRef = { user: string } | { thread: string; follow: PersonFollow };

/** The stored string, read strictly. Anything else is not a reference. */
export function parsePersonRef(ref: unknown): PersonRef | null {
  if (typeof ref !== 'string') return null;
  const s = ref.trim();
  if (s.startsWith('user:')) {
    const id = s.slice(5);
    return UUID.test(id) ? { user: id.toLowerCase() } : null;
  }
  const m = /^thread:([^:]+):([a-z-]+)$/.exec(s);
  if (!m || !THREAD_ID.test(m[1]) || !FOLLOWS.includes(m[2] as PersonFollow)) return null;
  return { thread: m[1], follow: m[2] as PersonFollow };
}

/** A media path without a Private/ segment is public; one with it never goes on a page. */
const publicPicture = (url: string | null) => (url && !/(^|\/)Private\//.test(url) ? url : null);

const shortDate = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;

/** The org's public threads only: the same rule a signed-out visitor is held to. */
async function publicThread(orgId: string, id: string) {
  const [t] = await db<{ id: string; title: string; kind: string; author_id: string }[]>`
    SELECT id, title, kind, author_id FROM threads
    WHERE id = ${id} AND org_id = ${orgId}
      AND status = 'published' AND visibility = 'PUBLIC' AND min_role IS NULL
    LIMIT 1
  `;
  return t ?? null;
}

type ProfileRow = {
  user_id: string; slug: string | null; display_name: string; role_title: string | null;
  bio: string | null; photo: string | null; city: string | null; is_public: boolean | null; entity_type: string | null;
};

/** People with their profile in this org, public or not (the caller decides what a visitor gets). */
async function profiles(orgId: string, userIds: string[]): Promise<Map<string, ProfileRow>> {
  if (!userIds.length) return new Map();
  const rows = await db<ProfileRow[]>`
    SELECT u.id AS user_id, u.slug, u.display_name, op.role_title, u.bio,
           COALESCE(op.photo_override, u.avatar_url) AS photo, u.city, op.is_public, u.entity_type
    FROM users u
    LEFT JOIN org_profiles op ON op.user_id = u.id AND op.org_id = ${orgId}
    WHERE u.id = ANY(${userIds}::uuid[])
  `;
  return new Map(rows.map((r) => [r.user_id, r]));
}

const toPerson = (r: ProfileRow, via?: FeaturedPerson['via']): FeaturedPerson => ({
  userId: r.user_id,
  slug: r.slug,
  displayName: r.display_name,
  roleTitle: r.role_title,
  bio: r.bio,
  photoUrl: publicPicture(r.photo),
  city: r.city,
  ...(via ? { via } : {}),
});

/** Upcoming hosts of a thread or of its series' sessions, soonest first, with their stored role. */
async function upcomingHosts(orgId: string, threadId: string, limit: number) {
  return db<{ user_id: string; role: string; at: Date }[]>`
    SELECT mh.user_id, mh.role, mh.occurrence_at AS at
    FROM meeting_hosts mh
    WHERE mh.user_id IS NOT NULL AND mh.occurrence_at >= now()
      AND (mh.thread_id = ${threadId}
           OR mh.thread_id IN (SELECT session_thread_id FROM series_sessions
                               WHERE series_id = ${threadId} AND org_id = ${orgId} AND status = 'scheduled'))
    ORDER BY mh.occurrence_at, (mh.role = 'host') DESC, mh.role
    LIMIT ${limit}
  `;
}

async function upcomingGuides(orgId: string, threadId: string, limit: number) {
  return db<{ user_id: string; at: Date }[]>`
    SELECT guide_user_id AS user_id, starts_at AS at
    FROM tour_departures
    WHERE thread_id = ${threadId} AND org_id = ${orgId} AND status = 'scheduled'
      AND starts_at >= now() AND guide_user_id IS NOT NULL
    ORDER BY starts_at
    LIMIT ${limit}
  `;
}

/** Who a stored reference shows today, or null: nothing is drawn then. */
export async function resolveFeaturedPerson(orgId: string, ref: unknown): Promise<FeaturedPerson | null> {
  const r = parsePersonRef(ref);
  if (!r) return null;
  try {
    let userId: string | null = null;
    let via: FeaturedPerson['via'];
    if ('user' in r) userId = r.user;
    else {
      const t = await publicThread(orgId, r.thread);
      if (!t) return null;
      if (r.follow === 'author') {
        userId = t.author_id;
        via = { label: 'author', at: null, thread: t.title };
      } else if (r.follow === 'next-host') {
        const [h] = await upcomingHosts(orgId, t.id, 1);
        if (h) { userId = h.user_id; via = { label: h.role, at: shortDate(h.at), thread: t.title }; }
      } else {
        const [g] = await upcomingGuides(orgId, t.id, 1);
        if (g) { userId = g.user_id; via = { label: 'guide', at: shortDate(g.at), thread: t.title }; }
      }
    }
    if (!userId) return null;
    const p = (await profiles(orgId, [userId])).get(userId);
    return p?.is_public && p.entity_type === 'person' ? toPerson(p, via) : null;
  } catch (err) {
    console.error(`[featured-people] resolve(${orgId}):`, err);
    return null;
  }
}

/** Step one of the chooser: this site's people, or a record of the org's that has people on it. */
export async function listPersonSources(orgId: string): Promise<PersonSource[]> {
  const out: PersonSource[] = [{ ref: 'org', label: 'People of this site', hint: 'Anyone with a public profile here' }];
  try {
    const rows = await db<{ id: string; title: string; kind: string }[]>`
      SELECT id, title, kind FROM threads
      WHERE org_id = ${orgId} AND status = 'published' AND visibility = 'PUBLIC' AND min_role IS NULL
        AND kind <> ALL(${NOT_A_SOURCE})
      ORDER BY (kind IN ('series', 'tour', 'event')) DESC, COALESCE(published_at, created_at) DESC
      LIMIT 200
    `;
    for (const t of rows) out.push({ ref: `thread:${t.id}`, label: t.title, hint: t.kind });
  } catch (err) {
    console.error(`[featured-people] sources(${orgId}):`, err);
  }
  return out;
}

/** Step two: who that source has, as stored, plus the choices that follow it. */
export async function listPersonChoices(orgId: string, source: unknown): Promise<PersonChoice[]> {
  const notPublic = 'No public profile on this site';
  try {
    if (source === 'org') {
      const rows = await db<{ user_id: string; display_name: string; role_title: string | null }[]>`
        SELECT op.user_id, u.display_name, op.role_title
        FROM org_profiles op JOIN users u ON u.id = op.user_id
        WHERE op.org_id = ${orgId} AND op.is_public AND u.entity_type = 'person'
        ORDER BY op.sort_order, u.display_name
      `;
      return rows.map((r) => ({ value: `user:${r.user_id}`, label: r.display_name, ...(r.role_title ? { hint: r.role_title } : {}) }));
    }
    const m = typeof source === 'string' ? /^thread:([A-Za-z0-9_-]{1,21})$/.exec(source) : null;
    const t = m ? await publicThread(orgId, m[1]) : null;
    if (!t) return [];
    const [hosts, guides] = await Promise.all([upcomingHosts(orgId, t.id, 40), upcomingGuides(orgId, t.id, 40)]);
    // Each person once, with the stored relation (author, the role on a session, guide) and the soonest date.
    const people = new Map<string, string[]>();
    const add = (id: string, what: string) => { const l = people.get(id) ?? []; if (!l.includes(what)) l.push(what); people.set(id, l); };
    add(t.author_id, 'author');
    for (const h of hosts) add(h.user_id, `${h.role}, ${shortDate(h.at)}`);
    for (const g of guides) add(g.user_id, `guide, ${shortDate(g.at)}`);
    const found = await profiles(orgId, [...people.keys()]);
    const p = (id: string | undefined) => (id ? found.get(id) : undefined);

    const out: PersonChoice[] = [];
    const follow = (follow: PersonFollow, label: string, now: ProfileRow | undefined, none: string) =>
      out.push({ value: `thread:${t.id}:${follow}`, label, follows: true, hint: now ? `Now: ${now.display_name}${now.is_public ? '' : ` (${notPublic.toLowerCase()})`}` : none });
    follow('author', 'Its author', p(t.author_id), 'No author');
    if (hosts.length) follow('next-host', 'Host of the next session', p(hosts[0].user_id), 'No one is down to host yet');
    if (guides.length) follow('next-guide', 'Guide of the next departure', p(guides[0].user_id), 'No guide assigned yet');
    for (const [id, what] of people) {
      const r = found.get(id);
      if (!r) continue;
      out.push({
        value: `user:${id}`,
        label: r.display_name,
        hint: r.is_public ? what.slice(0, 3).join(' · ') : notPublic,
        ...(r.is_public ? {} : { disabled: true }),
      });
    }
    return out;
  } catch (err) {
    console.error(`[featured-people] choices(${orgId}):`, err);
    return [];
  }
}
