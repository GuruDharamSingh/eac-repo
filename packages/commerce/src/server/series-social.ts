import { db } from "@elkdonis/db";
import { createThread, getViewerRoles, postReply, listOrgMediaLibrary, listUserMediaLibrary } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { sendEmail } from "@elkdonis/email";
import { jsonb, type Row } from "./map-order";
import { canEditSeries, addLotToSeries } from "./series";
import { createLot } from "./auctions";

// ============================================================================
// Series page social side and the desk's sources (migration 212, 2026-10-28):
// the mirror forum thread (discussion, following), participating
// organisations, media libraries open to the desk, and putting an artist's
// own listing into a series.
// ============================================================================

const FEED_SLUG = "auction-series";

/**
 * Migration 212 pending (undefined column / relation): read paths return
 * "nothing yet" so the series page and workspace still render; write paths
 * surface the error. Postgres codes 42703 (undefined_column), 42P01
 * (undefined_table).
 */
function schemaMissing(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42703" || code === "42P01";
}
async function guarded<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (schemaMissing(err)) return fallback;
    throw err;
  }
}

/**
 * The series' forum thread: a `post` in the org's public "Auction series"
 * feed, created on first need (publishing) and remembered on the series. The
 * thread carries the series' title and write-up; discussion lives in its
 * replies and "Follow" in thread_rsvps.
 */
