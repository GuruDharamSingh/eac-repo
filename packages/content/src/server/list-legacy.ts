// PARITY REFERENCE ONLY (2026-11-26): the pre-searchContent loader, kept so scripts/check-search.mts can prove listContent parity. Delete in Step 7. Do not import elsewhere.

// ============================================================================
// @elkdonis/content/server: listContent, the library's server loader.
// docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md "Pass 2" / §2.6 of
// docs/open/CHANNEL_ON_SITES_2026-11-12.md (written 2026-11-12).
//
// Fills ContentListItem the way Channel does client-side today
// (apps/arts-collective/src/lib/channel/load.ts piece loop + content-list.ts
// channelPieceToListItem), so the two agree. Channel keeps its own mapping
// until a caller is switched.
//
// Query by org (`orgId`) or by person (`ownerUserId`). The caller picks; the
// developer has not decided which Make into uses (2026-11-12). Rights come
// from the viewer (access.ts), never from the query.
//
// Sources, per item: threads (row + metadata.shares), artwork (commerce
// queries), social_posts matched by link, email_sends kind 'notification',
// channel_deliveries. Deliveries, letters and social posts are the owner's
// working data: read only for a manager of the org (org query) or the person
// themself (person query), so other viewers get the public marks only.
//
// Not filled (reported in `missing`): failed publish_jobs, and the plan-based
// "open steps" note. This module is not marked `server-only`: that package is
// not a dependency here; keep it out of client bundles by importing
// `@elkdonis/content/server` from server code only.
// ============================================================================

import { db } from "@elkdonis/db";
import { listOrgHomes, type OrgHome } from "@elkdonis/services";
import { listChannelDeliveries, type ChannelDelivery, type ChannelOwner } from "@elkdonis/services/channel";
import { listArtworksForPerson, listStoreArtworks } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Artwork } from "@elkdonis/commerce/types";
import type {
  ContentCellState,
  ContentEvent,
  ContentLane,
  ContentListItem,
  ContentMark,
  ContentOutlet,
  ContentState,
  ContentStatus,
  ContentType,
} from "../model";
import { fmtDay } from "../model";
import { typeLabel } from "../registry";
import { mayManageOrg, PERSONAL_ORG, resolveRights, threadReadSql, type ContentRights, type ContentViewer } from "./access";

interface ContentListQuery {
  /** List an org's pieces. Exactly one of `orgId` / `ownerUserId`. */
  orgId?: string;
  /** List a person's pieces (authored threads, artwork made or credited). */
  ownerUserId?: string;
  /** Default: every type. */
  types?: ContentType[];
  /** Default: draft, scheduled, live, published. `archived` is not listed yet. */
  statuses?: ContentStatus[];
  /** Default 40, at most 200. */
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string | null;
}

interface ContentListResult {
  items: ContentListItem[];
  nextCursor: string | null;
  /** Sources that were not read or failed; never silently dropped. */
  missing: string[];
}

// ── constants shared with Channel (load.ts) ────────────────────────────────

/** Thread kinds that are pieces in a library, and how each is shown. `writing` is in OFF_FEED_KINDS
 *  (kept off feeds); a library is not a feed, so it is listed here on purpose. The other
 *  OFF_FEED_KINDS (wiki_page, document, series_session, tour, experience) are absent. */
const THREAD_TYPES: Record<string, ContentType> = {
  writing: "writing",
  post: "writing",
  meeting: "meeting",
  reading_group: "meeting",
  series: "series",
  workshop: "workshop",
  event: "event",
};
const TIME_ZONE = process.env.CHANNEL_TIME_ZONE ?? "America/Toronto";
const DAY_MS = 86_400_000;
const IN_MOTION_DAYS = 14;
const MARKET = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "https://market.arts-collective.com").replace(/\/$/, "");
const ARTDIRECT = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "https://directory.arts-collective.com").replace(/\/$/, "");
const NETWORK_HOST = (process.env.NEXT_PUBLIC_NETWORK_HOST || "localhost:3007").trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/\/.*$/, "");
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

// ── rows ───────────────────────────────────────────────────────────────────

interface Share { label?: string; kind?: string; url?: string | null; at?: string }

interface ThreadRow {
  id: string;
  org_id: string;
  author_id: string;
  kind: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  scheduled_at: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  video_url: string | null;
  cover: string | null;
  shares: Share[] | null;
  feed_name: string | null;
  next_session: Date | null;
  author_slug: string | null;
  author_name: string | null;
  sort_at: Date;
}

