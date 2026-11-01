import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { jsonb, type Row } from "./map-order";
import { applySeriesSchedule } from "./auction-clock";
import { createLot } from "./auctions";
import { createArtwork } from "./index";

// ============================================================================
// Auction series (migration 190 + 209; docs/open/AUCTION_SERIES_BRIEF_2026-10-03.md,
// ART_AUCTION_PLAN Phase E). A series is one seasonal auction: a landing page
// with a card and description, weeks with a focus, a desk team, and the lots
// in it. Its phase dates drive the lots' clocks (auction-clock.ts):
//
//   announce_at      the landing page is public, no lots shown
//   silent_opens_at  bidding opens on every lot in the series
//   live_at          the close: all at once, or staggered by lot number
//
// Who may edit: an owner of the series' org (`market`, the auction org) or a
// series member with role `editor`. Contributors are listed for the desk but
// edit nothing here.
// ============================================================================

export interface SeriesInput {
  title?: string;
  subtitle?: string | null;
  slug?: string;
  descriptionHtml?: string | null;
  presenterOrgId?: string | null;
  hostOrgId?: string | null;
  announceAt?: string | null;
  silentOpensAt?: string | null;
  liveAt?: string | null;
  weekCount?: number;
  closeMode?: "single" | "staggered";
  staggerSeconds?: number;
  softCloseMinutes?: number;
  paymentWindowHours?: number;
  card?: { eyebrow?: string; blurb?: string; imageUrl?: string } | null;
  theme?: Record<string, unknown> | null;
}

export async function canEditSeries(userId: string, seriesId: string): Promise<boolean> {
  const [row] = (await db`
    SELECT 1 FROM auction_series s
    LEFT JOIN user_organizations uo ON uo.org_id = s.org_id AND uo.user_id = ${userId} AND uo.role = 'owner'
    LEFT JOIN auction_series_member m ON m.series_id = s.id AND m.user_id = ${userId} AND m.role = 'editor'
    LEFT JOIN users u ON u.id = ${userId} AND u.is_admin = true
    WHERE s.id = ${seriesId} AND (uo.user_id IS NOT NULL OR m.user_id IS NOT NULL OR u.id IS NOT NULL)
    LIMIT 1
  `) as unknown as Row[];
  return Boolean(row);
}

