// ============================================================================
// @elkdonis/content/server: hydrate a page of index rows into ContentListItem.
//
// searchContent finds a sorted page of keys in content_index; this fills those
// items only: the thread and artwork rows, and the owner-only marks (social
// posts, letters, deliveries). It is the one mapping into ContentListItem on
// the server: it carries the logic list.ts had (which Channel's client-side
// mapping mirrors), so searchContent and listContent produce identical items.
//
// Owner-only sources (deliveries, letters, social posts) are read only for the
// pieces the viewer owns or manages; other viewers get the public marks only.
// ============================================================================

import { db } from "@elkdonis/db";
import { listOrgHomes, type OrgHome } from "@elkdonis/services";
import { listChannelDeliveries, type ChannelDelivery, type ChannelOwner } from "@elkdonis/services/channel";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Currency } from "@elkdonis/commerce/types";
import type {
  ContentCellState, ContentEvent, ContentLane, ContentListItem, ContentMark, ContentOutlet, ContentState, ContentStatus, ContentType,
} from "../model";
import { fmtDay } from "../model";
import { typeLabel } from "../registry";
import { ARTDIRECT_URL, MARKET_URL, NETWORK_HOST, type ContentHost } from "../host";
import type { ContentSaleState, ContentScope } from "../search-types";
import { cardAvailable, offerOfArtwork, offerOfThread, payoutRoutes } from "./offers";
import { isSiteKeeper, mayManageOrg, PERSONAL_ORG, threadReadSql, type ContentRights } from "./access";

export interface IndexRow {
  key: string;
  store: string;
  id: string;
  type: string;
  org_id: string | null;
  site_org_id: string | null;
  store_id: string | null;
  owner_user_id: string | null;
  owner_identity_id: string | null;
  status: string;
  visibility: string;
  sale_state: string | null;
  hidden: boolean;
  series_id: string | null;
  /** ISO, microsecond precision. */
  sort_iso: string;
}

export interface HydrateCtx {
  rights: ContentRights | null;
  scope: ContentScope;
  host: ContentHost;
  now: Date;
  /** v1.4: also fill `item.offer` (the offers view). Off by default, so other views' items carry no offer field. */
  offers?: boolean;
}

const TIME_ZONE = process.env.CHANNEL_TIME_ZONE ?? "America/Toronto";
const DAY_MS = 86_400_000;
const IN_MOTION_DAYS = 14;
const LISTED_ARTWORK = ["available", "reserved", "sold"];

const MARK_COLUMNS = [
  { id: "site", label: "Website" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "video", label: "Video" },
  { id: "writing", label: "Writing" },
  { id: "live", label: "Live" },
  { id: "newsletter", label: "Letter" },
] as const;
type MarkColumn = (typeof MARK_COLUMNS)[number]["id"];

const MARK_MATCH: Record<MarkColumn, (outlet: ContentOutlet, artwork: boolean) => boolean> = {
  site: (o, artwork) => o === "site" || o === "page" || (artwork && o === "market"),
  instagram: (o) => o === "instagram",
  facebook: (o) => o === "facebook" || o === "threads",
  video: (o) => o === "video" || o === "youtube",
  writing: (o) => o === "writing",
  live: (o) => o === "live",
  newsletter: (o) => o === "newsletter",
};

const LANE: Record<ContentOutlet, ContentLane> = {
  site: "site", page: "site", market: "market", instagram: "social", facebook: "social", threads: "social",
  youtube: "video", video: "video", writing: "writing", live: "live", newsletter: "email",
};

const OUTLET_NAME: Record<string, string> = {
  site: "Website", page: "Your page", market: "Market", instagram: "Instagram", facebook: "Facebook",
  threads: "Threads", youtube: "YouTube", video: "Video", writing: "Writing", live: "Live", newsletter: "Letter",
};

/** Thread kinds that are pieces, and how each is shown (services content-index INDEXED_THREAD_KINDS). */
const THREAD_TYPES: Record<string, ContentType> = {
  writing: "writing", post: "writing", meeting: "meeting", reading_group: "meeting", series: "series", workshop: "workshop", event: "event",
  // v1.4: without this a service thread hydrated as "writing" and its offer kind as "artwork" (found 2026-11-27, first real service rows).
  service: "service",
};

interface Share { label?: string; kind?: string; url?: string | null; at?: string }

interface ThreadRow {
  id: string; org_id: string; author_id: string; kind: string; title: string; slug: string; excerpt: string | null;
  status: string; scheduled_at: Date | null; published_at: Date | null; created_at: Date; updated_at: Date;
  video_url: string | null; cover: string | null; shares: Share[] | null; feed_name: string | null;
  next_session: Date | null; author_slug: string | null; author_name: string | null;
}

interface ArtRow {
  id: string; slug: string; title: string; description_html: string | null; medium: string | null;
  height_cm: string | null; width_cm: string | null; status: string; kind: string | null; store_id: string;
  created_at: Date; updated_at: Date; cover: string | null; price_minor: string | number | null; currency: string | null;
  open_lot: boolean;
  store_name: string | null;
  owner_name: string | null;
}