interface PostRow {
  id: string;
  org_id: string;
  owner_id: string;
  link: string | null;
  shares: Array<Share & { kind: string; label: string; at: string }> | null;
}

interface Draft {
  item: ContentListItem;
  /** Paging position: threads use COALESCE(published_at, updated_at), artwork updated_at. */
  sortAt: string;
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
  return {
    id, at, lane: LANE[outlet] ?? "site", source, verb: state, outlet, label, sub, state, identityId, href,
    refs: deliveryId ? { deliveryId } : undefined,
  };
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
      const sub = d.status === "scheduled"
        ? `${name} · scheduled`
        : `${name} · ${d.status === "failed" ? "failed" : "not published"}`;
      return event(`delivery:${d.id}`, d.scheduledAt ?? d.createdAt, outlet, state, p.title || p.suggestion || `${name} post`, sub, d.identityId, d.permalink, "delivery", d.id);
    });
}

/** Marks and status from the timeline, as Channel's finishPiece / statusOf / channelPieceToListItem do. */
function finish(
  base: Omit<ContentListItem, "marks" | "note" | "timeline" | "status" | "date">,
  timeline: ContentEvent[],
  rawStatus: string,
  eventAt: string | null,
  artwork: boolean,
  now: Date
): Omit<ContentListItem, never> {
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
    : timeline.some((e) => e.state === "live") ? "live"
    : timeline.some((e) => e.state === "scheduled") ? "scheduled"
    : "published";
  const last = timeline[timeline.length - 1];
  const nextAt = eventAt ?? timeline.find((e) => e.state === "scheduled" || e.state === "live")?.at ?? null;

  // "In motion": the first three rules of load.ts; the plan-based one needs plans (not read here).
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
    ...base,
    status,
    date: nextAt ?? last?.at ?? base.createdAt,
    marks,
    note: { text: motion ? `In motion · ${motion}` : quiet, motion: Boolean(motion) },
    timeline,
  };
}

// ── cursor ─────────────────────────────────────────────────────────────────

function encodeCursor(sortAt: string, key: string): string {
  return Buffer.from(`${sortAt}|${key}`).toString("base64url");
}
function decodeCursor(c: string | null | undefined): { at: string; key: string } | null {
  if (!c) return null;
  try {
    const raw = Buffer.from(c, "base64url").toString();
    const i = raw.indexOf("|");
    const at = raw.slice(0, i);
    const key = raw.slice(i + 1);
    if (i <= 0 || Number.isNaN(Date.parse(at)) || !/^(thread|artwork):[A-Za-z0-9_-]{1,64}$/.test(key)) return null;
    return { at: new Date(at).toISOString(), key };
  } catch {
    return null;
  }
}
/** Newest first; key breaks ties by code unit (SQL uses COLLATE "C" to match). */
const after = (a: { sortAt: string; key: string }, c: { at: string; key: string }): boolean =>
  a.sortAt < c.at || (a.sortAt === c.at && a.key < c.key);

// ── the loader ─────────────────────────────────────────────────────────────