/** Owners of the marketplace org and network admins may create a series. */
export async function canCreateSeries(userId: string, orgId = "market"): Promise<boolean> {
  const [row] = (await db`
    SELECT 1 FROM user_organizations WHERE user_id = ${userId} AND org_id = ${orgId} AND role = 'owner'
    UNION ALL SELECT 1 FROM users WHERE id = ${userId} AND is_admin = true
    LIMIT 1
  `) as unknown as Row[];
  return Boolean(row);
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function createSeries(input: SeriesInput & { orgId?: string; actorUserId: string; title: string }): Promise<{ id: string; slug: string }> {
  const orgId = input.orgId ?? "market";
  if (!(await canCreateSeries(input.actorUserId, orgId))) throw new Error("Only an owner of the auction organisation can create a series.");
  const title = input.title.trim();
  if (title.length < 2) throw new Error("Give the series a title.");
  const base = slugify(input.slug?.trim() || title) || "series";
  const existing = (await db`SELECT slug FROM auction_series WHERE org_id = ${orgId} AND slug LIKE ${base + "%"}`) as unknown as Row[];
  const taken = new Set(existing.map((r) => r.slug as string));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const rows = (await db`
    INSERT INTO auction_series (org_id, slug, title, subtitle, presenter_org_id, host_org_id, created_by, week_count)
    VALUES (${orgId}, ${slug}, ${title}, ${input.subtitle?.trim() || null},
            ${input.presenterOrgId ?? "ifac"}, ${input.hostOrgId ?? "inner_group"}, ${input.actorUserId},
            ${Math.min(12, Math.max(1, Math.round(input.weekCount ?? 3)))})
    RETURNING id, slug
  `) as unknown as Row[];
  const id = rows[0]!.id as string;
  await updateSeries(id, input.actorUserId, input);
  await db`
    INSERT INTO auction_series_member (series_id, user_id, org_id, role, added_by)
    VALUES (${id}, ${input.actorUserId}, ${orgId}, 'editor', ${input.actorUserId})
    ON CONFLICT DO NOTHING
  `;
  return { id, slug: rows[0]!.slug as string };
}

export async function updateSeries(seriesId: string, actorUserId: string, input: SeriesInput): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  const desc = input.descriptionHtml !== undefined ? (input.descriptionHtml ? sanitizeRichText(input.descriptionHtml) : null) : undefined;
  const ts = (v: string | null | undefined): string | null | undefined =>
    v === undefined ? undefined : v ? new Date(v).toISOString() : null;
  const announce = ts(input.announceAt);
  const silent = ts(input.silentOpensAt);
  const live = ts(input.liveAt);
  await db`
    UPDATE auction_series SET
      title = COALESCE(${input.title?.trim() || null}, title),
      subtitle = ${input.subtitle !== undefined ? (input.subtitle?.trim() || null) : db`subtitle`},
      description_html = ${desc !== undefined ? desc : db`description_html`},
      presenter_org_id = ${input.presenterOrgId !== undefined ? input.presenterOrgId : db`presenter_org_id`},
      host_org_id = ${input.hostOrgId !== undefined ? input.hostOrgId : db`host_org_id`},
      announce_at = ${announce === undefined ? db`announce_at` : announce},
      silent_opens_at = ${silent === undefined ? db`silent_opens_at` : silent},
      live_at = ${live === undefined ? db`live_at` : live},
      week_count = COALESCE(${input.weekCount != null ? Math.min(12, Math.max(1, Math.round(input.weekCount))) : null}, week_count),
      close_mode = COALESCE(${input.closeMode ?? null}, close_mode),
      stagger_seconds = COALESCE(${input.staggerSeconds != null ? Math.max(10, Math.round(input.staggerSeconds)) : null}, stagger_seconds),
      soft_close_minutes = COALESCE(${input.softCloseMinutes != null ? Math.max(0, Math.round(input.softCloseMinutes)) : null}, soft_close_minutes),
      payment_window_hours = COALESCE(${input.paymentWindowHours != null ? Math.max(1, Math.round(input.paymentWindowHours)) : null}, payment_window_hours),
      card = ${input.card !== undefined ? jsonb(input.card ?? {}) : db`card`},
      theme = ${input.theme !== undefined ? jsonb(input.theme ?? {}) : db`theme`}
    WHERE id = ${seriesId}
  `;
  // Weeks exist as slots so each can carry a focus.
  const [s] = (await db`SELECT org_id, week_count FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  if (s) {
    const n = Number(s.week_count);
    for (let w = 1; w <= n; w++) {
      await db`
        INSERT INTO auction_series_slot (series_id, org_id, stage, week_no, position, kind, title, created_by)
        SELECT ${seriesId}, ${s.org_id as string}, 'week', ${w}, 0, 'announcement', ${"Week " + w}, ${actorUserId}
        WHERE NOT EXISTS (SELECT 1 FROM auction_series_slot WHERE series_id = ${seriesId} AND stage = 'week' AND week_no = ${w} AND position = 0)
      `;
    }
  }
  await applySeriesSchedule(seriesId);
}

export async function setSeriesStatus(seriesId: string, actorUserId: string, status: "draft" | "published" | "closed"): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db`UPDATE auction_series SET status = ${status} WHERE id = ${seriesId}`;
}

/** The focus and notes of one week. */
export async function setWeekFocus(seriesId: string, actorUserId: string, weekNo: number, input: { focus?: string | null; title?: string | null; brief?: string | null }): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db`
    UPDATE auction_series_slot SET
      focus = ${input.focus !== undefined ? (input.focus?.trim() || null) : db`focus`},
      title = COALESCE(${input.title?.trim() || null}, title),
      brief = ${input.brief !== undefined ? (input.brief?.trim() || null) : db`brief`}
    WHERE series_id = ${seriesId} AND stage = 'week' AND week_no = ${weekNo} AND position = 0
  `;
}

/** A lot joins the series and takes the next number (or the given one). The series' clock then applies. */
export async function addLotToSeries(seriesId: string, actorUserId: string, lotId: string, lotNumber?: number | null): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db.begin(async (tx) => {
    const [mx] = (await tx`SELECT COALESCE(MAX(lot_number), 0) AS n FROM auction_lot WHERE series_id = ${seriesId}`) as unknown as Row[];
    const n = lotNumber ?? Number(mx?.n ?? 0) + 1;
    const rows = (await tx`
      UPDATE auction_lot SET series_id = ${seriesId}, lot_number = ${n}
      WHERE id = ${lotId} AND status IN ('scheduled', 'live')
      RETURNING id
    `) as unknown as Row[];
    if (!rows[0]) throw new Error("Only an open lot can join a series.");
  });
  await applySeriesSchedule(seriesId);
}

export async function removeLotFromSeries(seriesId: string, actorUserId: string, lotId: string): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db`UPDATE auction_lot SET series_id = NULL, lot_number = NULL WHERE id = ${lotId} AND series_id = ${seriesId}`;
}

/** Renumber the series' lots in the given order (ids). */
export async function renumberSeriesLots(seriesId: string, actorUserId: string, orderedLotIds: string[]): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db.begin(async (tx) => {
    for (let i = 0; i < orderedLotIds.length; i++) {
      await tx`UPDATE auction_lot SET lot_number = ${i + 1} WHERE id = ${orderedLotIds[i]!} AND series_id = ${seriesId}`;
    }
  });
  await applySeriesSchedule(seriesId);
}

export async function setSeriesMember(seriesId: string, actorUserId: string, email: string, role: "editor" | "contributor"): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEditSeries(actorUserId, seriesId))) return { ok: false, error: "You cannot edit this series." };
  const [u] = (await db`SELECT id FROM users WHERE lower(email) = ${email.trim().toLowerCase()} LIMIT 1`) as unknown as Row[];
  if (!u) return { ok: false, error: "No account with that email." };
  const [s] = (await db`SELECT org_id FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  await db`
    INSERT INTO auction_series_member (series_id, user_id, org_id, role, added_by)
    VALUES (${seriesId}, ${u.id as string}, ${s!.org_id as string}, ${role}, ${actorUserId})
    ON CONFLICT (series_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
  return { ok: true };
}

export async function removeSeriesMember(seriesId: string, actorUserId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEditSeries(actorUserId, seriesId))) return { ok: false, error: "You cannot edit this series." };
  await db`DELETE FROM auction_series_member WHERE series_id = ${seriesId} AND user_id = ${userId}`;
  return { ok: true };
}

/** Member, artist of a lot, or slot assignee: may attach publications. */
export async function canParticipateInSeries(userId: string, seriesId: string): Promise<boolean> {
  const [row] = (await db`
    SELECT 1 WHERE EXISTS (SELECT 1 FROM auction_series_member WHERE series_id = ${seriesId} AND user_id = ${userId})
      OR EXISTS (SELECT 1 FROM auction_series_slot WHERE series_id = ${seriesId} AND assignee_user_id = ${userId})
      OR EXISTS (SELECT 1 FROM auction_lot al JOIN artwork_variant av ON av.id = al.artwork_variant_id JOIN artwork a ON a.id = av.artwork_id
                 WHERE al.series_id = ${seriesId} AND (a.artist_user_id = ${userId} OR a.credited_artist_user_id = ${userId}))
  `) as unknown as Row[];
  return Boolean(row);
}

/**
 * A participant attaches one of their published pieces to the series
 * (ORG_STORE_BRIEF R8): an `article` slot in the chosen week, submitted. The
 * thread must be theirs and published.
 */
export async function attachPublication(input: { seriesId: string; userId: string; threadId: string; weekNo?: number | null }): Promise<{ ok: boolean; error?: string }> {
  if (!(await canParticipateInSeries(input.userId, input.seriesId))) return { ok: false, error: "You are not part of this series." };
  const [t] = (await db`SELECT id, title FROM threads WHERE id = ${input.threadId} AND author_id = ${input.userId} AND status = 'published'`) as unknown as Row[];
  if (!t) return { ok: false, error: "That piece is not yours, or is not published." };
  const [s] = (await db`SELECT org_id, week_count FROM auction_series WHERE id = ${input.seriesId}`) as unknown as Row[];
  if (!s) return { ok: false, error: "Series not found." };
  const week = Math.min(Number(s.week_count), Math.max(1, Math.round(input.weekNo ?? 1)));
  const [dup] = (await db`SELECT 1 FROM auction_series_slot WHERE series_id = ${input.seriesId} AND thread_id = ${input.threadId}`) as unknown as Row[];
  if (dup) return { ok: true };
  const [mx] = (await db`SELECT COALESCE(MAX(position), 0) AS p FROM auction_series_slot WHERE series_id = ${input.seriesId} AND stage = 'week' AND week_no = ${week}`) as unknown as Row[];
  await db`
    INSERT INTO auction_series_slot (series_id, org_id, stage, week_no, position, kind, title, thread_id, status, assignee_user_id, created_by)
    VALUES (${input.seriesId}, ${s.org_id as string}, 'week', ${week}, ${Number(mx?.p ?? 0) + 1}, 'article', ${t.title as string},
            ${input.threadId}, 'submitted', ${input.userId}, ${input.userId})
  `;
  return { ok: true };
}

export async function detachPublication(input: { seriesId: string; userId: string; slotId: string }): Promise<{ ok: boolean; error?: string }> {
  const rows = (await db`
    DELETE FROM auction_series_slot
    WHERE id = ${input.slotId} AND series_id = ${input.seriesId} AND kind = 'article'
      AND (assignee_user_id = ${input.userId} OR EXISTS (
        SELECT 1 FROM auction_series_member m WHERE m.series_id = ${input.seriesId} AND m.user_id = ${input.userId} AND m.role = 'editor'))
    RETURNING id
  `) as unknown as Row[];
  return rows[0] ? { ok: true } : { ok: false, error: "Not attached by you." };
}

// ============================================================================
// Series workspace (2026-10-28): the desk's people search, team by id, the
// store the desk lists into, "Add a lot" on an artist's behalf, overview
// figures.
// ============================================================================

export interface SeriesPerson {
  id: string;
  name: string;
  /** `users.slug`, shown as @username. */
  username: string | null;
  email: string | null;
  /** Their role in the presenting org, when they have one. */
  orgRole: string | null;
}

/**
 * People on the network by name, username or email, for the desk's pickers.
 * Close spellings match through pg_trgm word similarity; members of the
 * presenting org come first. Editors only: the result carries emails.
 */
export async function searchSeriesPeople(seriesId: string, actorUserId: string, q: string): Promise<SeriesPerson[]> {
  if (!(await canEditSeries(actorUserId, seriesId))) return [];
  const term = q.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const like = "%" + term.replace(/[%_\\]/g, (c) => "\\" + c) + "%";
  const [s] = (await db`SELECT presenter_org_id FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  const orgId = (s?.presenter_org_id as string | null) ?? "";
  // A close spelling scores above 0.4 (pg_trgm word similarity; the
  // operator's default of 0.6 missed "dhram" for "Dharam").
  const rows = (await db`
    SELECT * FROM (
      SELECT u.id, COALESCE(u.display_name, u.slug, u.email) AS name, u.slug, u.email, uo.role AS org_role,
        (uo.user_id IS NOT NULL) AS in_org,
        (u.display_name ILIKE ${like} OR u.slug ILIKE ${like} OR u.email ILIKE ${like}) AS contains,
        GREATEST(
          word_similarity(${term}, COALESCE(u.display_name, '')),
          word_similarity(${term}, COALESCE(u.slug, '')),
          word_similarity(${term}, COALESCE(u.email, ''))
        ) AS score
      FROM users u
      LEFT JOIN user_organizations uo ON uo.user_id = u.id AND uo.org_id = ${orgId}
      WHERE COALESCE(u.entity_type, 'person') = 'person'
    ) p
    WHERE p.contains OR p.score > 0.4
    ORDER BY p.in_org DESC, p.contains DESC, p.score DESC, p.name ASC
    LIMIT 8
  `) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    username: (r.slug as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    orgRole: (r.org_role as string | null) ?? null,
  }));
}