interface FileDbRow {
  key: string; title: string; type: string; cover: string | null; file_path: string | null; file_mime: string | null;
  file_size: string | null; org_id: string | null; owner_user_id: string | null; owner_name: string | null;
}

const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(1)} GB`);

interface PostRow {
  id: string; org_id: string; owner_id: string; link: string | null;
  shares: Array<Share & { kind: string; label: string; at: string }> | null;
}

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const hostOf = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try { return new URL(url).host; } catch { return null; }
};

export function orgUrlOf(home: OrgHome | undefined): string | null {
  if (!home) return null;
  if (home.primaryDomain) return `https://${home.primaryDomain}`;
  const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(NETWORK_HOST) ? "http" : "https";
  return `${proto}://${home.orgSlug}.${NETWORK_HOST}`;
}

function shareOutlet(kind: string | undefined, label: string | undefined): ContentOutlet {
  const k = (kind ?? "").toLowerCase();
  if (k === "instagram" || k === "iglogin" || /instagram/i.test(label ?? "")) return "instagram";
  if (k === "threads") return "threads";
  return "facebook";
}

function event(id: string, at: string, outlet: ContentOutlet, state: ContentState, label: string, sub: string, identityId: string | null, href: string | null, source: ContentEvent["source"], deliveryId?: string): ContentEvent {
  return { id, at, lane: LANE[outlet] ?? "site", source, verb: state, outlet, label, sub, state, identityId, href, refs: deliveryId ? { deliveryId } : undefined };
}

function shareEvents(shares: Share[] | null | undefined, identityId: string, keyBase: string): ContentEvent[] {
  return (shares ?? [])
    .filter((s) => s && s.at)
    .map((s, i) => {
      const outlet = shareOutlet(s.kind, s.label);
      const name = outlet === "instagram" ? "Instagram" : outlet === "threads" ? "Threads" : "Facebook";
      return event(
        `${keyBase}:share:${i}`, new Date(s.at!).toISOString(), outlet, "published",
        outlet === "instagram" ? "Posted to Instagram" : outlet === "threads" ? "Posted to Threads" : "Shared to Facebook",
        `${name} · ${s.label ?? ""}`.replace(/ · $/, ""), identityId, s.url ?? null, "share"
      );
    });
}

function deliveryEvents(list: ChannelDelivery[]): ContentEvent[] {
  return list
    .filter((d) => d.status !== "dismissed")
    .map((d) => {
      const p = d.payload as { title?: string; suggestion?: string };
      const state: ContentState = d.status === "scheduled" ? (d.outlet === "live" ? "live" : "scheduled") : d.status === "failed" ? "failed" : d.status === "published" ? "published" : "draft";
      const outlet = d.outlet as ContentOutlet;
      const name = OUTLET_NAME[d.outlet] ?? d.outlet;
      const sub = d.status === "scheduled" ? `${name} · scheduled` : `${name} · ${d.status === "failed" ? "failed" : "not published"}`;
      return event(`delivery:${d.id}`, d.scheduledAt ?? d.createdAt, outlet, state, p.title || p.suggestion || `${name} post`, sub, d.identityId, d.permalink, "delivery", d.id);
    });
}

/** Marks and status from the timeline, as Channel's finishPiece / statusOf / channelPieceToListItem do. */
function finish(
  base: Omit<ContentListItem, "marks" | "note" | "timeline" | "status" | "date">,
  timeline: ContentEvent[], rawStatus: string, eventAt: string | null, artwork: boolean, now: Date
): ContentListItem {
  timeline.sort((a, b) => a.at.localeCompare(b.at));
  const latest = (match: (o: ContentOutlet) => boolean): ContentEvent | null => {
    const hits = timeline.filter((e) => match(e.outlet));
    const pub = hits.filter((e) => e.state === "published");
    const pool = pub.length ? pub : hits;
    return pool[pool.length - 1] ?? null;
  };
  const marks: ContentMark[] = MARK_COLUMNS.map((c) => {
    const e = latest((o) => MARK_MATCH[c.id](o, artwork));
    const state: ContentCellState = e?.state ?? "empty";
    return { outlet: c.id, state, label: c.label };
  });
  const status: ContentStatus =
    rawStatus === "draft" ? "draft"
    : rawStatus === "archived" ? "archived"
    : timeline.some((e) => e.state === "live") ? "live"
    : timeline.some((e) => e.state === "scheduled") ? "scheduled"
    : "published";
  const last = timeline[timeline.length - 1];
  const nextAt = eventAt ?? timeline.find((e) => e.state === "scheduled" || e.state === "live")?.at ?? null;

  let motion: string | null = null;
  const ahead = timeline.filter((e) => (e.state === "scheduled" || e.state === "live") && new Date(e.at) > now)[0];
  if (ahead) motion = ahead.state === "live" ? `Goes live ${fmtDay(ahead.at, TIME_ZONE)}` : `${OUTLET_NAME[ahead.outlet] ?? ahead.outlet} scheduled for ${fmtDay(ahead.at, TIME_ZONE)}`;
  else if (eventAt) motion = `${base.type === "series" ? "Starts" : "On"} ${fmtDay(eventAt, TIME_ZONE)}`;
  else {
    const since = now.getTime() - IN_MOTION_DAYS * DAY_MS;
    const recent = timeline.filter((e) => e.state === "published" && new Date(e.at).getTime() > since).pop();
    if (recent) motion = `${recent.label} ${fmtDay(recent.at, TIME_ZONE)}`;
  }
  const quiet = rawStatus === "draft" ? "Draft" : last ? `Quiet since ${fmtDay(last.at, TIME_ZONE)}` : "Not out yet";

  return {
    ...base, status, date: nextAt ?? last?.at ?? base.createdAt, marks,
    note: { text: motion ? `In motion · ${motion}` : quiet, motion: Boolean(motion) }, timeline,
  };
}