export async function listContentLegacy(viewer: ContentViewer, query: ContentListQuery, preResolved?: ContentRights): Promise<ContentListResult> {
  const { orgId, ownerUserId } = query;
  if (Boolean(orgId) === Boolean(ownerUserId)) throw new Error("listContent: give exactly one of orgId or ownerUserId");
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 40), 1), 200);
  const cursor = decodeCursor(query.cursor);
  const now = new Date();
  const missing: string[] = ["publish_jobs", "plan"];

  const rights = preResolved ?? (await resolveRights(viewer));
  const [homes] = await Promise.all([listOrgHomes()]);
  const homeOf = (id: string) => homes.find((h) => h.orgId === id);
  const orgUrl = (id: string) => orgUrlOf(homeOf(id));

  // Working data (deliveries, letters, social posts) is the owner's: managers of the org, or the person.
  const isOwnerView = orgId ? mayManageOrg(rights, orgId) : ownerUserId === rights.userId || rights.isAdmin;
  const canSeeOps = isOwnerView;
  // Org managers see drafts of the org's artwork; everyone else only listed work.
  const seeUnlistedArtwork = isOwnerView;

  // Identity of "me" for the person view: the person listed (a pseudonym set is only disclosed to the person).
  const subjectUserId = ownerUserId ?? rights.userId;
  const authorIds = ownerUserId && ownerUserId !== rights.userId ? [ownerUserId] : rights.identityIds;
  const meId = `user:${subjectUserId}`;

  const wantType = (t: ContentType) => !query.types?.length || query.types.includes(t);
  const wantStatus = new Set<ContentStatus>(query.statuses?.length ? query.statuses : ["draft", "scheduled", "live", "published"]);
  const wantDraft = wantStatus.has("draft");
  const wantOut = wantStatus.has("published") || wantStatus.has("scheduled") || wantStatus.has("live");

  // ── threads ──────────────────────────────────────────────────────────────
  const threadDrafts: Draft[] = [];
  let threadRows: ThreadRow[] = [];
  const threadKinds = Object.keys(THREAD_TYPES).filter((k) => wantType(THREAD_TYPES[k]!) || (query.types?.includes("video") ?? false));
  if (threadKinds.length && (wantDraft || wantOut)) {
    const scope = orgId ? db`t.org_id = ${orgId}` : db`t.author_id = ANY(${authorIds})`;
    const statuses = [...(wantDraft ? ["draft"] : []), ...(wantOut ? ["published"] : [])];
    // Type filter in SQL so paging stays exact: video is any listed kind carrying a video_url (as Channel).
    const typeSql = query.types?.length
      ? db`AND (${query.types.includes("video") ? db`(t.video_url IS NOT NULL AND t.video_url <> '')` : db`false`}
              OR (COALESCE(t.video_url, '') = '' AND t.kind = ANY(${threadKinds.filter((k) => query.types!.includes(THREAD_TYPES[k]!))})))`
      : db``;
    const cursorSql = cursor
      ? db`AND (COALESCE(t.published_at, t.updated_at), ('thread:' || t.id) COLLATE "C") < (${cursor.at}::timestamptz, ${cursor.key}::text COLLATE "C")`
      : db``;
    try {
      threadRows = await db<ThreadRow[]>`
        SELECT t.id, t.org_id, t.author_id, t.kind, t.title, t.slug, t.excerpt, t.status,
               t.scheduled_at, t.published_at, t.created_at, t.updated_at, t.video_url,
               t.metadata->>'coverImageUrl' AS cover,
               CASE WHEN jsonb_typeof(t.metadata->'shares') = 'array' THEN t.metadata->'shares' ELSE NULL END AS shares,
               f.name AS feed_name, u.slug AS author_slug, u.display_name AS author_name,
               (SELECT min(s.scheduled_at) FROM threads s
                 WHERE s.kind = 'series_session' AND s.status = 'published'
                   AND s.metadata->>'seriesId' = t.id AND s.scheduled_at > now()) AS next_session,
               COALESCE(t.published_at, t.updated_at) AS sort_at
        FROM threads t
        LEFT JOIN org_feeds f ON f.slug = t.section AND f.org_id = t.org_id
        LEFT JOIN users u ON u.id = t.author_id
        WHERE t.kind = ANY(${threadKinds}) AND t.status = ANY(${statuses})
          AND ${scope}
          AND ${threadReadSql(rights)}
          ${typeSql}
          ${cursorSql}
        ORDER BY COALESCE(t.published_at, t.updated_at) DESC, ('thread:' || t.id) COLLATE "C" DESC
        LIMIT ${limit + 1}
      `;
    } catch (err) {
      console.error("[content] threads:", err instanceof Error ? err.message : err);
      missing.push("threads");
    }
  }

  // ── artwork ──────────────────────────────────────────────────────────────
  let artworks: Artwork[] = [];
  const pinnedStores = new Map<string, string>(); // storeId → orgId whose site shows it
  if (wantType("artwork") || wantType("product")) {
    try {
      if (orgId) {
        const storeRows = await db<Array<{ id: string; pinned: boolean }>>`
          SELECT s.id, false AS pinned FROM store s WHERE s.owner_org_id = ${orgId}
          UNION
          SELECT s.id, true AS pinned FROM site_config c JOIN store s ON s.id::text = c.value->>'storeId'
          WHERE c.org_id = ${orgId} AND c.key = 'shop:store'
        `;
        for (const s of storeRows) if (s.pinned) pinnedStores.set(s.id, orgId);
        artworks = (await Promise.all(storeRows.map((s) => listStoreArtworks(s.id)))).flat();
      } else {
        artworks = await listArtworksForPerson(subjectUserId, { limit: 200 });
        const pins = rights.managedOrgIds.length
          ? await db<Array<{ org_id: string; store_id: string }>>`
              SELECT c.org_id, c.value->>'storeId' AS store_id FROM site_config c
              WHERE c.key = 'shop:store' AND c.org_id = ANY(${rights.managedOrgIds})
            `
          : [];
        for (const p of pins) if (p.store_id) pinnedStores.set(p.store_id, p.org_id);
      }
    } catch (err) {
      console.error("[content] artwork:", err instanceof Error ? err.message : err);
      missing.push("artwork");
    }
    const seen = new Set<string>();
    artworks = artworks.filter((a) => {
      if (a.status === "archived" || seen.has(a.id)) return false;
      if (!seeUnlistedArtwork && !LISTED_ARTWORK.includes(a.status)) return false;
      if (!wantDraft && a.status === "draft") return false;
      if (!wantOut && a.status !== "draft") return false;
      const type: ContentType = a.kind && a.kind !== "original" ? "product" : "artwork";
      if (!wantType(type)) return false;
      seen.add(a.id);
      return true;
    });
  }

  // ── history sources (owner only) ─────────────────────────────────────────
  const owners: ChannelOwner[] = [orgId ? { kind: "org", id: orgId } : { kind: "user", id: subjectUserId }];
  const threadIds = threadRows.map((t) => t.id);
  let posts: PostRow[] = [];
  let letters: Array<{ thread_id: string; n: number; last: Date }> = [];
  let deliveries: ChannelDelivery[] = [];
  if (canSeeOps) {
    const [p, l, d] = await Promise.all([
      db<PostRow[]>`
        SELECT id, org_id, owner_id, link, shares FROM social_posts
        WHERE archived_at IS NULL AND link IS NOT NULL
          AND ${orgId ? db`org_id = ${orgId}` : db`owner_id = ${subjectUserId}`}
        ORDER BY updated_at DESC LIMIT 400
      `.catch((err) => { console.error("[content] social posts:", err instanceof Error ? err.message : err); missing.push("social_posts"); return [] as PostRow[]; }),
      threadIds.length
        ? db<Array<{ thread_id: string; n: number; last: Date }>>`
            SELECT thread_id, count(*)::int AS n, max(sent_at) AS last FROM email_sends
            WHERE kind = 'notification' AND thread_id = ANY(${threadIds})
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

  // Which identity a row is shown under: the listed org, else the org it was posted in when the viewer runs it, else the person.
  const identityFor = (rowOrg: string, authorId: string): string => {
    if (orgId) return `org:${orgId}`;
    const mine = authorIds.includes(authorId);
    if (rowOrg === PERSONAL_ORG || mine) return rowOrg !== PERSONAL_ORG && rights.managedOrgIds.includes(rowOrg) ? `org:${rowOrg}` : meId;
    return rights.managedOrgIds.includes(rowOrg) ? `org:${rowOrg}` : meId;
  };
  const postIdentity = (p: PostRow) => (p.org_id === PERSONAL_ORG ? meId : `org:${p.org_id}`);

  for (const t of threadRows) {
    const key = `thread:${t.id}`;
    const type: ContentType = t.video_url ? "video" : THREAD_TYPES[t.kind] ?? "writing";
    const ownerIdentity = identityFor(t.org_id, t.author_id);
    const personal = t.org_id === PERSONAL_ORG || t.kind === "writing";
    const mine = authorIds.includes(t.author_id);
    const siteUrl = personal ? (t.author_slug ? `${ARTDIRECT}/${t.author_slug}` : null) : orgUrl(t.org_id);
    const href = personal ? (t.author_slug ? `${ARTDIRECT}/${t.author_slug}/writing/${t.slug}` : null) : siteUrl ? `${siteUrl}/${t.slug}` : null;
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
    for (const p of href ? postsByLink.get(href) ?? [] : []) timeline.push(...shareEvents(p.shares, postIdentity(p), `post:${p.id}`));
    const letter = letterBy.get(t.id);
    if (letter) timeline.push(event(`${key}:letter`, iso(letter.last)!, "newsletter", "published", "Emailed", `Email · ${letter.n} ${letter.n === 1 ? "person" : "people"}`, `org:${t.org_id}`, null, "email"));
    timeline.push(...deliveryEvents(deliveriesBy.get(key) ?? []));

    const draft = finish({
      key, type, title: t.title || "Untitled",
      meta: [typeLabel(type), t.feed_name, eventAt ? `next ${fmtDay(eventAt, TIME_ZONE)}` : null].filter(Boolean).join(" · "),
      excerpt: (t.excerpt ?? "").slice(0, 280),
      cover: t.cover, siteIdentityId, siteName, siteHost: hostOf(siteUrl), ownerIdentityId: ownerIdentity,
      series: null, createdAt: iso(t.created_at)!,
      links: { public: href, studio: `/studio?id=${encodeURIComponent(t.id)}${personal ? "" : `&org=${encodeURIComponent(t.org_id)}`}` },
    }, timeline, t.status, eventAt, false, now);
    threadDrafts.push({ item: draft, sortAt: iso(t.sort_at)! });
  }

  const artDrafts: Draft[] = [];
  for (const a of artworks) {
    const key = `artwork:${a.id}`;
    const type: ContentType = a.kind && a.kind !== "original" ? "product" : "artwork";
    const pinnedOrg = pinnedStores.get(a.storeId) ?? null;
    const siteUrl = pinnedOrg ? orgUrl(pinnedOrg) : null;
    const href = siteUrl ? `${siteUrl}/pieces/${a.slug}` : `${MARKET}/artworks/${a.id}`;
    const v = a.variants?.[0];
    const price = v && typeof v.priceMinor === "number" && v.priceMinor > 0 && v.currency ? formatMoney(v.priceMinor, v.currency) : null;
    const size = a.heightCm && a.widthCm ? `${Number(a.heightCm)} × ${Number(a.widthCm)} cm` : null;
    const listed = LISTED_ARTWORK.includes(a.status);
    const ownerIdentity = orgId ? `org:${orgId}` : meId;

    const timeline: ContentEvent[] = [];
    if (listed) {
      timeline.push(event(`${key}:market`, iso(a.createdAt)!, "market", "published",
        a.status === "sold" ? "Sold" : price ? `Listed for sale · ${price}` : "Listed, price on request", hostOf(MARKET) ?? "Market", ownerIdentity, `${MARKET}/artworks/${a.id}`, "thread"));
      if (pinnedOrg && siteUrl)
        timeline.push(event(`${key}:site`, iso(a.createdAt)!, "site", "published", `On ${homeOf(pinnedOrg)?.orgName ?? "the site"}`, `${hostOf(siteUrl)}/pieces/${a.slug}`, `org:${pinnedOrg}`, href, "thread"));
    } else {
      timeline.push(event(`${key}:draft`, iso(a.updatedAt)!, "market", "draft", "Draft listing", "Market · not listed", ownerIdentity, null, "thread"));
    }
    for (const p of [...(postsByLink.get(href) ?? []), ...(postsByLink.get(`${MARKET}/artworks/${a.id}`) ?? [])])
      timeline.push(...shareEvents(p.shares, postIdentity(p), `post:${p.id}`));
    timeline.push(...deliveryEvents(deliveriesBy.get(key) ?? []));

    const draft = finish({
      key, type, title: a.title,
      meta: [a.medium, size, price, a.status === "sold" ? "sold" : null].filter(Boolean).join(" · ") || typeLabel(type),
      excerpt: (a.descriptionHtml ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280),
      cover: a.primaryImageUrl ?? null,
      siteIdentityId: pinnedOrg ? `org:${pinnedOrg}` : ownerIdentity,
      siteName: pinnedOrg ? homeOf(pinnedOrg)?.orgName ?? "Site" : "Market",
      siteHost: pinnedOrg ? hostOf(siteUrl) : hostOf(MARKET),
      ownerIdentityId: ownerIdentity, series: null, createdAt: a.createdAt,
      links: { public: href, studio: `${MARKET}/studio` },
    }, timeline, a.status, null, true, now);
    artDrafts.push({ item: draft, sortAt: iso(a.updatedAt)! });
  }

  // ── merge, filter, page ──────────────────────────────────────────────────
  let merged = [...threadDrafts, ...artDrafts]
    .map((d) => ({ ...d, key: d.item.key }))
    .filter((d) => wantStatus.has(d.item.status));
  if (cursor) merged = merged.filter((d) => after(d, cursor));
  merged.sort((a, b) => (a.sortAt === b.sortAt ? (a.key < b.key ? 1 : -1) : a.sortAt < b.sortAt ? 1 : -1));
  const page = merged.slice(0, limit);
  const last = page[page.length - 1];
  // More when the merged set overflowed, or the thread query itself hit its limit+1 probe.
  const more = merged.length > limit || threadRows.length > limit;
  return {
    items: page.map((d) => d.item),
    nextCursor: more && last ? encodeCursor(last.sortAt, last.key) : null,
    missing,
  };
}
