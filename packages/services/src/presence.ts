import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import {
  EVENT_KINDS,
  SERVICE_KINDS,
  PERSON_SECTIONS,
  PERSON_SECTION_LABELS,
  resolvePersonSections,
  setPersonOrgSection,
  type PersonSection,
  type PersonSectionState,
} from './person-page';
import { PERSONAL_ORG_ID } from './thread-listing';
import { OFF_FEED_KINDS } from './thread-kinds';

// ============================================================================
// Where you show — the person's own switches for where they appear.
//
// One read (`loadPresence`) and one write (`setPresence`), both for the
// signed-in person only: the caller passes the viewer's own id and nothing
// here takes a target user. Every cell is bound to a column that already
// exists (Brief A, 2026-09-18); there is no schema of its own.
//
//   you × directory       users.directory_listed            switch
//   you × org X           org_profiles.is_public (org X)    hide freely; to be
//                                                            SHOWN, ask (user's
//                                                            call, option 3)
//   blog × your page      users.profile_sections.blog       switch
//   store × your page     users.profile_sections.store      switch (needs an
//                                                            active store)
//   store × market        store.status                      status: reviewers
//                                                            decide, not you
//   galleries × your page profile_sections.galleries +      switch
//                         user_galleries.is_public
//   galleries × org X     org_profiles.sections.galleries   switch (see the
//                         + user_galleries.hidden_on ∋ X    galleries note in
//                                                            setPresence)
//   S × org X             org_profiles.sections[S]          switch, for every
//                         (migration 166)                    person-page section
//                                                            S the org offers
//
// Section rows (person pages, 2026-09-26; docs/open/PERSON_PAGES_BRIEF_2026-09-26.md)
// follow PERSON_SECTIONS. A row appears only when it has something to show:
// portfolio items, posts, events, a store, galleries. `blog` keeps its row
// always, as before. The `page` column of blog/store/galleries stays the
// network default in users.profile_sections; the new rows (portfolio, posts,
// events) have org cells only, since ArtDirect has no switch for them yet.
// An org cell shows the effective state on that org (resolvePersonSections →
// `on`) and a flip writes an explicit override (setPersonOrgSection), so it
// stops following the network default for that org.
//
// A request to be shown is a row in `org_listing_requests` (migration 149)
// plus a `listing_request` notification to the org's owners and guides, who
// approve it with `decideListingRequest`. Members are shown by default: the
// 149 trigger publishes a row when someone becomes a member, unless they hid
// themselves (`org_profiles.self_hidden`).
//
// Deliberately NOT upsertOrgProfile for is_public: it resets sort_order and
// is_public whenever a field is omitted (see profiles.ts). The org write here
// touches is_public and nothing else.
// ============================================================================

export type PresenceRowKey = 'you' | PersonSection;

/** Row keys setPresence accepts; for the routes' allow-lists. */
export const PRESENCE_ROW_KEYS: readonly PresenceRowKey[] = ['you', ...PERSON_SECTIONS];

export interface PresenceColumn {
  /** 'directory' | 'page' | 'market' | `org:<orgId>` */
  key: string;
  label: string;
  kind: 'directory' | 'page' | 'org' | 'market';
  orgId?: string;
  orgSlug?: string;
}

export type PresenceCell =
  /** The person flips it. */
  | { state: 'switch'; on: boolean; note?: string | null }
  /** Off, and turning it on needs someone else: ask, or already asked. */
  | { state: 'request'; pending: boolean; note?: string | null }
  /** Read-only: somebody else's decision, stated plainly. */
  | { state: 'status'; label: string; note?: string | null };

export interface PresenceRow {
  key: PresenceRowKey;
  label: string;
  /** Keyed by column key. A missing key means the pair does not apply. */
  cells: Record<string, PresenceCell>;
}

export interface Presence {
  columns: PresenceColumn[];
  rows: PresenceRow[];
}

export interface PresenceChange {
  row: PresenceRowKey;
  column: string;
  on: boolean;
}

export type SetPresenceResult =
  | { ok: true; pending?: boolean }
  | { ok: false; error: string };

/** Roles whose people an org lists. A follower (viewer) is not on a roster. */
const LISTED_ROLES = ['member', 'guide', 'owner'];