/** Fill the items for one page of index rows. Rows that cannot be read any more are reported in `missing`, not dropped silently. */
export async function hydrateRows(rows: IndexRow[], ctx: HydrateCtx): Promise<{ items: Map<string, ContentListItem>; missing: string[]; notes: string[] }> {
  const { rights, scope, host, now } = ctx;
  // `missing` is real failed or absent reads only; by-design gaps go to `notes`.
  const missing: string[] = [];
  const notes: string[] = ["publish_jobs and the plan-based open steps are not read here"];
  const items = new Map<string, ContentListItem>();
  if (!rows.length) return { items, missing, notes };

  const orgId = scope.kind === "org" ? scope.orgId : null;
  const keeper = isSiteKeeper(rights, host);
  const authorIds = rights?.identityIds ?? [];
  const userId = rights?.userId ?? null;
  const meId = userId ? `user:${userId}` : "";
  const managed = rights?.managedOrgIds ?? [];

  const threadIds = rows.filter((r) => r.store === "thread").map((r) => r.id);
  const artIds = rows.filter((r) => r.store === "artwork").map((r) => r.id);
  const rowOf = new Map(rows.map((r) => [r.key, r]));

  const homes = await listOrgHomes();
  const homeOf = (id: string) => homes.find((h) => h.orgId === id);
  const orgUrl = (id: string): string | null => host.urls.siteHome(id) ?? orgUrlOf(homeOf(id));

  // Which pieces' working data (deliveries, letters, social posts) this viewer may read.
  const scopeOps = scope.kind === "mine" ? true : orgId && rights ? mayManageOrg(rights, orgId) : false;
  const opsFor = (r: IndexRow): boolean => {
    if (!rights) return false;
    if (scope.kind === "mine") return true;
    if (orgId) return scopeOps;
    return keeper || (r.owner_user_id != null && authorIds.includes(r.owner_user_id)) || (r.owner_identity_id != null && authorIds.includes(r.owner_identity_id)) || (r.org_id != null && mayManageOrg(rights, r.org_id));
  };

  // ── threads ──────────────────────────────────────────────────────────────
  let threadRows: ThreadRow[] = [];
  if (threadIds.length) {
    // Defence against a stale index: the live row must still be readable by this viewer.
    const readable = scope.kind === "network" || !rights
      ? db`(t.visibility = 'PUBLIC' AND t.status = 'published')`
      : keeper ? db`true` : threadReadSql(rights);
    try {
      threadRows = await db<ThreadRow[]>`
        SELECT t.id, t.org_id, t.author_id, t.kind, t.title, t.slug, t.excerpt, t.status,
               t.scheduled_at, t.published_at, t.created_at, t.updated_at, t.video_url,
               t.metadata->>'coverImageUrl' AS cover,
               CASE WHEN jsonb_typeof(t.metadata->'shares') = 'array' THEN t.metadata->'shares' ELSE NULL END AS shares,
               f.name AS feed_name, u.slug AS author_slug, u.display_name AS author_name,
               (SELECT min(s.scheduled_at) FROM threads s
                 WHERE s.kind = 'series_session' AND s.status = 'published'
                   AND s.metadata->>'seriesId' = t.id AND s.scheduled_at > now()) AS next_session
        FROM threads t
        LEFT JOIN org_feeds f ON f.slug = t.section AND f.org_id = t.org_id
        LEFT JOIN users u ON u.id = t.author_id
        WHERE t.id = ANY(${threadIds}) AND ${readable}
      `;
    } catch (err) {
      console.error("[content] threads:", err instanceof Error ? err.message : err);
      missing.push("threads");
    }
    if (!missing.includes("threads") && threadRows.length < threadIds.length) missing.push(`threads: ${threadIds.length - threadRows.length} stale index row(s) no longer readable`);
  }

  // ── artwork ──────────────────────────────────────────────────────────────
  let artRows: ArtRow[] = [];
  const pinnedStores = new Map<string, string>(); // storeId → orgId whose site shows it
  if (artIds.length) {
    try {
      artRows = await db<ArtRow[]>`
        SELECT a.id::text AS id, a.slug, a.title, a.description_html, a.medium, a.height_cm::text AS height_cm, a.width_cm::text AS width_cm,
               a.status, a.kind, a.store_id::text AS store_id, a.created_at, a.updated_at, pm.url AS cover,
               pv.price_minor, pv.currency, COALESCE(NULLIF(st.display_name, ''), NULLIF(sou.display_name, ''), NULLIF(soo.name, ''), 'Store') AS store_name,
               COALESCE(CASE WHEN a.credit_status = 'credited' THEN cu.display_name END, a.metadata->>'artistName', au.display_name, st.display_name) AS owner_name,
               EXISTS (SELECT 1 FROM auction_lot l JOIN artwork_variant v ON v.id = l.artwork_variant_id
                        WHERE v.artwork_id = a.id AND l.status IN ('scheduled', 'live')) AS open_lot
        FROM artwork a
        LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
        LEFT JOIN store st ON st.id = a.store_id
        LEFT JOIN users au ON au.id = a.artist_user_id
        LEFT JOIN users sou ON sou.id = st.owner_user_id
        LEFT JOIN organizations soo ON soo.id = st.owner_org_id
        LEFT JOIN users cu ON cu.id = a.credited_artist_user_id
        LEFT JOIN LATERAL (SELECT v.price_minor, v.currency FROM artwork_variant v WHERE v.artwork_id = a.id
                            ORDER BY v.price_minor ASC, v.position ASC LIMIT 1) pv ON true
        WHERE a.id = ANY(${artIds}::uuid[])
      `;
      const pins = await db<Array<{ org_id: string; store_id: string }>>`
        SELECT c.org_id, c.value->>'storeId' AS store_id FROM site_config c
        WHERE c.key = 'shop:store' AND c.value->>'storeId' = ANY(${artRows.map((a) => a.store_id)})
          ${orgId ? db`AND c.org_id = ${orgId}` : scope.kind === "mine" ? db`AND c.org_id = ANY(${managed}::text[])` : db``}
      `;
      for (const p of pins) if (p.store_id && !pinnedStores.has(p.store_id)) pinnedStores.set(p.store_id, p.org_id);
    } catch (err) {
      console.error("[content] artwork:", err instanceof Error ? err.message : err);
      missing.push("artwork");
    }
  }

  // ── images (CONTRACT s11.4): public media only, cover first ─────────────
  const imagesBy = new Map<string, string[]>();
  try {
    if (threadRows.length) {
      const m = await db<Array<{ id: string; url: string }>>`
        SELECT attached_to_id AS id, url FROM media
        WHERE attached_to_type = 'thread' AND attached_to_id = ANY(${threadRows.map((t) => t.id)})
          AND mime_type LIKE 'image/%' AND url IS NOT NULL
          AND COALESCE(nextcloud_path, '') !~* '/(Private|workshops)/'
        ORDER BY created_at`;
      for (const x of m) imagesBy.set(`thread:${x.id}`, [...(imagesBy.get(`thread:${x.id}`) ?? []), x.url]);
    }
    if (artRows.length) {
      const m = await db<Array<{ id: string; url: string }>>`
        SELECT am.artwork_id::text AS id, am.url FROM artwork_media am
        WHERE am.artwork_id = ANY(${artRows.map((a) => a.id)}::uuid[]) AND am.url IS NOT NULL
        ORDER BY am.position, am.created_at`;
      for (const x of m) imagesBy.set(`artwork:${x.id}`, [...(imagesBy.get(`artwork:${x.id}`) ?? []), x.url]);
    }
  } catch (err) {
    console.error("[content] images:", err instanceof Error ? err.message : err);
    missing.push("images");
  }
  const withCover = (key: string, cover: string | null): string[] => {
    const rest = imagesBy.get(key) ?? [];
    return [...new Set([...(cover ? [cover] : []), ...rest])];
  };

  // ── history sources (owner only) ─────────────────────────────────────────
  const opsThreadIds = threadRows.filter((t) => opsFor(rowOf.get(`thread:${t.id}`)!)).map((t) => t.id);
  const anyOps = rows.some(opsFor);
  let posts: PostRow[] = [];
  let letters: Array<{ thread_id: string; n: number; last: Date }> = [];
  let deliveries: ChannelDelivery[] = [];
  if (anyOps && rights) {
    const owners: ChannelOwner[] = orgId ? [{ kind: "org", id: orgId }]
      : scope.kind === "mine" ? [{ kind: "user", id: rights.userId }]
      : [...managed.map((id): ChannelOwner => ({ kind: "org", id })), { kind: "user", id: rights.userId }];
    const postScope = orgId ? db`org_id = ${orgId}` : scope.kind === "mine" ? db`owner_id = ${rights.userId}` : db`(owner_id = ${rights.userId} OR org_id = ANY(${managed}::text[]))`;
    const [p, l, d] = await Promise.all([
      db<PostRow[]>`
        SELECT id, org_id, owner_id, link, shares FROM social_posts
        WHERE archived_at IS NULL AND link IS NOT NULL AND ${postScope}
        ORDER BY updated_at DESC LIMIT 400
      `.catch((err) => { console.error("[content] social posts:", err instanceof Error ? err.message : err); missing.push("social_posts"); return [] as PostRow[]; }),
      opsThreadIds.length
        ? db<Array<{ thread_id: string; n: number; last: Date }>>`
            SELECT thread_id, count(*)::int AS n, max(sent_at) AS last FROM email_sends
            WHERE kind = 'notification' AND thread_id = ANY(${opsThreadIds})
            GROUP BY thread_id
          `.catch((err) => { console.error("[content] letters:", err instanceof Error ? err.message : err); missing.push("email_sends"); return []; })
        : Promise.resolve([]),
      listChannelDeliveries(owners).catch(() => { missing.push("channel_deliveries"); return [] as ChannelDelivery[]; }),
    ]);
    posts = p; letters = l; deliveries = d;
  } else {
    notes.push("owner-only sources (social posts, letters, deliveries) not read for this viewer");
  }
  const postsByLink = new Map<string, PostRow[]>();
  for (const p of posts) if (p.link) postsByLink.set(p.link, [...(postsByLink.get(p.link) ?? []), p]);
  const letterBy = new Map(letters.map((l) => [l.thread_id, l]));
  const deliveriesBy = new Map<string, ChannelDelivery[]>();
  for (const d of deliveries) {
    const k = `${d.subject.kind}:${d.subject.id}`;
    deliveriesBy.set(k, [...(deliveriesBy.get(k) ?? []), d]);
  }

  // Which identity a row is shown under. mine/org scopes keep list.ts's rule exactly; other scopes name the row's own owner.
  const identityFor = (rowOrg: string, authorId: string): string => {
    if (orgId) return `org:${orgId}`;
    if (scope.kind === "mine") {
      const mine = authorIds.includes(authorId);
      if (rowOrg === PERSONAL_ORG || mine) return rowOrg !== PERSONAL_ORG && managed.includes(rowOrg) ? `org:${rowOrg}` : meId;
      return managed.includes(rowOrg) ? `org:${rowOrg}` : meId;
    }
    if (managed.includes(rowOrg)) return `org:${rowOrg}`;
    return rowOrg === PERSONAL_ORG ? `user:${authorId}` : `org:${rowOrg}`;
  };
  const postIdentity = (p: PostRow) => (p.org_id === PERSONAL_ORG ? meId : `org:${p.org_id}`);

  const ownsRow = (r: IndexRow): boolean => Boolean(rights) && ((r.owner_user_id != null && authorIds.includes(r.owner_user_id)) || (r.owner_identity_id != null && authorIds.includes(r.owner_identity_id)));
  const manageLink = (ref: { store: "thread" | "artwork"; id: string }): { manage?: string | null } => {
    const m = host.urls.manage?.(ref);
    return m === undefined ? {} : { manage: m };
  };

  const canFor = (r: IndexRow, status: ContentStatus): NonNullable<ContentListItem["can"]> => {
    const owns = Boolean(rights) && ((r.owner_user_id != null && authorIds.includes(r.owner_user_id)) || (r.owner_identity_id != null && authorIds.includes(r.owner_identity_id)));
    const manages = Boolean(rights && r.org_id && mayManageOrg(rights, r.org_id));
    const edit = Boolean(rights) && (owns || manages || keeper);
    return {
      edit,
      hide: keeper && r.store === "artwork" && status !== "draft",
      publish: edit && status === "draft",
      archive: edit && status !== "archived" && r.sale_state !== "sold",
      // v1.2 s11.3: a reference to someone else's public piece is allowed for any signed-in viewer; always on one's own.
      pick: Boolean(rights) && (owns || (r.status === "published" && r.visibility === "PUBLIC" && !r.hidden)),
    };
  };

  for (const t of threadRows) {
    const key = `thread:${t.id}`;
    const row = rowOf.get(key)!;
    const type: ContentType = t.video_url ? "video" : THREAD_TYPES[t.kind] ?? "writing";
    const ownerIdentity = identityFor(t.org_id, t.author_id);
    const personal = t.org_id === PERSONAL_ORG || t.kind === "writing";
    const mine = authorIds.includes(t.author_id);
    const siteUrl = personal ? (t.author_slug ? `${ARTDIRECT_URL}/${t.author_slug}` : null) : orgUrl(t.org_id);
    const href = personal ? (t.author_slug ? `${ARTDIRECT_URL}/${t.author_slug}/writing/${t.slug}` : null) : siteUrl ? `${siteUrl}/${t.slug}` : null;
    const siteIdentityId = personal && mine && !orgId ? meId : `org:${t.org_id}`;
    const siteName = personal ? (mine ? "Your page" : `${t.author_name ?? "Author"}'s page`) : homeOf(t.org_id)?.orgName ?? t.org_id;
    const eventAt = iso(t.next_session) ?? (t.scheduled_at && t.scheduled_at > now ? iso(t.scheduled_at) : null);

    const timeline: ContentEvent[] = [];
    if (t.status === "published" && t.published_at) {
      timeline.push(event(`${key}:site`, iso(t.published_at)!, personal ? "page" : "site", "published",
        personal ? (mine ? "Added to your page" : `On ${t.author_name ?? "the author"}'s page`) : `Published${t.feed_name ? ` in ${t.feed_name}` : ""}`,
        [hostOf(siteUrl), href ? new URL(href).pathname : null].filter(Boolean).join(""), siteIdentityId, href, "thread"));
    } else if (t.status === "draft") {
      timeline.push(event(`${key}:draft`, iso(t.updated_at)!, personal ? "page" : "site", "draft", "Draft", "Website · not published", siteIdentityId, null, "thread"));
    }
    timeline.push(...shareEvents(t.shares, ownerIdentity, key));
    if (opsFor(row)) {
      for (const p of href ? postsByLink.get(href) ?? [] : []) timeline.push(...shareEvents(p.shares, postIdentity(p), `post:${p.id}`));
      const letter = letterBy.get(t.id);
      if (letter) timeline.push(event(`${key}:letter`, iso(letter.last)!, "newsletter", "published", "Emailed", `Email · ${letter.n} ${letter.n === 1 ? "person" : "people"}`, `org:${t.org_id}`, null, "email"));
      timeline.push(...deliveryEvents(deliveriesBy.get(key) ?? []));
    }

    const item = finish({
      key, type, title: t.title || "Untitled",
      meta: [typeLabel(type), t.feed_name, eventAt ? `next ${fmtDay(eventAt, TIME_ZONE)}` : null].filter(Boolean).join(" · "),
      excerpt: (t.excerpt ?? "").slice(0, 280),
      cover: t.cover, siteIdentityId, siteName, siteHost: hostOf(siteUrl), ownerIdentityId: ownerIdentity,
      series: null, createdAt: iso(t.created_at)!,
      links: { public: href, studio: host.urls.studio({ store: "thread", id: t.id }, { kind: t.kind, org: personal ? undefined : t.org_id }), ...manageLink({ store: "thread", id: t.id }) },
    }, timeline, t.status, eventAt, false, now);
    item.store = "thread";
    // The identity's own public name (a pseudonym's, never the account behind it): threads.author_id is the identity.
    item.ownerName = t.author_name ?? null;
    item.images = withCover(key, t.cover);
    item.can = canFor(row, item.status);
    if (keeper || ownsRow(row)) item.hidden = row.hidden;
    items.set(key, item);
  }

  for (const a of artRows) {
    const key = `artwork:${a.id}`;
    const row = rowOf.get(key)!;
    const type: ContentType = a.kind && a.kind !== "original" ? "product" : "artwork";
    const pinnedOrg = pinnedStores.get(a.store_id) ?? null;
    const siteUrl = pinnedOrg ? orgUrl(pinnedOrg) : null;
    const marketPiece = `${MARKET_URL}/artworks/${a.id}`;
    const href = siteUrl ? `${siteUrl}/pieces/${a.slug}` : host.urls.piece({ store: "artwork", id: a.id }, { orgId: row.org_id }) ?? marketPiece;
    const priceMinor = a.price_minor == null ? null : Number(a.price_minor);
    const price = priceMinor != null && priceMinor > 0 && a.currency ? formatMoney(priceMinor, a.currency as Currency) : null;
    const size = a.height_cm && a.width_cm ? `${Number(a.height_cm)} × ${Number(a.width_cm)} cm` : null;
    const listed = LISTED_ARTWORK.includes(a.status);
    const ownerIdentity = orgId ? `org:${orgId}` : scope.kind === "mine" ? meId : row.owner_user_id ? `user:${row.owner_user_id}` : (pinnedOrg ? `org:${pinnedOrg}` : "");
    const marketHost = hostOf(MARKET_URL) ?? "Market";

    const timeline: ContentEvent[] = [];
    if (listed) {
      timeline.push(event(`${key}:market`, iso(a.created_at)!, "market", "published",
        a.status === "sold" ? "Sold" : price ? `Listed for sale · ${price}` : "Listed, price on request", marketHost, ownerIdentity, marketPiece, "thread"));
      if (pinnedOrg && siteUrl)
        timeline.push(event(`${key}:site`, iso(a.created_at)!, "site", "published", `On ${homeOf(pinnedOrg)?.orgName ?? "the site"}`, `${hostOf(siteUrl)}/pieces/${a.slug}`, `org:${pinnedOrg}`, href, "thread"));
    } else {
      timeline.push(event(`${key}:draft`, iso(a.updated_at)!, "market", "draft", "Draft listing", "Market · not listed", ownerIdentity, null, "thread"));
    }
    if (opsFor(row)) {
      for (const p of [...(postsByLink.get(href) ?? []), ...(postsByLink.get(marketPiece) ?? [])])
        timeline.push(...shareEvents(p.shares, postIdentity(p), `post:${p.id}`));
      timeline.push(...deliveryEvents(deliveriesBy.get(key) ?? []));
    }

    const item = finish({
      key, type, title: a.title,
      meta: [a.medium, size, price, a.status === "sold" ? "sold" : null].filter(Boolean).join(" · ") || typeLabel(type),
      excerpt: (a.description_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280),
      cover: a.cover ?? null,
      siteIdentityId: pinnedOrg ? `org:${pinnedOrg}` : ownerIdentity,
      siteName: pinnedOrg ? homeOf(pinnedOrg)?.orgName ?? "Site" : "Market",
      siteHost: pinnedOrg ? hostOf(siteUrl) : hostOf(MARKET_URL),
      ownerIdentityId: ownerIdentity || null, series: null, createdAt: iso(a.created_at)!,
      links: { public: href, studio: host.urls.studio({ store: "artwork", id: a.id }), ...manageLink({ store: "artwork", id: a.id }) },
    }, timeline, a.status, null, true, now);
    item.store = "artwork";
    item.ownerName = a.owner_name ?? null;
    item.images = withCover(key, a.cover ?? null);
    item.storefront = a.store_id ? { id: a.store_id, name: a.store_name ?? a.store_id } : null;
    const sale: ContentSaleState =
      a.status === "draft" ? "not_for_sale" : a.status === "archived" ? "withdrawn" : a.status === "sold" ? "sold" : a.status === "reserved" ? "reserved"
      : a.open_lot ? "in_auction" : row.sale_state === "passed" ? "passed" : "for_sale";
    item.sale = { state: sale, price };
    item.can = canFor(row, item.status);
    if (keeper || ownsRow(row)) item.hidden = row.hidden;
    items.set(key, item);
  }

  // ── offers (v1.4): how each piece is taken up. Read-only; no money is computed here ──
  if (ctx.offers && (threadRows.length || artRows.length)) {
    try {
      type OfferFact = {
        id: string; price_major: string | null; currency: string | null; sliding_min: string | null; rsvp: boolean; lim: number | null;
        coming: number; reg: string | null;
      };
      const facts: OfferFact[] = threadRows.length
        ? await db<OfferFact[]>`
            SELECT t.id, COALESCE(wp.price_member, t.price)::text AS price_major, t.currency, wp.price_sliding_min::text AS sliding_min,
                   t.is_rsvp_enabled AS rsvp, t.attendee_limit AS lim, wp.registration_status AS reg,
                   (SELECT count(*) FROM thread_rsvps r WHERE r.thread_id = t.id AND r.status = 'yes')::int AS coming
            FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
            WHERE t.id = ANY(${threadRows.map((t) => t.id)})`
        : [];
      const factOf = new Map<string, OfferFact>(facts.map((f) => [f.id, f] as [string, OfferFact]));
      const payees = await payoutRoutes([...threadRows.map((t) => t.author_id), ...artRows.map((a) => rowOf.get(`artwork:${a.id}`)?.owner_user_id ?? "")]);
      const card = cardAvailable();
      for (const t of threadRows) {
        const item = items.get(`thread:${t.id}`);
        const f = factOf.get(t.id);
        if (!item || !f) continue;
        const major = f.price_major == null ? 0 : Number(f.price_major);
        const priced = major > 0;
        const sliding = f.sliding_min == null ? null : Math.round(Number(f.sliding_min) * 100);
        const start = t.next_session ?? t.scheduled_at;
        item.offer = offerOfThread({
          kind: t.kind, type: THREAD_TYPES[t.kind] ?? "writing",
          priceMinor: priced ? Math.round(major * 100) : null, currency: priced ? f.currency || "CAD" : null, slidingMinMinor: sliding,
          rsvp: f.rsvp, limit: f.lim, coming: f.coming, registrationOpen: (f.reg ?? "open") === "open", start: iso(start),
        }, { cardAvailable: card, payoutOk: payees.get(t.author_id) === true });
      }
      for (const a of artRows) {
        const item = items.get(`artwork:${a.id}`);
        if (!item) continue;
        const owner = rowOf.get(`artwork:${a.id}`)?.owner_user_id ?? "";
        item.offer = offerOfArtwork({ priceMinor: a.price_minor == null ? null : Number(a.price_minor), currency: a.currency }, { cardAvailable: card, payoutOk: payees.get(owner) === true });
      }
    } catch (err) {
      console.error("[content] offers:", err instanceof Error ? err.message : err);
      missing.push("offers");
    }
  }

  // ── files (Step 5): the index row is the source; the bytes stay behind /api/media and serveMedia ──
  const fileKeys = rows.filter((r) => r.store === "file").map((r) => r.key);
  if (fileKeys.length) {
    try {
      const frs = await db<FileDbRow[]>`
        SELECT ci.key, ci.title, ci.type, ci.cover, ci.file_path, ci.file_mime, ci.file_size::text AS file_size, ci.org_id,
               ci.owner_user_id::text AS owner_user_id, u.display_name AS owner_name
        FROM content_index ci LEFT JOIN users u ON u.id = ci.owner_user_id
        WHERE ci.key = ANY(${fileKeys}::text[])`;
      // The viewer's own source keys, so a file in their tree reads as { source: "mine", path: <below the root> }.
      const sources = rights && host.fileSources ? await host.fileSources({ userId: rights.userId }).catch(() => []) : [];
      const roots = sources.filter((x) => x.root).map((x) => ({ ...x, root: x.root.replace(/\/+$/, "") })).sort((x, y) => y.root.length - x.root.length);
      for (const f of frs) {
        const row = rowOf.get(f.key);
        if (!row || !f.file_path) continue;
        const type = (f.type || "file") as ContentType;
        const owns = ownsRow(row);
        const manages = Boolean(rights && row.org_id && mayManageOrg(rights, row.org_id));
        const hasPrivate = /(^|\/)private(\/|$)/i.test(f.file_path);
        const src = roots.find((x) => f.file_path!.startsWith(`${x.root}/`) && (x.showPrivate || !hasPrivate));
        const rel = src ? f.file_path.slice(src.root.length + 1) : f.file_path;
        const slash = rel.lastIndexOf("/");
        const folder = slash > 0 ? rel.slice(0, slash) : "";
        const size = f.file_size == null ? null : Number(f.file_size);
        const url = `/api/media/${f.file_path}`;
        const orgName = row.org_id ? homeOf(row.org_id)?.orgName ?? row.org_id : null;
        const ownerName = f.owner_name ?? orgName;
        const item: ContentListItem = {
          key: f.key, type, title: f.title,
          meta: [typeLabel(type), size == null ? null : fmtBytes(size), folder || null].filter(Boolean).join(" · "),
          excerpt: folder,
          cover: type === "image" ? f.cover ?? url : null,
          status: "published",
          siteIdentityId: row.owner_user_id ? `user:${row.owner_user_id}` : row.org_id ? `org:${row.org_id}` : "",
          siteName: orgName ?? (owns ? "My files" : `${f.owner_name ?? "Member"}'s files`),
          siteHost: null,
          ownerIdentityId: row.owner_user_id ? `user:${row.owner_user_id}` : row.org_id ? `org:${row.org_id}` : null,
          series: null, createdAt: row.sort_iso, date: row.sort_iso, marks: [], note: null, timeline: [],
          links: { public: url, studio: null },
          store: "file",
          file: { source: src?.key ?? "network", path: rel, mime: f.file_mime, size, folder },
        };
        item.ownerName = ownerName;
        item.images = type === "image" ? [item.cover ?? url] : [];
        // A file is not published, archived or hidden here; the owner and the org's managers may change it in their folders.
        item.can = { edit: owns || manages || keeper, hide: false, publish: false, archive: false, pick: owns || Boolean(rights && row.org_id && (rights.affiliateOrgIds ?? Object.entries(rights.roles).filter(([, role]) => role !== "viewer").map(([o]) => o)).includes(row.org_id)) };
        items.set(f.key, item);
      }
    } catch (err) {
      console.error("[content] files:", err instanceof Error ? err.message : err);
      missing.push("files");
    }
  }

  // ── people (v1.3, CONTRACT §15): directory identities, public by construction ──
  // Read from the identity's own users row, re-checking the directory rule (slug + directory_listed) so an
  // identity unlisted since its row was indexed never shows. Never reads email or identity_control.
  const personKeys = rows.filter((r) => r.store === "person").map((r) => r.key);
  if (personKeys.length) {
    try {
      const prs = await db<Array<{
        key: string; id: string; title: string; excerpt: string | null; cover: string | null; slug: string;
        entity_type: string | null; city: string | null; region: string | null; country: string | null;
        location: string | null; verified: boolean | null; claim_status: string | null; vouches: number; org_user: boolean;
      }>>`
        SELECT ci.key, u.id::text AS id, ci.title, ci.excerpt, ci.cover, u.slug, u.entity_type, u.city, u.region, u.country,
               u.oad_dossier->>'location' AS location, u.verified, u.claim_status,
               (SELECT count(*) FROM profile_vouches v WHERE v.subject_id = u.id)::int AS vouches,
               EXISTS (SELECT 1 FROM organizations o WHERE o.profile_user_id = u.id) AS org_user
        FROM content_index ci JOIN users u ON u.id::text = ci.id
        WHERE ci.key = ANY(${personKeys}::text[]) AND ci.store = 'person' AND u.slug IS NOT NULL AND u.directory_listed`;
      for (const pr of prs) {
        const row = rowOf.get(pr.key);
        if (!row) continue;
        const entityType = pr.entity_type === "organization" ? "organization" : "person";
        const claim = pr.claim_status === "pending" || pr.claim_status === "claimed" ? pr.claim_status : "unclaimed";
        const place = [pr.city, pr.region, pr.country].filter(Boolean).join(", ") || pr.location || null;
        const item: ContentListItem = {
          key: pr.key, type: "person", title: pr.title,
          meta: [pr.excerpt, place].filter(Boolean).join(" · "),
          excerpt: pr.excerpt ?? "",
          cover: pr.cover,
          status: "published",
          siteIdentityId: pr.key, siteName: pr.title, siteHost: null,
          // The identity is its own owner here; nothing points past it to an account.
          ownerIdentityId: null,
          series: null, createdAt: row.sort_iso, date: null, marks: [], note: null, timeline: [],
          links: { public: host.urls.person?.({ id: pr.id, slug: pr.slug, entityType }) ?? null, studio: null },
          store: "person",
        };
        item.ownerName = pr.title;
        item.images = pr.cover ? [pr.cover] : [];
        // Signed-in viewers may pick (reference) a public identity; nothing else is offered on a person row.
        item.can = { edit: false, hide: false, publish: false, archive: false, pick: Boolean(rights) };
        item.person = {
          slug: pr.slug, entityType,
          listingKind: pr.org_user ? "organization" : entityType === "organization" ? "associated" : "artist",
          headline: pr.excerpt, city: pr.city, region: pr.region, country: pr.country,
          location: pr.location, verified: Boolean(pr.verified), vouches: pr.vouches, claimStatus: claim,
        };
        items.set(pr.key, item);
      }
    } catch (err) {
      console.error("[content] people:", err instanceof Error ? err.message : err);
      missing.push("people");
    }
  }

  const gone = rows.filter((r) => !items.has(r.key) && r.store !== "file").length;
  if (gone && !missing.some((m) => m.startsWith("threads") || m === "artwork")) missing.push(`${gone} indexed row(s) no longer exist or are unreadable`);
  return { items, missing, notes };
}