export async function ensureSeriesThread(seriesId: string): Promise<string | null> {
  const [s] = (await db`
    SELECT id, org_id, slug, title, subtitle, description_html, thread_id, created_by, status
    FROM auction_series WHERE id = ${seriesId}
  `) as unknown as Row[];
  if (!s) return null;
  if (s.thread_id) return s.thread_id as string;
  const orgId = s.org_id as string;
  await db`
    INSERT INTO org_feeds (org_id, slug, name, tagline, is_public, sort_order)
    VALUES (${orgId}, ${FEED_SLUG}, 'Auction series', 'Discussion around each auction series', true, 50)
    ON CONFLICT DO NOTHING
  `;
  const [author] = (await db`
    SELECT COALESCE(${(s.created_by as string | null) ?? null}::uuid,
      (SELECT m.user_id FROM auction_series_member m WHERE m.series_id = ${seriesId} ORDER BY m.created_at LIMIT 1)) AS id
  `) as unknown as Row[];
  if (!author?.id) return null;
  const thread = await createThread({
    kind: "post",
    orgId,
    authorId: author.id as string,
    title: s.title as string,
    slug: `auction-${s.slug as string}`,
    body: (s.description_html as string | null) ?? (s.subtitle ? `<p>${String(s.subtitle)}</p>` : ""),
    status: "published",
    visibility: "PUBLIC",
    section: FEED_SLUG,
    metadata: { auctionSeriesId: seriesId },
  });
  await db`UPDATE auction_series SET thread_id = ${thread.id} WHERE id = ${seriesId} AND thread_id IS NULL`;
  const [again] = (await db`SELECT thread_id FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  return (again?.thread_id as string | null) ?? thread.id;
}

/** Keep the thread's title and body in step with the series. */
export async function syncSeriesThread(seriesId: string): Promise<void> {
  const [s] = (await db`SELECT thread_id, title, description_html FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  if (!s?.thread_id) return;
  await db`
    UPDATE threads SET title = ${s.title as string}, body = ${(s.description_html as string | null) ?? ""}, updated_at = now()
    WHERE id = ${s.thread_id as string}
  `;
}

// ─── Following ───────────────────────────────────────────────────────────────

export async function setSeriesFollow(seriesId: string, userId: string, on: boolean): Promise<boolean> {
  const threadId = await ensureSeriesThread(seriesId);
  if (!threadId) throw new Error("This series has no discussion thread yet.");
  if (!on) {
    await db`DELETE FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId} AND status = 'subscribed'`;
    return false;
  }
  await db`
    INSERT INTO thread_rsvps (thread_id, user_id, status) VALUES (${threadId}, ${userId}, 'subscribed')
    ON CONFLICT (thread_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()
  `;
  return true;
}

export async function seriesFollowState(seriesId: string, userId: string | null): Promise<{ following: boolean; count: number }> {
  return guarded({ following: false, count: 0 }, async () => {
  const [s] = (await db`SELECT thread_id FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  if (!s?.thread_id) return { following: false, count: 0 };
  const [c] = (await db`
    SELECT COUNT(*)::int AS n, BOOL_OR(user_id = ${userId ?? "00000000-0000-0000-0000-000000000000"}::uuid) AS mine
    FROM thread_rsvps WHERE thread_id = ${s.thread_id as string} AND status = 'subscribed'
  `) as unknown as Row[];
  return { following: Boolean(c?.mine), count: Number(c?.n ?? 0) };
  });
}

/** Followers with an address, for the desk's week letters. */
export async function listSeriesFollowers(seriesId: string): Promise<Array<{ userId: string; email: string; name: string }>> {
  const rows = (await db`
    SELECT r.user_id, u.email, COALESCE(NULLIF(u.display_name, ''), split_part(u.email, '@', 1)) AS name
    FROM auction_series s JOIN thread_rsvps r ON r.thread_id = s.thread_id AND r.status = 'subscribed'
    JOIN users u ON u.id = r.user_id
    WHERE s.id = ${seriesId} AND u.email IS NOT NULL AND u.email <> ''
    ORDER BY r.created_at
  `) as unknown as Row[];
  return rows.map((r) => ({ userId: r.user_id as string, email: r.email as string, name: r.name as string }));
}

// ─── Discussion ──────────────────────────────────────────────────────────────

export interface SeriesReply {
  id: string;
  parentId: string | null;
  authorName: string;
  authorSlug: string | null;
  html: string;
  at: string;
  mine: boolean;
}

export async function listSeriesDiscussion(seriesId: string, viewerId: string | null, limit = 20): Promise<{ threadId: string; threadSlug: string; orgId: string; replyCount: number; replies: SeriesReply[] } | null> {
  return guarded(null, async () => {
  const [t] = (await db`
    SELECT t.id, t.slug, t.org_id, t.reply_count FROM auction_series s JOIN threads t ON t.id = s.thread_id WHERE s.id = ${seriesId}
  `) as unknown as Row[];
  if (!t) return null;
  const rows = (await db`
    SELECT r.id, r.parent_reply_id, r.content, r.created_at, r.user_id,
      COALESCE(NULLIF(u.display_name, ''), 'A member') AS author, u.slug AS author_slug
    FROM replies r JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${t.id as string}
    ORDER BY r.created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `) as unknown as Row[];
  return {
    threadId: t.id as string,
    threadSlug: t.slug as string,
    orgId: t.org_id as string,
    replyCount: Number(t.reply_count ?? 0),
    replies: rows.map((r) => ({
      id: r.id as string,
      parentId: (r.parent_reply_id as string | null) ?? null,
      authorName: r.author as string,
      authorSlug: (r.author_slug as string | null) ?? null,
      html: sanitizeRichText(r.content as string),
      at: new Date(r.created_at as string).toISOString(),
      mine: r.user_id === viewerId,
    })),
  };
  });
}

/** Post to the series' discussion through the forum's write path (rate limit, notifications, watches). */
export async function postSeriesReply(seriesId: string, userId: string, text: string, parentId?: string | null): Promise<{ ok: boolean; error?: string }> {
  const threadId = await ensureSeriesThread(seriesId);
  if (!threadId) return { ok: false, error: "This series has no discussion yet." };
  const [u] = (await db`SELECT is_admin FROM users WHERE id = ${userId}`) as unknown as Row[];
  const viewer = { userId, roles: await getViewerRoles(userId), isGlobalAdmin: Boolean(u?.is_admin) };
  const r = await postReply(viewer, { threadId, text, parentId: parentId ?? null });
  return r.ok ? { ok: true } : { ok: false, error: (r as { error?: string }).error ?? "Could not post." };
}

// ─── Participating organisations ─────────────────────────────────────────────

export interface SeriesOrg {
  orgId: string;
  name: string;
  slug: string | null;
  status: "accepted" | "invited" | "declined" | "presenter" | "host";
  invitedByName: string | null;
  invitedAt: string | null;
  decidedAt: string | null;
  conversationId: string | null;
}

export async function listSeriesOrgs(seriesId: string): Promise<SeriesOrg[]> {
  return guarded([] as SeriesOrg[], async () => {
  const rows = (await db`
    SELECT o.id, o.name, o.slug, x.status, x.invited_at, x.decided_at, x.conversation_id, ib.display_name AS invited_by_name
    FROM (
      SELECT presenter_org_id AS org_id, 'presenter' AS status, NULL::timestamptz AS invited_at, NULL::timestamptz AS decided_at, NULL::uuid AS conversation_id, NULL::uuid AS invited_by
      FROM auction_series WHERE id = ${seriesId} AND presenter_org_id IS NOT NULL
      UNION ALL
      SELECT host_org_id, 'host', NULL, NULL, NULL, NULL FROM auction_series WHERE id = ${seriesId} AND host_org_id IS NOT NULL AND host_org_id IS DISTINCT FROM presenter_org_id
      UNION ALL
      SELECT so.org_id, so.status, so.invited_at, so.decided_at, so.conversation_id, so.invited_by
      FROM auction_series_org so WHERE so.series_id = ${seriesId}
    ) x
    JOIN organizations o ON o.id = x.org_id
    LEFT JOIN users ib ON ib.id = x.invited_by
    ORDER BY CASE x.status WHEN 'presenter' THEN 0 WHEN 'host' THEN 1 WHEN 'accepted' THEN 2 WHEN 'invited' THEN 3 ELSE 4 END, o.name
  `) as unknown as Row[];
  return rows.map((r) => ({
    orgId: r.id as string,
    name: r.name as string,
    slug: (r.slug as string | null) ?? null,
    status: r.status as SeriesOrg["status"],
    invitedByName: (r.invited_by_name as string | null) ?? null,
    invitedAt: r.invited_at ? new Date(r.invited_at as string).toISOString() : null,
    decidedAt: r.decided_at ? new Date(r.decided_at as string).toISOString() : null,
    conversationId: (r.conversation_id as string | null) ?? null,
  }));
  });
}

/** Organisations on the network, for the desk's picker. */
export async function searchOrgs(q: string, limit = 10): Promise<Array<{ id: string; name: string; slug: string | null }>> {
  const term = q.trim();
  const like = "%" + term.replace(/[%_\\]/g, (c) => "\\" + c) + "%";
  const rows = (await db`
    SELECT id, name, slug FROM organizations
    WHERE ${term.length >= 1 ? db`(name ILIKE ${like} OR id ILIKE ${like})` : db`true`}
    ORDER BY name LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, slug: (r.slug as string | null) ?? null }));
}

/** Whether this person runs the org: an owner, a guide, or a network admin. */
export async function runsOrg(userId: string, orgId: string): Promise<boolean> {
  const [r] = (await db`
    SELECT 1 WHERE EXISTS (SELECT 1 FROM user_organizations WHERE user_id = ${userId} AND org_id = ${orgId} AND role IN ('owner', 'guide'))
      OR EXISTS (SELECT 1 FROM users WHERE id = ${userId} AND is_admin = true)
  `) as unknown as Row[];
  return Boolean(r);
}

export async function listOrgOwners(orgId: string): Promise<Array<{ userId: string; email: string | null; name: string }>> {
  const rows = (await db`
    SELECT u.id, u.email, COALESCE(NULLIF(u.display_name, ''), u.email) AS name
    FROM user_organizations uo JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId} AND uo.role = 'owner'
    ORDER BY uo.created_at
  `) as unknown as Row[];
  return rows.map((r) => ({ userId: r.id as string, email: (r.email as string | null) ?? null, name: r.name as string }));
}

/**
 * Add an organisation to a series. Accepted at once when the inviter runs
 * that org; otherwise recorded as invited, and the caller carries the
 * invitation to the org's owners (messaging + email, in the app layer, which
 * knows the addresses). Returns what the caller must do.
 */
export async function addSeriesOrg(seriesId: string, actorUserId: string, orgId: string): Promise<{ status: "accepted" | "invited"; owners: Array<{ userId: string; email: string | null; name: string }> }> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  const [o] = (await db`SELECT id FROM organizations WHERE id = ${orgId}`) as unknown as Row[];
  if (!o) throw new Error("No such organisation.");
  const [s] = (await db`SELECT presenter_org_id, host_org_id FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  if (s && (s.presenter_org_id === orgId || s.host_org_id === orgId)) throw new Error("That organisation already presents or hosts this series.");
  const auto = await runsOrg(actorUserId, orgId);
  const status = auto ? "accepted" : "invited";
  await db`
    INSERT INTO auction_series_org (series_id, org_id, status, invited_by, decided_by, decided_at)
    VALUES (${seriesId}, ${orgId}, ${status}, ${actorUserId}, ${auto ? actorUserId : null}, ${auto ? db`now()` : null})
    ON CONFLICT (series_id, org_id) DO UPDATE
      SET status = CASE WHEN auction_series_org.status = 'accepted' THEN 'accepted' ELSE EXCLUDED.status END,
          invited_by = EXCLUDED.invited_by, invited_at = now(),
          decided_by = CASE WHEN auction_series_org.status = 'accepted' THEN auction_series_org.decided_by ELSE EXCLUDED.decided_by END,
          decided_at = CASE WHEN auction_series_org.status = 'accepted' THEN auction_series_org.decided_at ELSE EXCLUDED.decided_at END
  `;
  return { status, owners: auto ? [] : await listOrgOwners(orgId) };
}

export async function setSeriesOrgConversation(seriesId: string, orgId: string, conversationId: string): Promise<void> {
  await db`UPDATE auction_series_org SET conversation_id = ${conversationId} WHERE series_id = ${seriesId} AND org_id = ${orgId}`;
}

/** An owner or guide of the org (or a network admin) accepts or declines. */
export async function decideSeriesOrg(seriesId: string, orgId: string, actorUserId: string, accept: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!(await runsOrg(actorUserId, orgId))) return { ok: false, error: "Only an owner or guide of the organisation can answer this." };
  const rows = (await db`
    UPDATE auction_series_org SET status = ${accept ? "accepted" : "declined"}, decided_by = ${actorUserId}, decided_at = now()
    WHERE series_id = ${seriesId} AND org_id = ${orgId} RETURNING org_id
  `) as unknown as Row[];
  return rows[0] ? { ok: true } : { ok: false, error: "No invitation found." };
}

export async function removeSeriesOrg(seriesId: string, actorUserId: string, orgId: string): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db`DELETE FROM auction_series_org WHERE series_id = ${seriesId} AND org_id = ${orgId}`;
}

/** Invitations waiting for a person who runs an org, across series. */
export async function listSeriesInvitationsFor(userId: string): Promise<Array<{ seriesId: string; seriesSlug: string; seriesTitle: string; orgId: string; orgName: string; invitedByName: string | null; invitedAt: string }>> {
  return guarded([], async () => {
  const rows = (await db`
    SELECT s.id, s.slug, s.title, o.id AS org_id, o.name AS org_name, so.invited_at, ib.display_name AS invited_by
    FROM auction_series_org so
    JOIN auction_series s ON s.id = so.series_id
    JOIN organizations o ON o.id = so.org_id
    LEFT JOIN users ib ON ib.id = so.invited_by
    WHERE so.status = 'invited' AND (
      EXISTS (SELECT 1 FROM user_organizations uo WHERE uo.user_id = ${userId} AND uo.org_id = so.org_id AND uo.role IN ('owner', 'guide'))
      OR EXISTS (SELECT 1 FROM users u WHERE u.id = ${userId} AND u.is_admin = true))
    ORDER BY so.invited_at DESC
  `) as unknown as Row[];
  return rows.map((r) => ({
    seriesId: r.id as string, seriesSlug: r.slug as string, seriesTitle: r.title as string,
    orgId: r.org_id as string, orgName: r.org_name as string,
    invitedByName: (r.invited_by as string | null) ?? null, invitedAt: new Date(r.invited_at as string).toISOString(),
  }));
  });
}

// ─── Media sources for the desk ──────────────────────────────────────────────

export interface SeriesLibrary {
  key: string;
  label: string;
}

/**
 * Where the desk may pick images from: the presenter and host orgs' folders,
 * accepted participating orgs' folders, and (when the lot's artist has an
 * account) the artist's own files.
 */
export async function listSeriesLibraries(seriesId: string, artistUserId?: string | null): Promise<SeriesLibrary[]> {
  const orgs = await listSeriesOrgs(seriesId);
  const libs: SeriesLibrary[] = [];
  if (artistUserId) {
    const [u] = (await db`SELECT display_name FROM users WHERE id = ${artistUserId}`) as unknown as Row[];
    if (u) libs.push({ key: `user:${artistUserId}`, label: `${(u.display_name as string | null) ?? "The artist"}'s files` });
  }
  for (const o of orgs) {
    if (o.status === "invited" || o.status === "declined") continue;
    libs.push({ key: `org:${o.orgId}`, label: o.name });
  }
  return libs;
}

