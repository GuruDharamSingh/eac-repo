import "server-only";
import { db } from "@elkdonis/db";
import {
  getIdentityIds,
  getProfile,
  listConnections,
  listOrgChannels,
  listOrgHomes,
  listUserMemberships,
} from "@elkdonis/services";
import {
  addDays,
  channelReady,
  describeCadence,
  listChannelDeliveries,
  listChannelPlans,
  listChannelRoutines,
  listChannelRules,
  listChannelTodos,
  routineSlots,
  zonedDate,
  type ChannelDelivery,
  type ChannelOwner,
  type ChannelRoutine,
  type ChannelTodo,
} from "@elkdonis/services/channel";
import { parsePlan } from "@elkdonis/services/channel-plan-md";
import { listArtworksForPerson, listStoreArtworks } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Artwork } from "@elkdonis/commerce/types";
import type { SessionUser } from "@/lib/session";
import { getOrgHomeUrl } from "@/lib/org-url";
import {
  COVERAGE_COLUMNS,
  MATRIX_COLUMNS,
  fmtDay,
  fmtWeekdayTime,
  initialsOf,
  kindLabel,
  type Cell,
  type ChannelIdentity,
  type ChannelLinks,
  type ChannelModel,
  type CoverageColumn,
  type DayItem,
  type DayView,
  type ItemState,
  type MatrixColumn,
  type Outlet,
  type OutletStatus,
  type Piece,
  type PieceKind,
  type RoutineView,
  type Suggestion,
  type TimelineEntry,
  type TrayItem,
} from "./model";

// ============================================================================
// /channel loader: one request's worth of everything the Channel screens show
// for the signed-in person (artist scope) or one org they run (org scope).
//
// History is read from the tables that already record it:
//   threads (published_at)            → Website / your page
//   artwork (status, store)           → Market, the org's site
//   threads.metadata.shares           → Instagram / Facebook / Threads (Studio "Post to")
//   social_posts.shares (link = page) → the same, from the Post kind
//   publish_jobs (failed)             → failures
//   email_sends kind 'notification'   → Letter (assumed: the follower mail-out)
// Plans, to-dos, routines and planned deliveries come from migration 252
// (@elkdonis/services/channel); before it is applied they are empty and the
// model says `ready: false`.
//
// Every read is best-effort: a failed source empties its part of the page.
// docs/open/channel.md.
// ============================================================================

const MARKET = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "https://market.arts-collective.com").replace(/\/$/, "");
const ARTDIRECT = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "https://directory.arts-collective.com").replace(/\/$/, "");
const TIME_ZONE = process.env.CHANNEL_TIME_ZONE ?? "America/Toronto";
const MANAGER_ROLES = new Set(["owner", "guide"]);

/**
 * Where an org lives comes from org_domains (its verified primary row, read by
 * listOrgHomes), own-app sites included: katie → pottery.arts-collective.com
 * and elktours → elkdonisexperiences.com since migration 263, which retired the
 * hard-coded OWN_APP_SITES list (owner, 2026-11-07: an org_domains row wins;
 * take Katie's entry out then). This copy is used ONLY when that read fails
 * outright (listOrgHomes returns no orgs at all), and the log says so.
 */
const HOMES_FALLBACK: Record<string, string> = {
  "katie-the-potter": "https://pottery.arts-collective.com",
  elktours: "https://elkdonisexperiences.com",
};
const PERSONAL_ORG = "oad";
const DAY_MS = 86_400_000;
const IN_MOTION_DAYS = 14;

/** Thread kinds that are pieces of work in a channel, and what Channel calls them. */
const THREAD_KINDS: Record<string, PieceKind> = {
  writing: "writing",
  post: "writing",
  meeting: "meeting",
  reading_group: "meeting",
  series: "series",
  workshop: "workshop",
  event: "event",
};