/** Row labels: "Your <section>", from PERSON_SECTION_LABELS. */
const ROW_LABELS = Object.fromEntries(
  PERSON_SECTIONS.map((k) => [k, `Your ${PERSON_SECTION_LABELS[k].toLowerCase()}`])
) as Record<PersonSection, string>;

/** One org's section switch for this person, or nothing when the org does not offer it. */
function sectionCell(states: PersonSectionState[] | undefined, key: PersonSection): PresenceCell | null {
  const st = states?.find((x) => x.key === key);
  if (!st || !st.offered) return null;
  return {
    state: 'switch',
    on: st.on,
    note: st.orgOverride === null ? null : 'Set for this site',
  };
}

async function listedOrgs(userId: string) {
  return db<Array<{ org_id: string; org_name: string; org_slug: string; role: string; is_public: boolean | null }>>`
    SELECT uo.org_id, o.name AS org_name, o.slug AS org_slug, uo.role, op.is_public
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.org_id
      LEFT JOIN org_profiles op ON op.org_id = uo.org_id AND op.user_id = uo.user_id
     WHERE uo.user_id = ${userId} AND uo.role = ANY(${LISTED_ROLES})
     ORDER BY o.name
  `;
}

async function pendingRequests(userId: string): Promise<Set<string>> {
  const rows = await db<Array<{ org_id: string }>>`
    SELECT org_id FROM org_listing_requests WHERE user_id = ${userId} AND status = 'pending'
  `;
  return new Set(rows.map((r) => r.org_id));
}

async function organisers(orgId: string): Promise<string[]> {
  const rows = await db<Array<{ user_id: string }>>`
    SELECT user_id FROM user_organizations
     WHERE org_id = ${orgId} AND role IN ('owner', 'guide')
  `;
  return rows.map((r) => r.user_id);
}

const STORE_LABEL: Record<string, { label: string; note: string }> = {
  active: { label: 'Listed', note: 'Your store is open in the marketplace.' },
  pending: { label: 'Awaiting review', note: 'A reviewer opens new stores.' },
  paused: { label: 'Paused', note: 'Paused by the marketplace reviewers.' },
  rejected: { label: 'Not accepted', note: 'Apply again from your store.' },
};