/** The items of one library, for an editor of the series. */
export async function listSeriesLibraryItems(seriesId: string, actorUserId: string, key: string): Promise<Array<{ url: string; name: string }>> {
  if (!(await canEditSeries(actorUserId, seriesId))) return [];
  const [kind, id] = key.split(":", 2);
  if (!id) return [];
  if (kind === "org") {
    const allowed = (await listSeriesLibraries(seriesId)).some((l) => l.key === key);
    if (!allowed) return [];
    const items = await listOrgMediaLibrary(id, { type: "image" });
    return items.map((i) => ({ url: i.url, name: i.filename }));
  }
  if (kind === "user") {
    const items = await listUserMediaLibrary(id, { type: "image" });
    return items.map((i) => ({ url: i.url, name: i.filename }));
  }
  return [];
}

// ─── An artist's own listing ─────────────────────────────────────────────────

export interface ArtistListing {
  id: string;
  title: string;
  imageUrl: string | null;
  status: string;
  priceMinor: number | null;
  currency: string | null;
  atAuction: boolean;
  storeName: string | null;
}

/** An artist's published pieces in this marketplace, for the desk to pick from. */
export async function listArtistListings(seriesId: string, actorUserId: string, artistUserId: string): Promise<ArtistListing[]> {
  if (!(await canEditSeries(actorUserId, seriesId))) return [];
  const rows = (await db`
    SELECT a.id, a.title, a.status, pm.url AS image_url, st.display_name AS store_name,
      (SELECT av.price_minor FROM artwork_variant av WHERE av.artwork_id = a.id ORDER BY av.position LIMIT 1) AS price_minor,
      (SELECT av.currency FROM artwork_variant av WHERE av.artwork_id = a.id ORDER BY av.position LIMIT 1) AS currency,
      EXISTS (SELECT 1 FROM auction_lot al JOIN artwork_variant av ON av.id = al.artwork_variant_id
              WHERE av.artwork_id = a.id AND al.status IN ('scheduled', 'live')) AS at_auction
    FROM auction_series s
    JOIN artwork a ON a.org_id = s.org_id
    JOIN store st ON st.id = a.store_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE s.id = ${seriesId} AND a.status IN ('available', 'draft')
      AND (a.artist_user_id = ${artistUserId} OR (a.credited_artist_user_id = ${artistUserId} AND a.credit_status = 'credited'))
    ORDER BY a.created_at DESC
    LIMIT 60
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    imageUrl: (r.image_url as string | null) ?? null,
    status: r.status as string,
    priceMinor: r.price_minor == null ? null : Number(r.price_minor),
    currency: (r.currency as string | null) ?? null,
    atAuction: Boolean(r.at_auction),
    storeName: (r.store_name as string | null) ?? null,
  }));
}

/**
 * Put an artist's own published listing up for auction in the series. The
 * desk acts on the artist's behalf (createLot `onBehalfOfSeriesId`): the lot
 * is on the artist's store, so they are paid as for any sale of theirs.
 */
export async function addListingToSeries(input: {
  seriesId: string;
  actorUserId: string;
  artworkId: string;
  startingBidMinor: number;
  reserveMinor?: number | null;
  buyNowMinor?: number | null;
  lotNumber?: number | null;
  weekNo?: number | null;
}): Promise<{ lotId: string }> {
  if (!(await canEditSeries(input.actorUserId, input.seriesId))) throw new Error("You cannot edit this series.");
  const [ser] = (await db`SELECT silent_opens_at, live_at, week_count, org_id FROM auction_series WHERE id = ${input.seriesId}`) as unknown as Row[];
  if (!ser?.live_at) throw new Error("Set the live close date (Dates & bidding) before adding lots.");
  const [a] = (await db`SELECT status FROM artwork a WHERE a.id = ${input.artworkId} AND a.org_id = ${ser.org_id as string}`) as unknown as Row[];
  if (!a) throw new Error("No such piece in this marketplace.");
  if (a.status === "draft") {
    // A desk may list a draft of the artist's: the piece needs an image, as publishArtwork requires.
    const [m] = (await db`SELECT COUNT(*)::int AS n FROM artwork_media WHERE artwork_id = ${input.artworkId}`) as unknown as Row[];
    if (Number(m?.n ?? 0) === 0) throw new Error("That piece has no image yet; the artist needs to add one.");
    await db`UPDATE artwork SET status = 'available' WHERE id = ${input.artworkId} AND status = 'draft'`;
  }
  const now = Date.now();
  const opens = ser.silent_opens_at ? new Date(ser.silent_opens_at as string) : new Date(now);
  const lot = await createLot({
    artworkId: input.artworkId,
    actorUserId: input.actorUserId,
    onBehalfOfSeriesId: input.seriesId,
    startAt: opens.getTime() > now ? opens : new Date(now),
    endAt: new Date(ser.live_at as string),
    startingBidMinor: input.startingBidMinor,
    reserveMinor: input.reserveMinor ?? null,
    buyNowMinor: input.buyNowMinor ?? null,
    incrementMode: "ladder",
  });
  await addLotToSeries(input.seriesId, input.actorUserId, lot.id, input.lotNumber ?? null);
  if (input.weekNo) {
    const week = Math.min(Number(ser.week_count), Math.max(1, Math.round(input.weekNo)));
    await db`
      INSERT INTO auction_series_slot_artwork (slot_id, artwork_id, org_id, position)
      SELECT sl.id, ${input.artworkId}, sl.org_id, (SELECT COUNT(*) FROM auction_series_slot_artwork x WHERE x.slot_id = sl.id)
      FROM auction_series_slot sl
      WHERE sl.series_id = ${input.seriesId} AND sl.stage = 'week' AND sl.week_no = ${week} AND sl.position = 0
      ON CONFLICT DO NOTHING
    `;
  }
  return { lotId: lot.id };
}

/**
 * The desk's artist dropdown before anything is typed: artists of the
 * collective — people with a store in this marketplace, and members of the
 * presenting and host organisations.
 */
export async function listCollectiveArtists(seriesId: string, actorUserId: string, limit = 14): Promise<Array<{ id: string; name: string; username: string | null; email: string | null; orgRole: string | null }>> {
  if (!(await canEditSeries(actorUserId, seriesId))) return [];
  const rows = (await db`
    WITH s AS (SELECT org_id, presenter_org_id, host_org_id FROM auction_series WHERE id = ${seriesId})
    SELECT u.id, COALESCE(NULLIF(u.display_name, ''), u.slug, u.email) AS name, u.slug, u.email,
      MIN(x.label) AS org_role
    FROM (
      SELECT st.owner_user_id AS user_id, 'has a market store' AS label, 0 AS rank
      FROM store st, s WHERE st.org_id = s.org_id AND st.owner_user_id IS NOT NULL AND st.status = 'active'
      UNION ALL
      SELECT uo.user_id, o.name || ' ' || uo.role, 1 FROM user_organizations uo JOIN s ON uo.org_id = s.presenter_org_id JOIN organizations o ON o.id = uo.org_id WHERE uo.role <> 'viewer'
      UNION ALL
      SELECT uo.user_id, o.name || ' ' || uo.role, 2 FROM user_organizations uo JOIN s ON uo.org_id = s.host_org_id JOIN organizations o ON o.id = uo.org_id WHERE uo.role <> 'viewer'
    ) x
    JOIN users u ON u.id = x.user_id
    WHERE COALESCE(u.entity_type, 'person') = 'person'
    GROUP BY u.id, u.display_name, u.slug, u.email
    ORDER BY MIN(x.rank), name
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, username: (r.slug as string | null) ?? null, email: (r.email as string | null) ?? null, orgRole: (r.org_role as string | null) ?? null }));
}

/** Email an org owner about a series invitation. The caller passes the words; this is the envelope. */
export async function emailSeriesOrgInvitation(input: { to: string; orgId: string; seriesTitle: string; inviter: string; siteName: string; link: string }): Promise<boolean> {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  try {
    const r = await sendEmail({
      to: input.to,
      orgId: input.orgId,
      subject: `${input.seriesTitle}: your organisation is invited to take part`,
      html:
        `<p>${esc(input.inviter)} has asked your organisation to take part in the auction series <strong>${esc(input.seriesTitle)}</strong> on ${esc(input.siteName)}.</p>` +
        `<p>Taking part lets the series desk show work from your organisation's media folder and list it among the series' partners. Nothing is sold on your behalf.</p>` +
        `<p><a href="${esc(input.link)}">Accept or decline the invitation</a></p>` +
        `<p>You can also reply in your messages on ${esc(input.siteName)}.</p>`,
    });
    return r.ok;
  } catch (err) {
    console.error("[series] invitation email:", err);
    return false;
  }
}