async function safe<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.error(`[channel] ${label}:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

const host = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const isoOf = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

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
  shares: Array<{ label?: string; kind?: string; url?: string | null; at?: string; targetId?: string }> | null;
  feed_name: string | null;
  next_session: Date | null;
  author_slug: string | null;
  author_name: string | null;
}

interface PostRow {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  link: string | null;
  shares: Array<{ kind: string; label: string; url: string | null; at: string; targetId?: string }> | null;
  updated_at: Date;
}

export interface LoadParams {
  org?: string;
  week?: string;
  /** "month" shows five weeks from the Sunday on or before `week`. */
  span?: "week" | "month";
  notice?: string;
}

export async function loadChannelModel(user: SessionUser, params: LoadParams): Promise<ChannelModel> {
  const now = new Date();
  const today = zonedDate(now, TIME_ZONE);

  const [profile, memberships, homes, ready, identityIds] = await Promise.all([
    safe("profile", getProfile(user.id), null),
    safe("memberships", listUserMemberships(user.id), []),
    safe("org homes", listOrgHomes(), []),
    safe("ready", channelReady(), false),
    safe("identity ids", getIdentityIds(user.id), [user.id]),
  ]);

  const orgs = memberships
    .filter((m) => MANAGER_ROLES.has(m.role) && m.orgId !== PERSONAL_ORG)
    .map((m) => ({ orgId: m.orgId, name: m.orgName, slug: m.orgSlug, role: m.role }));
  const scopeOrg = params.org ? orgs.find((o) => o.orgId === params.org || o.slug === params.org) ?? null : null;
  const homeOf = (orgId: string) => homes.find((h) => h.orgId === orgId) ?? null;
  // No orgs at all means the organizations/org_domains read failed (listOrgHomes logs why).
  const homesDown = homes.length === 0;
  if (homesDown) console.error("[channel] org homes unavailable; own-app sites use HOMES_FALLBACK");
  const orgUrl = (orgId: string): string | null => {
    const h = homeOf(orgId);
    if (h?.primaryDomain) return getOrgHomeUrl({ slug: h.orgSlug, primaryDomain: h.primaryDomain });
    if (homesDown && HOMES_FALLBACK[orgId]) return HOMES_FALLBACK[orgId];
    return h ? getOrgHomeUrl({ slug: h.orgSlug, primaryDomain: null }) : null;
  };

  // ── identities ────────────────────────────────────────────────────────────
  const viewerName = profile?.displayName || user.email.split("@")[0];
  const viewerSlug = profile?.slug ?? null;
  const me: ChannelIdentity = {
    id: `user:${user.id}`,
    kind: "user",
    name: viewerName,
    shortName: "You",
    initials: initialsOf(viewerName),
    avatarUrl: profile?.avatarUrl ?? null,
    orgId: null,
    siteName: "Your page",
    siteHost: viewerSlug ? `${host(ARTDIRECT)}/${viewerSlug}` : null,
    siteUrl: viewerSlug ? `${ARTDIRECT}/${viewerSlug}` : null,
  };
  const orgIdentity = (o: { orgId: string; name: string }): ChannelIdentity => {
    const url = orgUrl(o.orgId);
    return {
      id: `org:${o.orgId}`,
      kind: "org",
      name: o.name,
      shortName: o.name.split(/\s+/).slice(0, 2).join(" "),
      initials: initialsOf(o.name),
      avatarUrl: null,
      orgId: o.orgId,
      siteName: o.name,
      siteHost: host(url),
      siteUrl: url,
    };
  };
  const identities: ChannelIdentity[] = scopeOrg ? [orgIdentity(scopeOrg)] : [me, ...orgs.map(orgIdentity)];
  const identityFor = (orgId: string, authorId: string): string => {
    if (scopeOrg) return `org:${scopeOrg.orgId}`;
    if (orgId === PERSONAL_ORG || identityIds.includes(authorId)) {
      // Authored by the viewer: on their page when personal, else under the org it was posted in (if they run it).
      if (orgId !== PERSONAL_ORG && orgs.some((o) => o.orgId === orgId)) return `org:${orgId}`;
      return me.id;
    }
    return orgs.some((o) => o.orgId === orgId) ? `org:${orgId}` : me.id;
  };

  const owners: ChannelOwner[] = scopeOrg
    ? [{ kind: "org", id: scopeOrg.orgId }]
    : [{ kind: "user", id: user.id }, ...orgs.map((o) => ({ kind: "org" as const, id: o.orgId }))];
  const primaryOwner: ChannelOwner = owners[0]!;

  // ── pieces: threads ───────────────────────────────────────────────────────
  const kinds = Object.keys(THREAD_KINDS);
  const threadRows = await safe(
    "threads",
    db<ThreadRow[]>`
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
      WHERE t.kind = ANY(${kinds}) AND t.status IN ('published', 'draft')
        AND ${
          scopeOrg
            ? db`t.org_id = ${scopeOrg.orgId}`
            : // Artist scope: what the person wrote, plus their orgs' dated or recent pieces
              // (artist and org content appear together; design README "Scope").
              db`(t.author_id = ANY(${identityIds}) OR (t.org_id = ANY(${orgs.length ? orgs.map((o) => o.orgId) : [""]})
                 AND t.status = 'published' AND t.kind <> 'writing'
                 AND (t.scheduled_at > now() OR t.published_at > now() - interval '45 days')))`
        }
      ORDER BY COALESCE(t.published_at, t.updated_at) DESC
      LIMIT 160
    `,
    [] as ThreadRow[]
  );

  // ── pieces: artwork ───────────────────────────────────────────────────────
  let artworks: Artwork[] = [];
  const pinnedStores = new Map<string, string>(); // storeId → orgId whose site shows it
  if (scopeOrg) {
    const storeRows = await safe(
      "org stores",
      db<Array<{ id: string; pinned: boolean }>>`
        SELECT s.id, false AS pinned FROM store s WHERE s.owner_org_id = ${scopeOrg.orgId}
        UNION
        SELECT s.id, true AS pinned FROM site_config c JOIN store s ON s.id::text = c.value->>'storeId'
        WHERE c.org_id = ${scopeOrg.orgId} AND c.key = 'shop:store'
      `,
      [] as Array<{ id: string; pinned: boolean }>
    );
    for (const s of storeRows) if (s.pinned) pinnedStores.set(s.id, scopeOrg.orgId);
    const lists = await Promise.all(storeRows.map((s) => safe(`store ${s.id}`, listStoreArtworks(s.id), [] as Artwork[])));
    artworks = lists.flat();
  } else {
    artworks = await safe("my artworks", listArtworksForPerson(user.id, { limit: 120 }), [] as Artwork[]);
    if (orgs.length && artworks.length) {
      const pins = await safe(
        "site pins",
        db<Array<{ org_id: string; store_id: string }>>`
          SELECT c.org_id, c.value->>'storeId' AS store_id FROM site_config c
          WHERE c.key = 'shop:store' AND c.org_id = ANY(${orgs.map((o) => o.orgId)})
        `,
        [] as Array<{ org_id: string; store_id: string }>
      );
      for (const p of pins) if (p.store_id) pinnedStores.set(p.store_id, p.org_id);
    }
  }
  artworks = artworks.filter((a) => a.status !== "archived");
  const seenArt = new Set<string>();
  artworks = artworks.filter((a) => (seenArt.has(a.id) ? false : (seenArt.add(a.id), true)));

  // ── history sources ───────────────────────────────────────────────────────
  const threadIds = threadRows.map((t) => t.id);
  const [posts, failedJobs, letters, deliveries, plans, routines, rules, todos, connections, orgChannelLists, igUsed] = await Promise.all([
    safe(
      "social posts",
      db<PostRow[]>`
        SELECT id, org_id, owner_id, title, link, shares, updated_at FROM social_posts
        WHERE archived_at IS NULL AND link IS NOT NULL
          AND ${scopeOrg ? db`org_id = ${scopeOrg.orgId}` : db`owner_id = ${user.id}`}
        ORDER BY updated_at DESC LIMIT 400
      `,
      [] as PostRow[]
    ),
    safe(
      "failed jobs",
      db<Array<{ source_kind: string; source_id: string; provider: string; target_label: string; error: string | null; created_at: Date }>>`
        SELECT source_kind, source_id, provider, target_label, error, created_at FROM publish_jobs
        WHERE status = 'failed' AND created_at > now() - interval '30 days'
          AND ${scopeOrg ? db`org_id = ${scopeOrg.orgId}` : db`requested_by = ${user.id}`}
      `,
      [] as Array<{ source_kind: string; source_id: string; provider: string; target_label: string; error: string | null; created_at: Date }>
    ),
    threadIds.length
      ? safe(
          "letters",
          db<Array<{ thread_id: string; n: number; last: Date }>>`
            SELECT thread_id, count(*)::int AS n, max(sent_at) AS last FROM email_sends
            WHERE kind = 'notification' AND thread_id = ANY(${threadIds})
            GROUP BY thread_id
          `,
          [] as Array<{ thread_id: string; n: number; last: Date }>
        )
      : Promise.resolve([] as Array<{ thread_id: string; n: number; last: Date }>),
    safe("deliveries", listChannelDeliveries(owners), [] as ChannelDelivery[]),
    safe("plans", listChannelPlans(owners), []),
    safe("routines", listChannelRoutines(owners), [] as ChannelRoutine[]),
    safe("rules", listChannelRules(owners), []),
    safe("todos", listChannelTodos(primaryOwner, addDays(today, -7), addDays(today, 42)), [] as ChannelTodo[]),
    safe("connections", listConnections(user.id), []),
    Promise.all((scopeOrg ? [scopeOrg] : orgs).map((o) => safe(`org channels ${o.orgId}`, listOrgChannels(o.orgId), []))),
    safe(
      "instagram quota",
      db<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM publish_jobs
        WHERE requested_by = ${user.id} AND status IN ('done', 'running', 'queued')
          AND created_at > now() - interval '24 hours'
          AND (provider = 'instagram' OR (provider = 'meta' AND target_label ILIKE '%instagram%'))
      `,
      [{ n: 0 }]
    ),
  ]);
  const orgChannels = orgChannelLists.flat();

  // ── outlets ───────────────────────────────────────────────────────────────
  const live = connections.filter((c) => c.status === "connected");
  const igAccounts = live.flatMap((c) =>
    c.provider === "meta" ? c.targets.filter((t) => t.instagramUsername).map((t) => `@${t.instagramUsername}`) : c.provider === "instagram" && c.accountName ? [`@${c.accountName}`] : []
  );
  const fbAccounts = live.flatMap((c) => (c.provider === "meta" ? c.targets.filter((t) => t.canPublish).map((t) => t.name) : []));
  const ytAccounts = live.filter((c) => c.provider === "youtube").map((c) => c.accountName ?? "YouTube");
  const threadsAccounts = live.filter((c) => c.provider === "threads").map((c) => c.accountName ?? "Threads");
  const orgHas = (...providers: string[]) => [...new Set(orgChannels.filter((c) => providers.includes(c.provider)).map((c) => `org:${c.orgId}`))];
  const socialIdentities = (personal: boolean, ...providers: string[]) => [...(personal && !scopeOrg ? [me.id] : []), ...orgHas(...providers)];
  const igLeft = Math.max(0, 25 - (igUsed[0]?.n ?? 0));
  const outlets: OutletStatus[] = [
    { id: "site", label: "Website", connected: true, left: null, total: null, identityIds: identities.map((i) => i.id), accounts: identities.map((i) => i.siteHost ?? i.name) },
    { id: "instagram", label: "Instagram", connected: igAccounts.length > 0, left: igAccounts.length ? igLeft : null, total: 25, identityIds: socialIdentities(igAccounts.length > 0, "meta", "instagram"), accounts: igAccounts },
    { id: "facebook", label: "Facebook", connected: fbAccounts.length > 0, left: null, total: null, identityIds: socialIdentities(fbAccounts.length > 0, "meta"), accounts: fbAccounts },
    { id: "threads", label: "Threads", connected: threadsAccounts.length > 0, left: null, total: null, identityIds: socialIdentities(threadsAccounts.length > 0, "threads"), accounts: threadsAccounts },
    { id: "youtube", label: "YouTube", connected: ytAccounts.length > 0, left: null, total: null, identityIds: socialIdentities(ytAccounts.length > 0, "youtube"), accounts: ytAccounts },
  ];
  const connected = (o: Outlet) => outlets.find((x) => x.id === o)?.connected ?? false;

  // ── assemble pieces ───────────────────────────────────────────────────────
  const postsByLink = new Map<string, PostRow[]>();
  for (const p of posts) if (p.link) postsByLink.set(p.link, [...(postsByLink.get(p.link) ?? []), p]);
  const letterBy = new Map(letters.map((l) => [l.thread_id, l]));
  const planBy = new Map(plans.map((p) => [`${p.subject.kind}:${p.subject.id}`, p]));
  const deliveriesBy = new Map<string, ChannelDelivery[]>();
  for (const d of deliveries) {
    const k = `${d.subject.kind}:${d.subject.id}`;
    deliveriesBy.set(k, [...(deliveriesBy.get(k) ?? []), d]);
  }
  const todosBy = new Map<string, number>();
  for (const t of todos) if (t.subject && !t.done) todosBy.set(`${t.subject.kind}:${t.subject.id}`, (todosBy.get(`${t.subject.kind}:${t.subject.id}`) ?? 0) + 1);

  const shareOutlet = (kind: string | undefined, label: string | undefined): Outlet => {
    const k = (kind ?? "").toLowerCase();
    if (k === "instagram" || k === "iglogin" || /instagram/i.test(label ?? "")) return "instagram";
    if (k === "threads") return "threads";
    return "facebook";
  };
  const shareEntries = (
    shares: Array<{ label?: string; kind?: string; url?: string | null; at?: string }> | null | undefined,
    identityId: string,
    keyBase: string
  ): TimelineEntry[] =>
    (shares ?? [])
      .filter((s) => s && s.at)
      .map((s, i) => {
        const outlet = shareOutlet(s.kind, s.label);
        return {
          id: `${keyBase}:share:${i}`,
          at: new Date(s.at!).toISOString(),
          outlet,
          identityId,
          label: outlet === "instagram" ? "Posted to Instagram" : outlet === "threads" ? "Posted to Threads" : "Shared to Facebook",
          sub: `${outlet === "instagram" ? "Instagram" : outlet === "threads" ? "Threads" : "Facebook"} · ${s.label ?? ""}`.replace(/ · $/, ""),
          state: "published" as ItemState,
          href: s.url ?? null,
          deliveryId: null,
        };
      });

  const deliveryEntries = (key: string): TimelineEntry[] =>
    (deliveriesBy.get(key) ?? [])
      .filter((d) => d.status !== "dismissed")
      .map((d) => {
        const p = d.payload as { title?: string; text?: string; suggestion?: string };
        const state: ItemState = d.status === "scheduled" ? (d.outlet === "live" ? "live" : "scheduled") : d.status === "failed" ? "failed" : d.status === "published" ? "published" : "draft";
        return {
          id: `delivery:${d.id}`,
          at: d.scheduledAt ?? d.createdAt,
          outlet: d.outlet as Outlet,
          identityId: d.identityId,
          label: p.title || p.suggestion || `${outletName(d.outlet as Outlet)} post`,
          sub:
            d.status === "scheduled"
              ? `${outletName(d.outlet as Outlet)} · scheduled for ${fmtWeekdayTime(d.scheduledAt, TIME_ZONE)}`
              : `${outletName(d.outlet as Outlet)} · ${d.status === "failed" ? "failed" : "not published"}`,
          state,
          href: d.permalink,
          deliveryId: d.id,
        };
      });

  const pieces: Piece[] = [];

  for (const t of threadRows) {
    const kind: PieceKind = t.video_url ? "video" : THREAD_KINDS[t.kind] ?? "writing";
    const key = `thread:${t.id}`;
    const ownerId = identityFor(t.org_id, t.author_id);
    const personal = t.org_id === PERSONAL_ORG || t.kind === "writing";
    const mine = identityIds.includes(t.author_id);
    // A person's writing lives on its author's ArtDirect page, not the viewer's.
    const siteUrl = personal ? (t.author_slug ? `${ARTDIRECT}/${t.author_slug}` : null) : orgUrl(t.org_id);
    const href = personal ? (t.author_slug ? `${ARTDIRECT}/${t.author_slug}/writing/${t.slug}` : null) : siteUrl ? `${siteUrl}/${t.slug}` : null;
    const siteIdentityId = personal && mine && !scopeOrg ? me.id : `org:${t.org_id}`;
    const siteName = personal ? (mine ? "Your page" : `${t.author_name ?? "Author"}'s page`) : homeOf(t.org_id)?.orgName ?? t.org_id;
    const eventAt = isoOf(t.next_session) ?? (t.scheduled_at && t.scheduled_at > now ? isoOf(t.scheduled_at) : null);

    const timeline: TimelineEntry[] = [];
    if (t.status === "published" && t.published_at) {
      timeline.push({
        id: `${key}:site`,
        at: isoOf(t.published_at)!,
        outlet: personal ? "page" : "site",
        identityId: siteIdentityId,
        label: personal ? (mine ? "Added to your page" : `On ${t.author_name ?? "the author"}'s page`) : `Published${t.feed_name ? ` in ${t.feed_name}` : ""}`,
        sub: [host(siteUrl), href ? new URL(href).pathname : null].filter(Boolean).join(""),
        state: "published",
        href,
        deliveryId: null,
      });
    } else if (t.status === "draft") {
      timeline.push({ id: `${key}:draft`, at: isoOf(t.updated_at)!, outlet: personal ? "page" : "site", identityId: siteIdentityId, label: "Draft", sub: "Website · not published", state: "draft", href: null, deliveryId: null });
    }
    timeline.push(...shareEntries(t.shares, ownerId, key));
    for (const p of href ? postsByLink.get(href) ?? [] : []) timeline.push(...shareEntries(p.shares, p.org_id === PERSONAL_ORG ? me.id : `org:${p.org_id}`, `post:${p.id}`));
    const letter = letterBy.get(t.id);
    if (letter) timeline.push({ id: `${key}:letter`, at: isoOf(letter.last)!, outlet: "newsletter", identityId: `org:${t.org_id}`, label: "Emailed", sub: `Email · ${letter.n} ${letter.n === 1 ? "person" : "people"}`, state: "published", href: null, deliveryId: null });
    for (const j of failedJobs.filter((j) => j.source_kind === "thread" && j.source_id === t.id))
      timeline.push({ id: `${key}:fail:${j.created_at.toISOString()}`, at: isoOf(j.created_at)!, outlet: shareOutlet(j.provider, j.target_label), identityId: ownerId, label: `Did not post to ${j.target_label || j.provider}`, sub: j.error ?? "Failed", state: "failed", href: null, deliveryId: null });
    timeline.push(...deliveryEntries(key));

    pieces.push(
      finishPiece({
        key,
        subject: { kind: "thread", id: t.id },
        kind,
        title: t.title || "Untitled",
        meta: [kindLabel(kind), t.feed_name, eventAt ? `next ${fmtDay(eventAt, TIME_ZONE)}` : null].filter(Boolean).join(" · "),
        excerpt: (t.excerpt ?? "").slice(0, 280),
        imageUrl: t.cover,
        status: t.status,
        ownerIdentityId: ownerId,
        presentedById: ownerId === me.id && !personal ? `org:${t.org_id}` : null,
        siteIdentityId,
        siteName,
        siteHost: host(siteUrl),
        href,
        studioHref: `/studio?id=${encodeURIComponent(t.id)}${personal ? "" : `&org=${encodeURIComponent(t.org_id)}`}`,
        createdAt: isoOf(t.created_at)!,
        eventAt,
        timeline,
      })
    );
  }

  for (const a of artworks) {
    const key = `artwork:${a.id}`;
    const kind: PieceKind = a.kind && a.kind !== "original" ? "product" : "artwork";
    const pinnedOrg = pinnedStores.get(a.storeId) ?? null;
    const siteUrl = pinnedOrg ? orgUrl(pinnedOrg) : null;
    const href = siteUrl ? `${siteUrl}/pieces/${a.slug}` : `${MARKET}/artworks/${a.id}`;
    const v = a.variants?.[0];
    const price = v && typeof v.priceMinor === "number" && v.priceMinor > 0 && v.currency ? formatMoney(v.priceMinor, v.currency) : null;
    const size = a.heightCm && a.widthCm ? `${Number(a.heightCm)} × ${Number(a.widthCm)} cm` : null;
    const listed = a.status === "available" || a.status === "reserved" || a.status === "sold";
    const ownerId = scopeOrg ? `org:${scopeOrg.orgId}` : me.id;

    const timeline: TimelineEntry[] = [];
    if (listed) {
      timeline.push({
        id: `${key}:market`,
        at: isoOf(a.createdAt)!,
        outlet: "market",
        identityId: ownerId,
        label: a.status === "sold" ? "Sold" : price ? `Listed for sale · ${price}` : "Listed, price on request",
        sub: host(MARKET) ?? "Market",
        state: "published",
        href: `${MARKET}/artworks/${a.id}`,
        deliveryId: null,
      });
      if (pinnedOrg && siteUrl)
        timeline.push({ id: `${key}:site`, at: isoOf(a.createdAt)!, outlet: "site", identityId: `org:${pinnedOrg}`, label: `On ${homeOf(pinnedOrg)?.orgName ?? "the site"}`, sub: `${host(siteUrl)}/pieces/${a.slug}`, state: "published", href, deliveryId: null });
    } else {
      timeline.push({ id: `${key}:draft`, at: isoOf(a.updatedAt)!, outlet: "market", identityId: ownerId, label: "Draft listing", sub: "Market · not listed", state: "draft", href: null, deliveryId: null });
    }
    for (const p of [...(postsByLink.get(href) ?? []), ...(postsByLink.get(`${MARKET}/artworks/${a.id}`) ?? [])])
      timeline.push(...shareEntries(p.shares, p.org_id === PERSONAL_ORG ? me.id : `org:${p.org_id}`, `post:${p.id}`));
    timeline.push(...deliveryEntries(key));

    pieces.push(
      finishPiece({
        key,
        subject: { kind: "artwork", id: a.id },
        kind,
        title: a.title,
        meta: [a.medium, size, price, a.status === "sold" ? "sold" : null].filter(Boolean).join(" · ") || kindLabel(kind),
        excerpt: (a.descriptionHtml ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280),
        imageUrl: a.primaryImageUrl ?? null,
        status: a.status,
        ownerIdentityId: ownerId,
        presentedById: pinnedOrg && !scopeOrg ? `org:${pinnedOrg}` : null,
        siteIdentityId: pinnedOrg ? `org:${pinnedOrg}` : ownerId,
        siteName: pinnedOrg ? homeOf(pinnedOrg)?.orgName ?? "Site" : "Market",
        siteHost: pinnedOrg ? host(siteUrl) : host(MARKET),
        href,
        studioHref: `${MARKET}/studio`,
        createdAt: a.createdAt,
        eventAt: null,
        timeline,
      })
    );
  }

  function finishPiece(p: Omit<Piece, "row" | "coverage" | "suggestions" | "inMotion" | "plan" | "openTodos">): Piece {
    p.timeline.sort((a, b) => a.at.localeCompare(b.at));
    const latest = (filter: (e: TimelineEntry) => boolean): TimelineEntry | null => {
      const hits = p.timeline.filter(filter);
      const pub = hits.filter((e) => e.state === "published");
      return (pub.length ? pub : hits)[(pub.length ? pub : hits).length - 1] ?? null;
    };
    const cell = (e: TimelineEntry | null): Cell => ({ state: e?.state ?? "empty", at: e?.at ?? null, label: e?.label ?? null, href: e?.href ?? null, suggestion: null });
    const colMatch: Record<MatrixColumn, (e: TimelineEntry) => boolean> = {
      site: (e) => e.outlet === "site" || e.outlet === "page" || (p.subject.kind === "artwork" && e.outlet === "market"),
      instagram: (e) => e.outlet === "instagram",
      facebook: (e) => e.outlet === "facebook" || e.outlet === "threads",
      video: (e) => e.outlet === "video" || e.outlet === "youtube",
      writing: (e) => e.outlet === "writing",
      live: (e) => e.outlet === "live",
      newsletter: (e) => e.outlet === "newsletter",
    };
    const row = Object.fromEntries(MATRIX_COLUMNS.map((c) => [c, cell(latest(colMatch[c]))])) as Record<MatrixColumn, Cell>;
    const covMatch: Record<CoverageColumn, (e: TimelineEntry) => boolean> = {
      site: (e) => e.outlet === "site" || e.outlet === "page",
      instagram: (e) => e.outlet === "instagram",
      facebook: (e) => e.outlet === "facebook" || e.outlet === "threads",
      market: (e) => e.outlet === "market",
      newsletter: (e) => e.outlet === "newsletter",
    };
    const coverage: Piece["coverage"] = {};
    for (const idn of identities) {
      coverage[idn.id] = Object.fromEntries(
        COVERAGE_COLUMNS.map((c) => [c, cell(latest((e) => e.identityId === idn.id && covMatch[c](e)))])
      ) as Record<CoverageColumn, Cell>;
    }
    const plan = planBy.get(p.key);
    return {
      ...p,
      row,
      coverage,
      suggestions: [],
      inMotion: null,
      plan: plan
        ? { id: plan.id, bodyMd: plan.bodyMd, createdAt: plan.createdAt, updatedAt: plan.updatedAt, updatedByActor: plan.updatedByActor, updatedByViewer: plan.updatedBy === user.id }
        : null,
      openTodos: todosBy.get(p.key) ?? 0,
    };
  }

  // ── routines, slots and suggestions ───────────────────────────────────────
  const horizonEnd = addDays(today, 35);
  const slots = routineSlots(routines, today, horizonEnd, TIME_ZONE).filter((s) => new Date(s.at) > now);
  // A slot is filled by a delivery placed in it (its routine id), or by an
  // unattached delivery on the same outlet and day.
  const filledSlot = (s: { routineId: string; outlet: string; date: string }) =>
    deliveries.some(
      (d) =>
        d.status !== "dismissed" &&
        (d.routineId ? d.routineId === s.routineId : d.outlet === s.outlet) &&
        d.scheduledAt &&
        zonedDate(new Date(d.scheduledAt), TIME_ZONE) === s.date
    );
  const openSlots = slots.filter((s) => !filledSlot(s));
  const claimed = new Set<string>();
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const dismissed = new Set(deliveries.filter((d) => d.status === "dismissed").map((d) => `${d.subject.kind}:${d.subject.id}|${d.outlet}|${d.identityId ?? ""}`));

  const routineIdentity = (r: ChannelRoutine | undefined) => (r ? (r.owner.kind === "user" ? me.id : `org:${r.owner.id}`) : null);
  const placeIn = (outlet: Outlet, eventAt: string | null, identityId: string): { at: string | null; routineId: string | null; reason: string | null } => {
    const slot = openSlots.find(
      (s) =>
        s.outlet === outlet &&
        routineIdentity(routineById.get(s.routineId)) === identityId &&
        !claimed.has(`${s.routineId}|${s.date}`) &&
        (!eventAt || s.at < eventAt)
    );
    if (slot) {
      claimed.add(`${slot.routineId}|${slot.date}`);
      const r = routineById.get(slot.routineId);
      const wd = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TIME_ZONE }).format(new Date(slot.at));
      return { at: slot.at, routineId: slot.routineId, reason: `Fills your ${wd} ${r?.name ?? outletName(outlet)} slot` };
    }
    if (eventAt) {
      const before = new Date(new Date(eventAt).getTime() - 3 * DAY_MS);
      if (before > now) return { at: before.toISOString(), routineId: null, reason: `Three days before ${fmtDay(eventAt, TIME_ZONE)}` };
    }
    return { at: null, routineId: null, reason: null };
  };

  const recentCut = now.getTime() - 60 * DAY_MS;
  const sorted = [...pieces].sort((a, b) => (a.eventAt ?? "9").localeCompare(b.eventAt ?? "9"));
  for (const p of sorted) {
    const published = p.timeline.some((e) => e.state === "published" && (e.outlet === "site" || e.outlet === "page" || e.outlet === "market"));
    if (!published) continue;
    const add = (outlet: Outlet, identityId: string, chip: string, text: string, fallbackReason: string) => {
      const id = `${p.key}|${outlet}|${identityId}`;
      if (dismissed.has(id)) return;
      // "Never suggest this" (migration 255): an outlet, a kind of piece, or both.
      if (rules.some((r) => (r.outlet === null || r.outlet === outlet) && (r.pieceKind === null || r.pieceKind === p.kind))) return;
      const place = placeIn(outlet, p.eventAt, identityId);
      const s: Suggestion = { id, pieceKey: p.key, outlet, identityId, chip, text, reason: place.reason ?? fallbackReason, at: place.at, routineId: place.routineId };
      p.suggestions.push(s);
      const col = (outlet === "threads" ? "facebook" : outlet) as MatrixColumn;
      if (MATRIX_COLUMNS.includes(col) && p.row[col].state === "empty" && !p.row[col].suggestion) p.row[col].suggestion = s;
      const cov = p.coverage[identityId]?.[outlet as CoverageColumn];
      if (cov && cov.state === "empty" && !cov.suggestion) cov.suggestion = s;
    };
    const recent = p.timeline.some((e) => new Date(e.at).getTime() > recentCut) || Boolean(p.eventAt);
    for (const o of ["instagram", "facebook"] as const) {
      if (!connected(o)) continue;
      const ids = outlets.find((x) => x.id === o)!.identityIds;
      for (const idn of ids) {
        const has = p.timeline.some((e) => e.identityId === idn && (e.outlet === o || (o === "facebook" && e.outlet === "threads")) && e.state !== "failed");
        if (has) continue;
        if (!recent && idn !== ids[0]) continue;
        const who = identities.find((i) => i.id === idn);
        const label = o === "instagram" ? (p.kind === "series" || p.kind === "writing" ? "+ Quote card" : "+ Share") : "+ Share";
        add(o, idn, label, `${o === "instagram" ? "Post" : "Share"} ${p.title} to ${o === "instagram" ? "Instagram" : "Facebook"}${who && who.kind === "org" ? ` as ${who.shortName}` : ""}`, `Not on ${o === "instagram" ? "Instagram" : "Facebook"} yet`);
      }
    }
    if (recent && (p.kind === "artwork" || p.kind === "product") && p.row.video.state === "empty") add("video", p.ownerIdentityId, "+ Film it", `Film a short walk-through of ${p.title}`, "A follow-up for Instagram and the site");
    if (recent && p.kind !== "writing" && p.row.writing.state === "empty") add("writing", p.ownerIdentityId, "+ Write it", `Write about ${p.title}`, "A longer piece for your page");
    if (routines.some((r) => r.outlet === "newsletter") && p.row.newsletter.state === "empty") add("newsletter", p.ownerIdentityId, "+ Add", `Include ${p.title} in the next letter`, "Your letter routine");
  }

  // ── in motion ─────────────────────────────────────────────────────────────
  const fourteen = now.getTime() - IN_MOTION_DAYS * DAY_MS;
  for (const p of pieces) {
    const ahead = p.timeline.filter((e) => (e.state === "scheduled" || e.state === "live") && new Date(e.at) > now).sort((a, b) => a.at.localeCompare(b.at))[0];
    if (ahead) {
      p.inMotion = { reason: ahead.state === "live" ? `Goes live ${fmtWeekdayTime(ahead.at, TIME_ZONE)}` : `${outletName(ahead.outlet)} scheduled for ${fmtDay(ahead.at, TIME_ZONE)}`, at: ahead.at };
      continue;
    }
    if (p.eventAt) {
      p.inMotion = { reason: `${p.kind === "series" ? "Starts" : "On"} ${fmtWeekdayTime(p.eventAt, TIME_ZONE)}`, at: p.eventAt };
      continue;
    }
    const recentPub = p.timeline.filter((e) => e.state === "published" && new Date(e.at).getTime() > fourteen).sort((a, b) => b.at.localeCompare(a.at))[0];
    if (recentPub) {
      p.inMotion = { reason: `${recentPub.label} ${fmtDay(recentPub.at, TIME_ZONE)}`, at: recentPub.at };
      continue;
    }
    const openSteps = p.plan ? parsePlan(p.plan.bodyMd).steps.filter((s) => !s.done).length : 0;
    if (p.openTodos > 0 || openSteps > 0) {
      const n = p.openTodos + openSteps;
      p.inMotion = { reason: `${n} open ${n === 1 ? "step" : "steps"} in its plan`, at: null };
    }
  }

  // ── routines strip ────────────────────────────────────────────────────────
  const month = params.span === "month";
  const anchor = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : today;
  const weekStart = month ? addDays(anchor, -new Date(`${anchor}T12:00:00Z`).getUTCDay()) : anchor;
  const weekEnd = addDays(weekStart, month ? 34 : 6);
  const weekSlots = routineSlots(routines, weekStart, weekEnd, TIME_ZONE);
  const routineViews: RoutineView[] = routines.map((r) => {
    const mine = weekSlots.filter((s) => s.routineId === r.id);
    const filled = mine.filter((s) => filledSlot(s));
    const open = mine.filter((s) => !filledSlot(s) && new Date(s.at) > now);
    const nextAny = slots.find((s) => s.routineId === r.id);
    let status: string;
    let tone: RoutineView["tone"] = "quiet";
    if (mine.length === 0) status = nextAny ? `Next ${fmtDay(nextAny.at, TIME_ZONE)} · not started` : "Nothing this week";
    else if (open.length) {
      status = `${filled.length} of ${mine.length} this week · ${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TIME_ZONE }).format(new Date(open[0]!.at))} open`;
      tone = "open";
    } else {
      status = `${filled.length} of ${mine.length} this week · booked`;
      tone = "booked";
    }
    return { id: r.id, name: r.name, outlet: r.outlet as Outlet, cadence: describeCadence(r.cadence), status, tone, source: r.source, rule: r.cadence };
  });

  // ── week ──────────────────────────────────────────────────────────────────
  const pieceByKey = new Map(pieces.map((p) => [p.key, p]));
  const days: DayView[] = [];
  for (let date = weekStart; date <= weekEnd; date = addDays(date, 1)) {
    const items: DayItem[] = [];
    const onDay = (at: string | null) => Boolean(at) && zonedDate(new Date(at!), TIME_ZONE) === date;
    for (const p of pieces) if (p.eventAt && onDay(p.eventAt)) items.push({ type: "event", id: `ev:${p.key}`, pieceKey: p.key, title: `${p.title} · ${fmtWeekdayTime(p.eventAt, TIME_ZONE).split(" ").slice(1).join(" ")}`, at: p.eventAt });
    for (const d of deliveries) {
      if (d.status === "dismissed" || !onDay(d.scheduledAt)) continue;
      const piece = pieceByKey.get(`${d.subject.kind}:${d.subject.id}`);
      const pl = d.payload as { title?: string; suggestion?: string; alsoFacebook?: boolean; important?: boolean };
      items.push({
        type: "post",
        important: Boolean(pl.important),
        id: `d:${d.id}`,
        pieceKey: piece?.key ?? null,
        pieceTitle: piece?.title ?? "",
        title: pl.title || pl.suggestion || `${outletName(d.outlet as Outlet)} post`,
        outlets: [d.outlet as Outlet, ...(pl.alsoFacebook ? (["facebook"] as Outlet[]) : [])],
        at: d.scheduledAt!,
        state: d.status === "scheduled" ? (d.outlet === "live" ? "live" : "scheduled") : d.status === "failed" ? "failed" : d.status === "published" ? "published" : "draft",
        stage: d.status === "scheduled" ? (d.outlet === "live" ? "Going live" : "Scheduled") : d.status === "failed" ? "Failed" : d.status === "published" ? "Published" : "Draft",
        routineName: d.routineId ? routineById.get(d.routineId)?.name ?? null : null,
        deliveryId: d.id,
        href: null,
      });
    }
    for (const p of pieces)
      for (const e of p.timeline)
        if (!e.deliveryId && e.state === "published" && onDay(e.at) && e.outlet !== "market")
          items.push({ type: "post", id: `h:${e.id}`, pieceKey: p.key, pieceTitle: p.title, title: e.label, outlets: [e.outlet], at: e.at, state: "published", stage: "Published", routineName: null, deliveryId: null, href: e.href });
    for (const s of weekSlots.filter((x) => x.date === date && !filledSlot(x))) {
      const r = routineById.get(s.routineId);
      const sug = pieces.flatMap((p) => p.suggestions).find((g) => g.routineId === s.routineId && g.at === s.at) ?? null;
      items.push({ type: "slot", id: `slot:${s.routineId}:${s.date}`, routineId: s.routineId, routineName: r?.name ?? "Routine", cadence: r ? describeCadence(r.cadence) : "", outlet: s.outlet as Outlet, at: s.at, suggestion: sug });
    }
    for (const p of pieces)
      for (const g of p.suggestions)
        if (!g.routineId && g.at && onDay(g.at)) items.push({ type: "suggestion", id: `sg:${g.id}`, text: g.text, suggestion: g });
    for (const t of todos) if (t.date === date) items.push({ type: "todo", id: t.id, text: t.text, done: t.done });
    const order = { event: 0, post: 1, slot: 2, suggestion: 3, todo: 4 } as const;
    items.sort((a, b) => order[a.type] - order[b.type] || ("at" in a && "at" in b ? String(a.at).localeCompare(String(b.at)) : 0));
    days.push({ date, label: dayLabel(date), isToday: date === today, isTomorrow: date === addDays(today, 1), items });
  }

  // ── tray: not placed yet ──────────────────────────────────────────────────
  const tray: TrayItem[] = [];
  for (const d of deliveries.filter((x) => x.status === "draft" && !x.scheduledAt)) {
    const piece = pieceByKey.get(`${d.subject.kind}:${d.subject.id}`);
    const pl = d.payload as { title?: string; suggestion?: string };
    tray.push({ type: "draft", important: Boolean((d.payload as { important?: boolean }).important), id: `td:${d.id}`, label: `Draft · ${outletName(d.outlet as Outlet)}`, title: pl.title || pl.suggestion || "Untitled draft", sub: piece?.title ?? "", pieceKey: piece?.key ?? null, deliveryId: d.id, outlet: d.outlet as Outlet, chip: "Place it" });
  }
  for (const p of pieces)
    for (const g of p.suggestions.filter((x) => !x.at && (x.outlet === "instagram" || x.outlet === "facebook")).slice(0, 1))
      tray.push({ type: "gap", id: `tg:${g.id}`, label: "Gap", title: `${p.title} is not on ${outletName(g.outlet)}`, sub: p.inMotion?.reason ?? p.meta, pieceKey: p.key, suggestion: g, chip: g.chip.replace(/^\+ /, "") });
  for (const t of todos.filter((x) => !x.date && !x.done))
    tray.push({ type: "note", id: `tn:${t.id}`, label: "Your note", title: t.text, sub: `Added ${fmtDay(t.createdAt, TIME_ZONE)}`, todoId: t.id, chip: "Start it in Studio" });

  // ── nav counts, links, live ───────────────────────────────────────────────
  const count = (k: PieceKind[]) => pieces.filter((p) => k.includes(p.kind)).length;
  const scheduledAhead = deliveries.filter((d) => d.status === "scheduled" && d.scheduledAt && new Date(d.scheduledAt) > now);
  const liveNext = scheduledAhead.filter((d) => d.outlet === "live").sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
  const isAdmin = await safe(
    "admin",
    db<Array<{ is_admin: boolean }>>`SELECT is_admin FROM users WHERE id = ${user.id}`.then((r) => Boolean(r[0]?.is_admin)),
    false
  );
  let people: number | null = null;
  if (scopeOrg) {
    const r = await safe("people", db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM user_organizations WHERE org_id = ${scopeOrg.orgId}`, [{ n: 0 }]);
    people = r[0]?.n ?? null;
  }
  const orgQ = scopeOrg ? `&org=${encodeURIComponent(scopeOrg.orgId)}` : "";
  const studio = (kind: string | null) => `/studio?${kind ? `kind=${kind}` : ""}${orgQ}`.replace("?&", "?").replace(/\?$/, "");
  const scopeSite = scopeOrg ? orgUrl(scopeOrg.orgId) : me.siteUrl;
  const links: ChannelLinks = {
    hub: scopeOrg ? `/hub?org=${encodeURIComponent(scopeOrg.slug)}` : "/hub",
    studio: studio(null) || "/studio",
    site: scopeSite,
    newsletter: scopeOrg ? `/email?org=${encodeURIComponent(scopeOrg.slug)}` : orgs[0] ? `/email?org=${encodeURIComponent(orgs[0].slug)}` : null,
    connections: "/center?surface=me:connections",
    people: scopeOrg ? `/hub/organization?org=${encodeURIComponent(scopeOrg.slug)}` : null,
    pages: scopeOrg ? `/hub/sites/${encodeURIComponent(scopeOrg.slug)}/design` : null,
    template: scopeOrg ? `/hub/organization?org=${encodeURIComponent(scopeOrg.slug)}` : null,
    store: scopeOrg ? null : `${MARKET}/studio`,
    identity: scopeOrg ? `/hub/organization?org=${encodeURIComponent(scopeOrg.slug)}` : "/center?surface=me",
    writing: studio(null) || "/studio",
    video: studio("video"),
    meeting: studio("meeting"),
    series: scopeOrg ? `${orgUrl(scopeOrg.orgId) ?? ""}/hub/series` : null,
    artwork: `${MARKET}/studio`,
    live: "/studio/broadcast",
  };

  return {
    ready,
    viewer: { userId: user.id, name: viewerName, initials: me.initials, slug: viewerSlug, isAdmin },
    scope: scopeOrg ? { kind: "org", orgId: scopeOrg.orgId, name: scopeOrg.name, slug: scopeOrg.slug } : { kind: "artist" },
    orgs,
    identities,
    links,
    counts: {
      writing: count(["writing"]),
      video: count(["video"]),
      artwork: count(["artwork", "product"]),
      series: count(["series", "workshop"]),
      meeting: count(["meeting", "event"]),
      queue: scheduledAhead.length,
      people,
    },
    outlets,
    nextLive: liveNext ? { at: liveNext.scheduledAt!, title: String((liveNext.payload as { title?: string }).title ?? "Live") } : null,
    pieces: pieces.sort((a, b) => (b.timeline[b.timeline.length - 1]?.at ?? b.createdAt).localeCompare(a.timeline[a.timeline.length - 1]?.at ?? a.createdAt)),
    routines: routineViews,
    week: { from: weekStart, to: weekEnd, label: `${fmtDay(`${weekStart}T12:00:00Z`, "UTC")} – ${fmtDay(`${weekEnd}T12:00:00Z`, "UTC").replace(/^[A-Za-z]+ /, (m) => (weekStart.slice(5, 7) === weekEnd.slice(5, 7) ? "" : m))}`, days, prev: addDays(weekStart, month ? -35 : -7), next: addDays(weekStart, month ? 35 : 7) },
    tray,
    timeZone: TIME_ZONE,
    today,
    now: now.toISOString(),
    notice: params.notice ? params.notice.slice(0, 200) : null,
  };
}

export function outletName(o: Outlet): string {
  switch (o) {
    case "site":
      return "Website";
    case "page":
      return "Your page";
    case "market":
      return "Market";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "threads":
      return "Threads";
    case "youtube":
      return "YouTube";
    case "video":
      return "Video";
    case "writing":
      return "Writing";
    case "live":
      return "Live";
    case "newsletter":
      return "Letter";
  }
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(d).replace(/(\d+) (\w+)/, "$2 $1");
}