export async function loadPresence(userId: string): Promise<Presence> {
  const [[user], orgs, pending, stores, galleries] = await Promise.all([
    db<Array<{
      directory_listed: boolean | null;
      profile_sections: Record<string, unknown> | null;
      slug: string | null;
      portfolio_count: number;
      has_posts: boolean;
      has_events: boolean;
      has_services: boolean;
    }>>`
      SELECT u.directory_listed, u.profile_sections, u.slug,
             CASE WHEN jsonb_typeof(u.portfolio) = 'array' THEN jsonb_array_length(u.portfolio) ELSE 0 END AS portfolio_count,
             EXISTS (SELECT 1 FROM threads t WHERE t.author_id = u.id AND t.status <> 'archived'
                       AND t.kind <> ALL(${OFF_FEED_KINDS}) AND t.kind <> ALL(${EVENT_KINDS})
                       AND t.kind <> ALL(${SERVICE_KINDS})) AS has_posts,
             EXISTS (SELECT 1 FROM threads t WHERE t.author_id = u.id AND t.status <> 'archived'
                       AND t.kind = ANY(${EVENT_KINDS})) AS has_events,
             EXISTS (SELECT 1 FROM threads t WHERE t.author_id = u.id AND t.status <> 'archived'
                       AND t.kind = ANY(${SERVICE_KINDS})) AS has_services
        FROM users u WHERE u.id = ${userId} LIMIT 1
    `,
    listedOrgs(userId),
    pendingRequests(userId),
    db<Array<{ status: string }>>`
      SELECT status FROM store WHERE owner_user_id = ${userId}
      ORDER BY (status = 'active') DESC, joined_at LIMIT 1
    `,
    db<Array<{ is_public: boolean; hidden_on: string[] }>>`
      SELECT is_public, hidden_on FROM user_galleries WHERE user_id = ${userId}
    `,
  ]);
  if (!user) return { columns: [], rows: [] };

  const sections = user.profile_sections ?? {};
  const store = stores[0] ?? null;

  // Per-org section states. Only orgs where the person has an org_profiles
  // row: setPersonOrgSection writes that row and nothing else. `is_public`
  // comes from a LEFT JOIN, so null means no row.
  const sectionOrgs = orgs.filter((o) => o.is_public !== null && o.org_id !== PERSONAL_ORG_ID);
  const sectionStates = new Map(
    await Promise.all(
      sectionOrgs.map(async (o) => [o.org_id, await resolvePersonSections(userId, o.org_id)] as const)
    )
  );
  /** Add one org cell per org that offers `key`. */
  const addOrgCells = (cells: Record<string, PresenceCell>, key: PersonSection) => {
    for (const o of sectionOrgs) {
      const cell = sectionCell(sectionStates.get(o.org_id), key);
      if (cell) cells[`org:${o.org_id}`] = cell;
    }
    return cells;
  };

  const columns: PresenceColumn[] = [
    { key: 'directory', label: 'Network directory', kind: 'directory' },
    { key: 'page', label: 'Your page', kind: 'page' },
    ...orgs.map((o) => ({
      key: `org:${o.org_id}`,
      label: o.org_name,
      kind: 'org' as const,
      orgId: o.org_id,
      orgSlug: o.org_slug,
    })),
    ...(store ? [{ key: 'market', label: 'Marketplace', kind: 'market' as const }] : []),
  ];

  const rows: PresenceRow[] = [];

  // You — the person themselves.
  const you: PresenceRow = { key: 'you', label: 'You', cells: {} };
  you.cells.directory = {
    state: 'switch',
    on: user.directory_listed !== false,
    note: user.slug ? null : 'You need a page address first.',
  };
  for (const o of orgs) {
    you.cells[`org:${o.org_id}`] = o.is_public
      ? { state: 'switch', on: true }
      : { state: 'request', pending: pending.has(o.org_id) };
  }
  rows.push(you);

  const byKey = new Map<PersonSection, PresenceRow>();

  // Featured work — the portfolio on the person's profile.
  if (user.portfolio_count > 0) {
    const cells = addOrgCells({}, 'portfolio');
    if (Object.keys(cells).length) byKey.set('portfolio', { key: 'portfolio', label: ROW_LABELS.portfolio, cells });
  }

  // Blog — the writing shelf on your own page.
  byKey.set('blog', {
    key: 'blog',
    label: ROW_LABELS.blog,
    cells: addOrgCells({ page: { state: 'switch', on: sections.blog === true || sections.blog === 'true' } }, 'blog'),
  });

  // Posts and events — the person's threads homed on or listed on each org.
  if (user.has_posts) {
    const cells = addOrgCells({}, 'posts');
    if (Object.keys(cells).length) byKey.set('posts', { key: 'posts', label: ROW_LABELS.posts, cells });
  }
  if (user.has_events) {
    const cells = addOrgCells({}, 'events');
    if (Object.keys(cells).length) byKey.set('events', { key: 'events', label: ROW_LABELS.events, cells });
  }
  if (user.has_services) {
    const cells = addOrgCells({}, 'services');
    if (Object.keys(cells).length) byKey.set('services', { key: 'services', label: ROW_LABELS.services, cells });
  }

  // Store — only when there is one; a section with nothing returns nothing.
  if (store) {
    const s = STORE_LABEL[store.status] ?? { label: store.status, note: '' };
    const cells: Record<string, PresenceCell> = {
      page:
        store.status === 'active'
          ? { state: 'switch', on: sections.store === true || sections.store === 'true' }
          : { state: 'status', label: 'Not yet', note: 'Shows once the store is open.' },
      market: { state: 'status', label: s.label, note: s.note },
    };
    // Org pages show a store only once it is open, as the page cell does.
    if (store.status === 'active') addOrgCells(cells, 'store');
    byKey.set('store', { key: 'store', label: ROW_LABELS.store, cells });
  }

  // Galleries — all of them together; per-gallery control stays in the gallery.
  if (galleries.length > 0) {
    const publicCount = galleries.filter((g) => g.is_public).length;
    // Your page shows galleries only when its galleries SECTION is on (the
    // ArtDirect dossier gates on profile_sections.galleries) AND a gallery
    // is public — so "shown" needs both.
    const sectionOn = sections.galleries === true || sections.galleries === 'true';
    const cells: Record<string, PresenceCell> = {
      page: {
        state: 'switch',
        on: sectionOn && publicCount > 0,
        note:
          publicCount === galleries.length || publicCount === 0
            ? `${galleries.length} ${galleries.length === 1 ? 'gallery' : 'galleries'}`
            : `${publicCount} of ${galleries.length} shown`,
      },
    };
    // Every org (the GALLERY_SITES = {'ifac'} limit is gone): getPersonPage
    // reads galleries with `site = orgId`, so hidden_on applies on every org
    // page. Shown on X = the section on for X AND at least one gallery not
    // hidden on X.
    for (const o of sectionOrgs) {
      const st = sectionStates.get(o.org_id)?.find((x) => x.key === 'galleries');
      if (!st || !st.offered) continue;
      const hidden = galleries.filter((g) => (g.hidden_on ?? []).includes(o.org_id)).length;
      cells[`org:${o.org_id}`] = {
        state: 'switch',
        on: st.on && hidden < galleries.length,
        note: hidden > 0 && hidden < galleries.length ? `${galleries.length - hidden} of ${galleries.length} shown` : null,
      };
    }
    byKey.set('galleries', { key: 'galleries', label: ROW_LABELS.galleries, cells });
  }

  for (const key of PERSON_SECTIONS) {
    const row = byKey.get(key);
    if (row) rows.push(row);
  }

  return { columns, rows };
}

