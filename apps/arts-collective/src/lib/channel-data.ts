import { db } from "@elkdonis/db";
import {
  listConnections,
  listOrgChannels,
  listOrgHomes,
  listPublishJobs,
  listSocialPosts,
  listUserMemberships,
  getProfile,
} from "@elkdonis/services";
import { listArtworksForPerson, listStoreArtworks } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Artwork } from "@elkdonis/commerce/types";
import type {
  ChannelAccount,
  ChannelArtwork,
  ChannelData,
  ChannelJob,
  ChannelLinks,
  ChannelOrg,
  ChannelPost,
  ChannelViewId,
} from "@elkdonis/studio/channel";
import { CHANNEL_VIEWS } from "@elkdonis/studio/channel";
import type { SessionUser } from "@/lib/session";

// ============================================================================
// Loader for /studio/channel: everything the Channel console shows for one
// acting org (or "Just me"), read once per request. Every read is
// best-effort: a missing table or a failed query empties its view instead of
// taking the page down. docs/open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md.
// ============================================================================

/** The personal org: "Just me" posts are stored under it (Studio page.tsx). */
export const PERSONAL_ORG_ID = "oad";
const CONSOLE = "/studio/channel";
const MARKET = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "https://market.arts-collective.com").replace(/\/$/, "");
const ARTDIRECT = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "https://directory.arts-collective.com").replace(/\/$/, "");
const SITE_STORE_KEY = "shop:store";

/**
 * Per-site paths for the Site group, for org sites whose routes differ from
 * the template's. Sites not listed get the network's org pages.
 */
const SITE_PATHS: Record<string, Partial<Record<"pages" | "siteStyle" | "people" | "store", string>>> = {
  "katie-the-potter": { pages: "/manage/site", siteStyle: "/", people: "/manage/people", store: "/manage/pieces" },
};

const MANAGER_ROLES = new Set(["owner", "guide"]);

async function safe<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.error(`[channel] ${label}:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/** Orgs the person may run a channel for: owner or guide. */
export async function listChannelOrgs(userId: string): Promise<ChannelOrg[]> {
  const memberships = await safe("memberships", listUserMemberships(userId), []);
  return memberships
    .filter((m) => MANAGER_ROLES.has(m.role) && m.orgId !== PERSONAL_ORG_ID)
    .map((m) => ({ orgId: m.orgId, name: m.orgName, slug: m.orgSlug }));
}

function asView(v: string | undefined): ChannelViewId {
  return CHANNEL_VIEWS.includes(v as ChannelViewId) ? (v as ChannelViewId) : "overview";
}

/** The stores whose pieces belong to this org's channel: org-owned stores, plus the store an org site pins. */
async function orgStoreIds(orgId: string): Promise<string[]> {
  const rows = await safe(
    "org stores",
    db<Array<{ id: string }>>`
      SELECT s.id FROM store s WHERE s.owner_org_id = ${orgId}
      UNION
      SELECT s.id FROM site_config c JOIN store s ON s.id::text = c.value->>'storeId'
      WHERE c.org_id = ${orgId} AND c.key = ${SITE_STORE_KEY}
    `,
    [] as Array<{ id: string }>
  );
  return rows.map((r) => r.id);
}

function priceLabel(a: Artwork): string | null {
  const v = a.variants?.[0];
  return v && typeof v.priceMinor === "number" && v.currency ? formatMoney(v.priceMinor, v.currency) : null;
}

function buildLinks(org: ChannelOrg | null, domain: string | null, profileSlug: string | null): ChannelLinks {
  const q = org ? `&org=${encodeURIComponent(org.orgId)}` : "";
  const studio = (kind: string | null) => `/studio?${kind ? `kind=${kind}` : ""}${q}`.replace("?&", "?");
  const site = domain ? `https://${domain}` : null;
  const paths = org ? SITE_PATHS[org.orgId] ?? {} : {};
  const onSite = (p: string | undefined, fallback: string | null) => (site && p ? `${site}${p}` : fallback);

  return {
    console: CONSOLE,
    writing: studio(null),
    video: studio("video"),
    post: studio("post"),
    meeting: studio("meeting"),
    recordings: studio("recording"),
    // Series planners live on the org sites that mount series-site (/hub/series).
    series: null,
    newsletter: org ? `/email?org=${encodeURIComponent(org.slug)}` : null,
    pages: org ? onSite(paths.pages, site ? `${site}/hub` : `/hub/sites/${encodeURIComponent(org.slug)}/design`) : null,
    siteStyle: org ? onSite(paths.siteStyle, null) : null,
    identity: org ? `/hub/organization?org=${encodeURIComponent(org.slug)}` : null,
    people: org ? onSite(paths.people, null) : null,
    center: "/hub/network",
    store: org ? onSite(paths.store, null) : `${MARKET}/studio`,
    directory: profileSlug ? `${ARTDIRECT}/${encodeURIComponent(profileSlug)}` : null,
    connections: "/center?surface=me:connections",
    site: site ?? (org ? `/hub/organization?org=${encodeURIComponent(org.slug)}` : null),
  };
}

