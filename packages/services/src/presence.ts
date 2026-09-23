import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

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
//   galleries × org X     user_galleries.hidden_on ∋ X      switch, only for
//                                                            sites that honour
//                                                            hidden_on
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

export type PresenceRowKey = 'you' | 'blog' | 'store' | 'galleries';

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

/**
 * Sites whose gallery readers pass `site` and so honour `hidden_on`. Today
 * only IFAC does; adding a key here without a reader would be a switch that
 * does nothing.
 */
const GALLERY_SITES = new Set(['ifac']);

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
    db<Array<{ directory_listed: boolean | null; profile_sections: Record<string, unknown> | null; slug: string | null }>>`
      SELECT directory_listed, profile_sections, slug FROM users WHERE id = ${userId} LIMIT 1
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

  // Blog — the writing shelf on your own page.
  rows.push({
    key: 'blog',
    label: 'Your writing',
    cells: { page: { state: 'switch', on: sections.blog === true || sections.blog === 'true' } },
  });

  // Store — only when there is one; a section with nothing returns nothing.
  if (store) {
    const s = STORE_LABEL[store.status] ?? { label: store.status, note: '' };
    rows.push({
      key: 'store',
      label: 'Your store',
      cells: {
        page:
          store.status === 'active'
            ? { state: 'switch', on: sections.store === true || sections.store === 'true' }
            : { state: 'status', label: 'Not yet', note: 'Shows once the store is open.' },
        market: { state: 'status', label: s.label, note: s.note },
      },
    });
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
    for (const o of orgs) {
      if (!GALLERY_SITES.has(o.org_id)) continue;
      const hidden = galleries.filter((g) => (g.hidden_on ?? []).includes(o.org_id)).length;
      cells[`org:${o.org_id}`] = {
        state: 'switch',
        on: hidden === 0,
        note: hidden > 0 && hidden < galleries.length ? `${galleries.length - hidden} of ${galleries.length} shown` : null,
      };
    }
    rows.push({ key: 'galleries', label: 'Your galleries', cells });
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
    case 'blog':
    case 'store':
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