/** Add or re-role a team member chosen from the people search. */
export async function setSeriesMemberById(seriesId: string, actorUserId: string, userId: string, role: "editor" | "contributor"): Promise<{ ok: boolean; error?: string }> {
  if (!(await canEditSeries(actorUserId, seriesId))) return { ok: false, error: "You cannot edit this series." };
  const [u] = (await db`SELECT id FROM users WHERE id = ${userId}`) as unknown as Row[];
  if (!u) return { ok: false, error: "No such account." };
  const [s] = (await db`SELECT org_id FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  await db`
    INSERT INTO auction_series_member (series_id, user_id, org_id, role, added_by)
    VALUES (${seriesId}, ${userId}, ${s!.org_id as string}, ${role}, ${actorUserId})
    ON CONFLICT (series_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
  return { ok: true };
}

/** The store the desk lists into: the presenting org's store in the series' marketplace. */
export async function seriesStore(seriesId: string): Promise<{ id: string; orgId: string; ownerOrgId: string; status: string } | null> {
  const [r] = (await db`
    SELECT st.id, st.org_id, st.owner_org_id, st.status
    FROM auction_series ser
    JOIN store st ON st.owner_org_id = ser.presenter_org_id AND st.org_id = ser.org_id
    WHERE ser.id = ${seriesId}
    LIMIT 1
  `) as unknown as Row[];
  return r ? { id: r.id as string, orgId: r.org_id as string, ownerOrgId: r.owner_org_id as string, status: r.status as string } : null;
}

export interface AddSeriesLotInput {
  seriesId: string;
  actorUserId: string;
  /** An account on the network, or a name for an artist without one. */
  artist: { userId: string } | { name: string };
  /**
   * `artist`: the artist is the maker of record and the payee (commission to
   * the store's org as usual). `donated`: the presenting org is the maker and
   * keeps the proceeds; the artist is credited.
   */
  proceeds: "artist" | "donated";
  title: string;
  descriptionHtml?: string | null;
  yearCreated?: number | null;
  medium?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  images: Array<{ url: string; nextcloudFileId?: string | null; nextcloudPath?: string | null; alt?: string | null }>;
  estimateLowMinor?: number | null;
  estimateHighMinor?: number | null;
  startingBidMinor: number;
  reserveMinor?: number | null;
  buyNowMinor?: number | null;
  weekNo?: number | null;
  lotNumber?: number | null;
}

/**
 * The desk lists a piece for an artist and puts it in the series in one step:
 * artwork in the presenting org's store, published, a lot on the series'
 * clock (opens at silent bidding, closes at the live close), and the week
 * feature. The artist needs no store and no Stripe account: their share is
 * held on the ledger until paid out.
 */
export async function addSeriesLot(input: AddSeriesLotInput): Promise<{ artworkId: string; lotId: string }> {
  if (!(await canEditSeries(input.actorUserId, input.seriesId))) throw new Error("You cannot edit this series.");
  const title = input.title.trim();
  if (!title) throw new Error("Give the piece a title.");
  if (input.images.length === 0) throw new Error("Add at least one image.");
  const store = await seriesStore(input.seriesId);
  if (!store) throw new Error("The presenting organisation has no store in this marketplace yet.");
  if (store.status !== "active") throw new Error("The presenting organisation's store is not active.");
  const [ser] = (await db`SELECT org_id, silent_opens_at, live_at, week_count FROM auction_series WHERE id = ${input.seriesId}`) as unknown as Row[];
  if (!ser?.live_at) throw new Error("Set the live close date (Bidding rules) before adding lots.");

  const artistUserId = "userId" in input.artist ? input.artist.userId : null;
  const artistName = "name" in input.artist ? input.artist.name.trim() : null;
  if (!artistUserId && !artistName) throw new Error("Choose the artist or type their name.");

  const { id: artworkId } = await createArtwork({
    storeId: store.id,
    actorUserId: input.actorUserId,
    artistUserId: input.proceeds === "artist" ? artistUserId : null,
    creditedArtistUserId: input.proceeds === "donated" ? artistUserId : null,
    title,
    descriptionHtml: input.descriptionHtml ?? null,
    yearCreated: input.yearCreated ?? null,
    medium: input.medium ?? null,
    heightCm: input.heightCm ?? null,
    widthCm: input.widthCm ?? null,
    depthCm: input.depthCm ?? null,
    estimateLowMinor: input.estimateLowMinor ?? null,
    estimateHighMinor: input.estimateHighMinor ?? null,
    priceMinor: 0,
    images: input.images,
  });

  // Desk provenance, the name of an artist without an account, then publish.
  // Bypassing publishArtwork is deliberate: the image check is above, and the
  // desk's access was checked by canEditSeries.
  await db`
    UPDATE artwork SET
      status = 'available',
      metadata = COALESCE(metadata, '{}'::jsonb) || ${jsonb({
        addedBySeries: input.seriesId,
        addedBy: input.actorUserId,
        ...(artistName ? { artistName } : {}),
      })}
    WHERE id = ${artworkId} AND org_id = ${store.orgId}
  `;

  const now = Date.now();
  const opens = ser.silent_opens_at ? new Date(ser.silent_opens_at as string) : new Date(now);
  const lot = await createLot({
    artworkId,
    actorUserId: input.actorUserId,
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
      SELECT sl.id, ${artworkId}, sl.org_id,
             (SELECT COUNT(*) FROM auction_series_slot_artwork x WHERE x.slot_id = sl.id)
      FROM auction_series_slot sl
      WHERE sl.series_id = ${input.seriesId} AND sl.stage = 'week' AND sl.week_no = ${week} AND sl.position = 0
      ON CONFLICT DO NOTHING
    `;
  }
  return { artworkId, lotId: lot.id };
}

export interface SeriesOverview {
  lotCount: number;
  lotsWithoutImage: number;
  artistCount: number;
  bidCount: number;
  /** Sum of the current high bids across open and closed lots. */
  highBidTotalMinor: number;
  soldCount: number;
  editorCount: number;
  contributorCount: number;
  weeksPlanned: number;
  hasDescription: boolean;
  hasHero: boolean;
  datesSet: boolean;
}

export async function getSeriesOverview(seriesId: string): Promise<SeriesOverview> {
  const [l] = (await db`
    SELECT COUNT(*)::int AS lots,
      COUNT(*) FILTER (WHERE a.primary_image_id IS NULL)::int AS no_image,
      COUNT(DISTINCT COALESCE(a.artist_user_id::text, a.credited_artist_user_id::text, a.metadata->>'artistName'))::int AS artists,
      COALESCE(SUM(al.bid_count), 0)::int AS bids,
      COALESCE(SUM(al.current_bid_minor), 0)::bigint AS high_total,
      COUNT(*) FILTER (WHERE al.status = 'sold')::int AS sold
    FROM auction_lot al
    JOIN artwork_variant av ON av.id = al.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    WHERE al.series_id = ${seriesId}
  `) as unknown as Row[];
  const [m] = (await db`
    SELECT COUNT(*) FILTER (WHERE role = 'editor')::int AS editors, COUNT(*) FILTER (WHERE role = 'contributor')::int AS contributors
    FROM auction_series_member WHERE series_id = ${seriesId}
  `) as unknown as Row[];
  const [s] = (await db`
    SELECT description_html, theme, card, announce_at, silent_opens_at, live_at,
      (SELECT COUNT(*) FROM auction_series_slot sl WHERE sl.series_id = s.id AND sl.stage = 'week' AND sl.position = 0 AND sl.focus IS NOT NULL)::int AS planned
    FROM auction_series s WHERE s.id = ${seriesId}
  `) as unknown as Row[];
  const theme = (s?.theme as { hero?: { url?: string } } | null) ?? {};
  const card = (s?.card as { imageUrl?: string } | null) ?? {};
  return {
    lotCount: Number(l?.lots ?? 0),
    lotsWithoutImage: Number(l?.no_image ?? 0),
    artistCount: Number(l?.artists ?? 0),
    bidCount: Number(l?.bids ?? 0),
    highBidTotalMinor: Number(l?.high_total ?? 0),
    soldCount: Number(l?.sold ?? 0),
    editorCount: Number(m?.editors ?? 0),
    contributorCount: Number(m?.contributors ?? 0),
    weeksPlanned: Number(s?.planned ?? 0),
    hasDescription: Boolean((s?.description_html as string | null)?.trim()),
    hasHero: Boolean(theme.hero?.url || card.imageUrl),
    datesSet: Boolean(s?.silent_opens_at && s?.live_at),
  };
}

// ============================================================================
// Weeks & content (2026-10-28). A week is its position-0 slot: title (the
// theme), focus, brief (team notes), content.color and content.question; its
// featured lots are auction_series_slot_artwork rows on that slot. Content
// items are the week's other slots: `article` (a network thread, reposted),
// `announcement` (text, an uploaded image or video, a link). Items show on
// the series page once approved/published and past publish_at.
// ============================================================================

export interface WeekItemThread {
  id: string;
  slug: string;
  kind: string;
  orgId: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  authorName: string | null;
  authorSlug: string | null;
  publishedAt: string | null;
}

export interface WeekItem {
  id: string;
  weekNo: number;
  kind: "article" | "announcement" | "artist" | "artwork";
  title: string;
  status: string;
  publishAt: string | null;
  text: string | null;
  media: { url: string; kind: "image" | "video" } | null;
  link: string | null;
  label: string | null;
  thread: WeekItemThread | null;
  addedByName: string | null;
}

export interface WeekBoard {
  weekNo: number;
  title: string;
  focus: string | null;
  brief: string | null;
  color: string | null;
  question: string | null;
  featured: Array<{ artworkId: string; title: string; imageUrl: string | null; lotNumber: number | null }>;
  items: WeekItem[];
}

const WEEK_COLORS = /^#[0-9a-f]{6}$/i;

// Public-safe thread: published, PUBLIC, no audience gate, and either a
// Studio writing piece or in a public feed (the forum gates by feed).
function publicThreadClause(q: typeof db) {
  return q`t.status = 'published' AND t.visibility = 'PUBLIC' AND t.min_role IS NULL
    AND (t.kind = 'writing' OR EXISTS (
      SELECT 1 FROM org_feeds f WHERE f.org_id = t.org_id AND f.slug = t.section AND f.is_public AND f.min_role IS NULL))`;
}

function mapThread(r: Row): WeekItemThread | null {
  if (!r.t_id) return null;
  return {
    id: r.t_id as string,
    slug: r.t_slug as string,
    kind: r.t_kind as string,
    orgId: r.t_org_id as string,
    title: r.t_title as string,
    excerpt: (r.t_excerpt as string | null) ?? null,
    coverUrl: (r.t_cover as string | null) ?? null,
    authorName: (r.t_author_name as string | null) ?? null,
    authorSlug: (r.t_author_slug as string | null) ?? null,
    publishedAt: r.t_published_at ? new Date(r.t_published_at as string).toISOString() : null,
  };
}

/** Every week with its theme, featured lots and content. `publicOnly` hides drafts, submissions and future items. */
export async function listWeekBoards(seriesId: string, opts: { publicOnly?: boolean } = {}): Promise<WeekBoard[]> {
  const heads = (await db`
    SELECT id, week_no, title, focus, brief, content FROM auction_series_slot
    WHERE series_id = ${seriesId} AND stage = 'week' AND position = 0
    ORDER BY week_no ASC
  `) as unknown as Row[];
  const featured = (await db`
    SELECT sl.week_no, a.id AS artwork_id, a.title, pm.url AS image_url, al.lot_number, sa.position
    FROM auction_series_slot sl
    JOIN auction_series_slot_artwork sa ON sa.slot_id = sl.id
    JOIN artwork a ON a.id = sa.artwork_id
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    LEFT JOIN artwork_variant av ON av.artwork_id = a.id
    LEFT JOIN auction_lot al ON al.artwork_variant_id = av.id AND al.series_id = ${seriesId}
    WHERE sl.series_id = ${seriesId} AND sl.stage = 'week' AND sl.position = 0
    ORDER BY sl.week_no, sa.position
  `) as unknown as Row[];
  const items = (await db`
    SELECT sl.id, sl.week_no, sl.kind, sl.title, sl.status, sl.publish_at, sl.content, ab.display_name AS added_by,
      t.id AS t_id, t.slug AS t_slug, t.kind AS t_kind, t.org_id AS t_org_id, t.title AS t_title, t.excerpt AS t_excerpt,
      t.metadata->>'coverImageUrl' AS t_cover, t.published_at AS t_published_at,
      tu.display_name AS t_author_name, tu.slug AS t_author_slug,
      (t.id IS NULL OR (${publicThreadClause(db)})) AS thread_public
    FROM auction_series_slot sl
    LEFT JOIN threads t ON t.id = sl.thread_id
    LEFT JOIN users tu ON tu.id = t.author_id
    LEFT JOIN users ab ON ab.id = COALESCE(sl.assignee_user_id, sl.created_by)
    WHERE sl.series_id = ${seriesId} AND sl.stage = 'week' AND sl.position > 0
    ORDER BY sl.week_no, COALESCE(sl.publish_at, sl.created_at), sl.position
  `) as unknown as Row[];
  const now = Date.now();
  return heads.map((h) => {
    const w = Number(h.week_no);
    const content = (h.content as Record<string, unknown> | null) ?? {};
    return {
      weekNo: w,
      title: h.title as string,
      focus: (h.focus as string | null) ?? null,
      brief: (h.brief as string | null) ?? null,
      color: typeof content.color === "string" && WEEK_COLORS.test(content.color) ? content.color : null,
      question: typeof content.question === "string" ? content.question : null,
      featured: featured.filter((f) => Number(f.week_no) === w).map((f) => ({
        artworkId: f.artwork_id as string,
        title: f.title as string,
        imageUrl: (f.image_url as string | null) ?? null,
        lotNumber: f.lot_number == null ? null : Number(f.lot_number),
      })),
      items: items
        .filter((i) => Number(i.week_no) === w)
        .filter((i) => {
          if (!opts.publicOnly) return true;
          if (!(i.status === "approved" || i.status === "published")) return false;
          if (i.publish_at && new Date(i.publish_at as string).getTime() > now) return false;
          return Boolean(i.thread_public);
        })
        .map((i) => {
          const c = (i.content as Record<string, unknown> | null) ?? {};
          const media = c.media as { url?: string; kind?: string } | undefined;
          return {
            id: i.id as string,
            weekNo: w,
            kind: i.kind as WeekItem["kind"],
            title: i.title as string,
            status: i.status as string,
            publishAt: i.publish_at ? new Date(i.publish_at as string).toISOString() : null,
            text: typeof c.text === "string" ? c.text : null,
            media: media?.url ? { url: media.url, kind: media.kind === "video" ? "video" : "image" } : null,
            link: typeof c.link === "string" ? c.link : null,
            label: typeof c.label === "string" ? c.label : null,
            thread: mapThread(i),
            addedByName: (i.added_by as string | null) ?? null,
          };
        }),
    };
  });
}

/** Theme, focus, notes, colour and question of one week. */
export async function saveWeek(
  seriesId: string,
  actorUserId: string,
  weekNo: number,
  input: { title?: string | null; focus?: string | null; brief?: string | null; color?: string | null; question?: string | null }
): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  const color = input.color && WEEK_COLORS.test(input.color) ? input.color : null;
  await db`
    UPDATE auction_series_slot SET
      title = COALESCE(${input.title?.trim() || null}, title),
      focus = ${input.focus !== undefined ? (input.focus?.trim() || null) : db`focus`},
      brief = ${input.brief !== undefined ? (input.brief?.trim() || null) : db`brief`},
      content = COALESCE(content, '{}'::jsonb) || ${jsonb({
        ...(input.color !== undefined ? { color } : {}),
        ...(input.question !== undefined ? { question: input.question?.trim() || null } : {}),
      })},
      updated_at = now()
    WHERE series_id = ${seriesId} AND stage = 'week' AND week_no = ${weekNo} AND position = 0
  `;
}

export interface AddWeekItemInput {
  weekNo: number;
  kind: "article" | "announcement";
  title?: string | null;
  threadId?: string | null;
  text?: string | null;
  media?: { url: string; kind: "image" | "video" } | null;
  link?: string | null;
  label?: string | null;
  publishAt?: string | null;
}

/**
 * Add a content item to a week. Editors add any public thread or an
 * announcement, published at once (or at publishAt). A contributor goes
 * through attachPublication (their own pieces, submitted for approval).
 */
export async function addWeekItem(seriesId: string, actorUserId: string, input: AddWeekItemInput): Promise<{ id: string }> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  const [s] = (await db`SELECT org_id, week_count FROM auction_series WHERE id = ${seriesId}`) as unknown as Row[];
  if (!s) throw new Error("Series not found.");
  const week = Math.min(Number(s.week_count), Math.max(1, Math.round(input.weekNo)));
  let title = input.title?.trim() || "";
  let threadId: string | null = null;
  if (input.kind === "article") {
    if (!input.threadId) throw new Error("Choose a piece to repost.");
    const [t] = (await db`SELECT t.id, t.title FROM threads t WHERE t.id = ${input.threadId} AND ${publicThreadClause(db)}`) as unknown as Row[];
    if (!t) throw new Error("That piece is not public, so it cannot be shown on the series page.");
    threadId = t.id as string;
    title = title || (t.title as string);
    const [dup] = (await db`SELECT 1 FROM auction_series_slot WHERE series_id = ${seriesId} AND thread_id = ${threadId}`) as unknown as Row[];
    if (dup) throw new Error("That piece is already in this series.");
  } else {
    if (!title && !input.text?.trim() && !input.media) throw new Error("Give the item a title, text or media.");
    title = title || (input.media ? (input.media.kind === "video" ? "Video" : "Image") : "Announcement");
  }
  const link = input.link?.trim() || null;
  if (link && !/^https:\/\//i.test(link) && !link.startsWith("/")) throw new Error("Links must start with https://.");
  const media = input.media && (input.media.url.startsWith("/") || /^https:\/\//i.test(input.media.url)) ? input.media : null;
  const [mx] = (await db`SELECT COALESCE(MAX(position), 0) AS p FROM auction_series_slot WHERE series_id = ${seriesId} AND stage = 'week' AND week_no = ${week}`) as unknown as Row[];
  const rows = (await db`
    INSERT INTO auction_series_slot (series_id, org_id, stage, week_no, position, kind, title, thread_id, content, status, publish_at, created_by, assigned_by)
    VALUES (${seriesId}, ${s.org_id as string}, 'week', ${week}, ${Number(mx?.p ?? 0) + 1}, ${input.kind}, ${title.slice(0, 300)}, ${threadId},
            ${jsonb({ text: input.text?.trim() || null, media, link, label: input.label?.trim() || null })},
            'published', ${input.publishAt ? new Date(input.publishAt).toISOString() : null}, ${actorUserId}, ${actorUserId})
    RETURNING id
  `) as unknown as Row[];
  return { id: rows[0]!.id as string };
}

export async function removeWeekItem(seriesId: string, actorUserId: string, slotId: string): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db`DELETE FROM auction_series_slot WHERE id = ${slotId} AND series_id = ${seriesId} AND position > 0`;
}

/** Approve a contributor's submitted item so it shows on the series page. */
export async function approveWeekItem(seriesId: string, actorUserId: string, slotId: string): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db`UPDATE auction_series_slot SET status = 'published', updated_at = now() WHERE id = ${slotId} AND series_id = ${seriesId} AND position > 0`;
}

/** Replace a week's featured lots (artwork ids, in order). Only artworks with a lot in this series. */
export async function setWeekFeatured(seriesId: string, actorUserId: string, weekNo: number, artworkIds: string[]): Promise<void> {
  if (!(await canEditSeries(actorUserId, seriesId))) throw new Error("You cannot edit this series.");
  await db.begin(async (tx) => {
    const [sl] = (await tx`SELECT id, org_id FROM auction_series_slot WHERE series_id = ${seriesId} AND stage = 'week' AND week_no = ${weekNo} AND position = 0`) as unknown as Row[];
    if (!sl) throw new Error("No such week.");
    await tx`DELETE FROM auction_series_slot_artwork WHERE slot_id = ${sl.id as string}`;
    for (let i = 0; i < artworkIds.length; i++) {
      await tx`
        INSERT INTO auction_series_slot_artwork (slot_id, artwork_id, org_id, position)
        SELECT ${sl.id as string}, a.id, ${sl.org_id as string}, ${i}
        FROM artwork a
        WHERE a.id = ${artworkIds[i]!}
          AND EXISTS (SELECT 1 FROM artwork_variant av JOIN auction_lot al ON al.artwork_variant_id = av.id
                      WHERE av.artwork_id = a.id AND al.series_id = ${seriesId})
        ON CONFLICT DO NOTHING
      `;
    }
  });
}

/**
 * Public pieces on the network to repost into a week (editors), or the
 * actor's own published pieces (`mineOnly`, for contributors).
 */
export async function searchRepostable(seriesId: string, actorUserId: string, q: string, opts: { mineOnly?: boolean } = {}): Promise<WeekItemThread[]> {
  const editor = await canEditSeries(actorUserId, seriesId);
  if (!editor && !(opts.mineOnly && (await canParticipateInSeries(actorUserId, seriesId)))) return [];
  const term = q.trim();
  const like = "%" + term.replace(/[%_\\]/g, (c) => "\\" + c) + "%";
  const rows = (await db`
    SELECT t.id AS t_id, t.slug AS t_slug, t.kind AS t_kind, t.org_id AS t_org_id, t.title AS t_title, t.excerpt AS t_excerpt,
      t.metadata->>'coverImageUrl' AS t_cover, t.published_at AS t_published_at,
      u.display_name AS t_author_name, u.slug AS t_author_slug
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.kind IN ('post', 'writing') AND ${publicThreadClause(db)}
      ${term.length >= 2 ? db`AND (t.title ILIKE ${like} OR u.display_name ILIKE ${like})` : db``}
      ${opts.mineOnly || !editor ? db`AND t.author_id = ${actorUserId}` : db``}
    ORDER BY t.published_at DESC NULLS LAST
    LIMIT 12
  `) as unknown as Row[];
  return rows.map((r) => mapThread(r)!).filter(Boolean);
}

/**
 * A contributor (or the artist of a lot) adds one of their own public pieces
 * from the series page; it waits for an editor's approval.
 */
export async function submitOwnPiece(seriesId: string, userId: string, threadId: string, weekNo?: number | null): Promise<{ ok: boolean; error?: string }> {
  const [t] = (await db`SELECT t.id FROM threads t WHERE t.id = ${threadId} AND t.author_id = ${userId} AND ${publicThreadClause(db)}`) as unknown as Row[];
  if (!t) return { ok: false, error: "That piece is not yours, or is not public." };
  return attachPublication({ seriesId, userId, threadId, weekNo: weekNo ?? null });
}

/** The workspace overview's recent activity: lots added, content added, team changes, newest first. */
export async function listSeriesActivity(seriesId: string, limit = 8): Promise<Array<{ at: string; text: string }>> {
  const rows = (await db`
    SELECT * FROM (
      SELECT al.created_at AS at, 'Lot ' || COALESCE(al.lot_number::text, '') || ' added: ' || a.title AS text
      FROM auction_lot al JOIN artwork_variant av ON av.id = al.artwork_variant_id JOIN artwork a ON a.id = av.artwork_id
      WHERE al.series_id = ${seriesId}
      UNION ALL
      SELECT sl.created_at, 'Week ' || sl.week_no || ': ' || sl.kind || ' added, ' || sl.title
      FROM auction_series_slot sl WHERE sl.series_id = ${seriesId} AND sl.stage = 'week' AND sl.position > 0
      UNION ALL
      SELECT m.created_at, COALESCE(u.display_name, 'Someone') || ' joined the team as ' || m.role
      FROM auction_series_member m JOIN users u ON u.id = m.user_id WHERE m.series_id = ${seriesId}
    ) x ORDER BY at DESC LIMIT ${Math.min(limit, 30)}
  `) as unknown as Row[];
  return rows.map((r) => ({ at: new Date(r.at as string).toISOString(), text: r.text as string }));
}