export async function loadChannel(user: SessionUser, params: { org?: string; view?: string; filter?: string; notice?: string }): Promise<ChannelData> {
  const orgs = await listChannelOrgs(user.id);
  const org = orgs.find((o) => o.orgId === params.org) ?? null;
  const actingOrgId = org?.orgId ?? PERSONAL_ORG_ID;
  const view = asView(params.view);

  const [profile, homes, posts, connections, channels, jobs] = await Promise.all([
    safe("profile", getProfile(user.id), null),
    safe("org homes", listOrgHomes(), []),
    safe("posts", listSocialPosts(user.id, actingOrgId), []),
    safe("connections", listConnections(user.id), []),
    org ? safe("org channels", listOrgChannels(org.orgId), []) : Promise.resolve([]),
    safe("jobs", listPublishJobs(user.id, 200), []),
  ]);

  const domain = org ? homes.find((h) => h.orgId === org.orgId)?.primaryDomain ?? null : null;
  const links = buildLinks(org, domain, profile?.slug ?? null);

  // Artwork: the org's stores' pieces, or the person's own.
  let pieces: Artwork[] = [];
  let pinnedStore = false;
  if (org) {
    const storeIds = await orgStoreIds(org.orgId);
    pinnedStore = storeIds.length > 0 && !!SITE_PATHS[org.orgId];
    const lists = await Promise.all(storeIds.map((id) => safe(`store ${id}`, listStoreArtworks(id), [] as Artwork[])));
    pieces = lists.flat();
  } else {
    pieces = await safe("my artworks", listArtworksForPerson(user.id, { limit: 100 }), []);
  }
  pieces = pieces.filter((a) => a.status !== "archived");

  // A piece's page: the org's own site when it shows pieces at /pieces/<slug>, else the market.
  const pieceHref = (a: Artwork) => (domain && pinnedStore ? `https://${domain}/pieces/${a.slug}` : `${MARKET}/artworks/${a.id}`);

  const postsByLink = new Map<string, { n: number; last: string }>();
  for (const p of posts) {
    if (!p.link) continue;
    const prev = postsByLink.get(p.link);
    postsByLink.set(p.link, { n: (prev?.n ?? 0) + 1, last: prev && prev.last > p.updatedAt ? prev.last : p.updatedAt });
  }

  const artworks: ChannelArtwork[] = pieces.map((a) => {
    const href = pieceHref(a);
    const used = postsByLink.get(href);
    return {
      id: a.id,
      title: a.title,
      status: a.status,
      priceLabel: priceLabel(a),
      imageUrl: a.primaryImageUrl ?? null,
      imageAlt: a.primaryImageAlt ?? a.title,
      href,
      postCount: used?.n ?? 0,
      lastPostedAt: used?.last ?? null,
    };
  });

  const orgQ = org ? `&org=${encodeURIComponent(org.orgId)}` : "";
  const channelPosts: ChannelPost[] = posts.map((p) => ({
    id: p.id,
    title: p.title || p.body.split("\n")[0]?.slice(0, 80) || "Untitled post",
    excerpt: p.body.slice(0, 200),
    imageUrl: p.images[0]?.url ?? null,
    link: p.link,
    shares: p.shares.map((s) => ({ label: s.label, kind: s.kind, url: s.url, at: s.at })),
    updatedAt: p.updatedAt,
    editHref: `/studio?kind=post${orgQ}&id=${encodeURIComponent(p.id)}`,
  }));

  const channelSet = new Set(channels.map((c) => `${c.provider}:${c.externalId}`));
  const accounts: ChannelAccount[] = connections.map((c) => ({
    id: c.id,
    provider: c.provider,
    label: c.label,
    accountName: c.accountName,
    accountUrl: c.accountUrl,
    status: c.status,
    error: c.error,
    connectedAt: c.connectedAt,
    targets: c.targets.map((t) => ({
      id: t.id,
      name: t.name,
      instagramUsername: t.instagramUsername,
      canPublish: t.canPublish,
      isOrgChannel: channelSet.has(`meta:${t.id}`),
    })),
    isOrgChannel: !!c.accountId && channelSet.has(`${c.provider}:${c.accountId}`),
  }));

  const postById = new Map(channelPosts.map((p) => [p.id, p]));
  const channelJobs: ChannelJob[] = jobs
    .filter((j) => (j.orgId ?? PERSONAL_ORG_ID) === actingOrgId)
    .map((j) => {
      const post = j.sourceKind === "social_post" ? postById.get(j.sourceId) : undefined;
      return {
        id: j.id,
        provider: j.provider,
        targetLabel: j.targetLabel,
        status: j.status,
        externalUrl: j.externalUrl,
        error: j.error,
        createdAt: j.createdAt,
        sourceKind: j.sourceKind,
        sourceId: j.sourceId,
        sourceTitle: post?.title ?? null,
        sourceHref: post?.editHref ?? (j.sourceKind === "thread" ? `/studio?id=${encodeURIComponent(j.sourceId)}${orgQ}` : null),
      };
    });

  return {
    viewer: { userId: user.id, email: user.email, name: profile?.displayName ?? null },
    org,
    orgs,
    view,
    filter: params.filter && /^[a-z]{1,12}$/.test(params.filter) ? params.filter : null,
    links,
    artworks,
    posts: channelPosts,
    accounts,
    jobs: channelJobs,
    today: null,
    notice: params.notice ? params.notice.slice(0, 200) : null,
  };
}