/**
 * Apply one change for the signed-in person. Re-reads the matrix and refuses
 * anything that is not a switch or a request in it, so a crafted request can
 * only ever do what the panel offered.
 */
export async function setPresence(userId: string, change: PresenceChange): Promise<SetPresenceResult> {
  const presence = await loadPresence(userId);
  const row = presence.rows.find((r) => r.key === change.row);
  const cell = row?.cells[change.column];
  if (!row || !cell || cell.state === 'status') return { ok: false, error: 'That cannot be changed here.' };

  const orgId = change.column.startsWith('org:') ? change.column.slice(4) : null;

  if (cell.state === 'request') {
    if (!change.on || !orgId) return { ok: false, error: 'That cannot be changed here.' };
    if (cell.pending) return { ok: true, pending: true };
    const to = await organisers(orgId);
    if (to.length === 0) return { ok: false, error: 'This organisation has no organiser to ask yet.' };
    const [org] = await db<Array<{ name: string }>>`SELECT name FROM organizations WHERE id = ${orgId}`;
    const requestId = nanoid();
    await db.begin(async (tx) => {
      // A draft row, hidden, so the organiser has something to publish.
      await tx`
        INSERT INTO org_profiles (org_id, user_id, is_public) VALUES (${orgId}, ${userId}, FALSE)
        ON CONFLICT (org_id, user_id) DO NOTHING
      `;
      const [made] = await tx<Array<{ id: string }>>`
        INSERT INTO org_listing_requests (id, org_id, user_id) VALUES (${requestId}, ${orgId}, ${userId})
        ON CONFLICT (org_id, user_id) WHERE status = 'pending' DO NOTHING
        RETURNING id
      `;
      if (!made) return; // already pending: no second round of notifications
      for (const recipient of to) {
        if (recipient === userId) continue;
        await tx`
          INSERT INTO notifications (id, user_id, kind, actor_id, data)
          VALUES (${nanoid()}, ${recipient}, 'listing_request', ${userId},
                  ${tx.json({ orgId, orgName: org?.name ?? orgId, requestId })})
        `;
      }
    });
    return { ok: true, pending: true };
  }

  // A switch.
  const on = Boolean(change.on);
  switch (change.row) {
    case 'you':
      if (change.column === 'directory') {
        await db`UPDATE users SET directory_listed = ${on}, updated_at = NOW() WHERE id = ${userId}`;
        return { ok: true };
      }
      if (orgId) {
        // Only ever OFF from here: a public row is the only switch this
        // column offers (option 3). Showing again goes through a request.
        if (on) return { ok: false, error: 'Ask the organisers to show you again.' };
        // self_hidden: the person's own choice, which a later promotion must
        // not undo (the migration 149 trigger checks it).
        await db`
          UPDATE org_profiles SET is_public = FALSE, self_hidden = TRUE
           WHERE org_id = ${orgId} AND user_id = ${userId}
        `;
        return { ok: true };
      }
      break;
    case 'portfolio':
    case 'posts':
    case 'events':
      if (orgId) return setPersonOrgSection(userId, orgId, change.row, on);
      break;
    case 'blog':
    case 'store':
      if (orgId) return setPersonOrgSection(userId, orgId, change.row, on);
      if (change.column === 'page') {
        const key = change.row;
        await db`
          UPDATE users
             SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || jsonb_build_object(${key}::text, ${on}::boolean),
                 updated_at = NOW()
           WHERE id = ${userId}
        `;
        return { ok: true };
      }
      break;
    case 'galleries':
      if (change.column === 'page') {
        // On: the section on, and every gallery public. Off: only the section
        // off, so each gallery's own public/private choice survives.
        await db.begin(async (tx) => {
          await tx`
            UPDATE users
               SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || jsonb_build_object('galleries', ${on}::boolean),
                   updated_at = NOW()
             WHERE id = ${userId}
          `;
          if (on) await tx`UPDATE user_galleries SET is_public = TRUE, updated_at = NOW() WHERE user_id = ${userId}`;
        });
        return { ok: true };
      }
      if (orgId) {
        // Galleries on org X: both the section override and hidden_on are
        // written, so readers of either agree (IFAC's gallery reader checks
        // hidden_on only; getPersonPage checks both). On clears X from every
        // gallery's hidden_on, as before; off hides every gallery on X.
        const section = await setPersonOrgSection(userId, orgId, 'galleries', on);
        if (section.ok === false) return section;
        if (on) {
          await db`
            UPDATE user_galleries SET hidden_on = array_remove(hidden_on, ${orgId}::text), updated_at = NOW()
             WHERE user_id = ${userId}
          `;
        } else {
          await db`
            UPDATE user_galleries SET hidden_on = array_append(hidden_on, ${orgId}::text), updated_at = NOW()
             WHERE user_id = ${userId} AND NOT (${orgId}::text = ANY(hidden_on))
          `;
        }
        return { ok: true };
      }
      break;
  }
  return { ok: false, error: 'That cannot be changed here.' };
}

