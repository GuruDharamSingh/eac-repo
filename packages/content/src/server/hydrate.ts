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

interface PostRow {
  id: string; org_id: string; owner_id: string; link: string | null;
  shares: Array<Share & { kind: string; label: string; at: string }> | null;
}

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const hostOf = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try { return new URL(url).host; } catch { return null; }
};

function orgUrlOf(home: OrgHome | undefined): string | null {
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
export async function hydrateRows(rows: IndexRow[], ctx: HydrateCtx): Promise<{ items: Map<string, ContentListItem>; missing: string[] }> {
  const { rights, scope, host, now } = ctx;
  const missing: string[] = ["publish_jobs", "plan"];
  const items = new Map<string, ContentListItem>();
  if (!rows.length) return { items, missing };

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
               pv.price_minor, pv.currency, COALESCE(st.display_name, a.store_id::text) AS store_name,
               COALESCE(CASE WHEN a.credit_status = 'credited' THEN cu.display_name END, a.metadata->>'artistName', au.display_name, st.display_name) AS owner_name,
               EXISTS (SELECT 1 FROM auction_lot l JOIN artwork_variant v ON v.id = l.artwork_variant_id
                        WHERE v.artwork_id = a.id AND l.status IN ('scheduled', 'live')) AS open_lot
        FROM artwork a
        LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
        LEFT JOIN store st ON st.id = a.store_id
        LEFT JOIN users au ON au.id = a.artist_user_id
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
    missing.push("owner-only sources (social posts, letters, deliveries) not read for this viewer");
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
    if (keeper) item.hidden = row.hidden;
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
    if (keeper) item.hidden = row.hidden;
    items.set(key, item);
  }

  const gone = rows.filter((r) => !items.has(r.key) && r.store !== "file").length;
  if (gone && !missing.some((m) => m.startsWith("threads") || m === "artwork")) missing.push(`${gone} indexed row(s) no longer exist or are unreadable`);
  return { items, missing };
}