// ============================================================================
// The organiser's side: who is asking to be shown, and the answer.
// ============================================================================

export interface ListingRequest {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  slug: string | null;
  createdAt: string;
}

/** Pending asks for one org, oldest first. Someone already shown is not asking. */
export async function listListingRequests(orgId: string): Promise<ListingRequest[]> {
  const rows = await db<
    Array<{ id: string; user_id: string; display_name: string | null; avatar_url: string | null; slug: string | null; created_at: Date }>
  >`
    SELECT r.id, r.user_id, u.display_name, u.avatar_url, u.slug, r.created_at
      FROM org_listing_requests r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN org_profiles op ON op.org_id = r.org_id AND op.user_id = r.user_id
     WHERE r.org_id = ${orgId} AND r.status = 'pending' AND NOT COALESCE(op.is_public, FALSE)
     ORDER BY r.created_at
  `;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    displayName: r.display_name ?? 'Someone',
    avatarUrl: r.avatar_url,
    slug: r.slug,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/**
 * Approve or decline one ask. The decider must be an owner or guide of THIS
 * org — checked here, from the database, not by the caller. Approving shows
 * the person and clears their self-hide; either answer closes the request and
 * marks the organisers' notifications about it read.
 */
export async function decideListingRequest(
  deciderId: string,
  orgId: string,
  requestId: string,
  decision: 'approve' | 'decline'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [role] = await db<Array<{ role: string }>>`
    SELECT role FROM user_organizations WHERE user_id = ${deciderId} AND org_id = ${orgId}
  `;
  if (!role || !['owner', 'guide'].includes(role.role)) {
    return { ok: false, error: 'Only owners and guides can answer this.' };
  }
  return db.begin(async (tx) => {
    const [req] = await tx<Array<{ user_id: string }>>`
      UPDATE org_listing_requests
         SET status = ${decision === 'approve' ? 'approved' : 'declined'},
             decided_at = NOW(), decided_by = ${deciderId}
       WHERE id = ${requestId} AND org_id = ${orgId} AND status = 'pending'
       RETURNING user_id
    `;
    if (!req) return { ok: false as const, error: 'That request was already answered.' };
    if (decision === 'approve') {
      await tx`
        INSERT INTO org_profiles (org_id, user_id, is_public, self_hidden) VALUES (${orgId}, ${req.user_id}, TRUE, FALSE)
        ON CONFLICT (org_id, user_id) DO UPDATE SET is_public = TRUE, self_hidden = FALSE
      `;
    }
    await tx`
      UPDATE notifications SET read_at = NOW()
       WHERE kind = 'listing_request' AND read_at IS NULL AND data->>'requestId' = ${requestId}
    `;
    return { ok: true as const };
  });
}
