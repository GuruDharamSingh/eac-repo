import "server-only";
import { db } from "@elkdonis/db";
import { countConfirmedRsvps, getOrgFollowerCount, getOrgIdentity } from "@elkdonis/services";
import { getOrgBySlug } from "@/lib/org";
import { FALLBACK_LOOK, readOfferLook, type OfferSiteViewer } from "@/lib/offer-site";
import type { SurfaceOffer, SurfaceProfile } from "@elkdonis/cms-ui/offer-surface";
import type { OfferExtras, TemplateData, TemplateId, TemplatePiece } from "@elkdonis/cms-ui/offer-templates/types";
import { DEFAULT_TEMPLATE, FEATURED_KEY, TEMPLATE_KEY_PREFIX, cleanTemplate, isContentKey, parseFeatured } from "./keys";
import {
  artworkOffer,
  extrasOf,
  kindOf,
  pieceOf,
  readArtworks,
  readCoHosts,
  readFallbackFeatured,
  readFeaturedThread,
  readOfferThreads,
  readSeriesSessions,
  readWritingIndex,
  storedTemplateOf,
  toOffer,
  toWritingShelf,
  type ThreadRow,
} from "./read";

/**
 * Everything the real offer page needs, as TemplateData plus the template to draw it in.
 *
 * Reads only; public rows only (published, PUBLIC, no min_role, not hidden in the content library),
 * so nothing gated reaches a signed-out page. The viewer comes from the session (callers pass it).
 *
 * The featured piece is, in order: the content key in site_config `offer:featured` when it
 * resolves under the public test; else today's fallback (the pinned thread, else the newest public
 * one, never an off-feed kind). Its template is the one stored with it, else the kind's default.
 */

export type OfferPageData = TemplateData & { templateId: TemplateId };

async function readConfig(orgId: string, keys: string[]): Promise<Map<string, unknown>> {
  try {
    const rows = await db<Array<{ key: string; value: unknown }>>`
      SELECT key, value FROM site_config WHERE org_id = ${orgId} AND key = ANY(${keys})`;
    return new Map(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    console.error("[offer-load] site_config:", err);
    return new Map();
  }
}

/** Profiles of everyone the page names, from `users`. */
async function readPeople(ids: string[]): Promise<Record<string, SurfaceProfile>> {
  const list = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!list.length) return {};
  try {
    // Name and picture are what a published piece already shows beside its title. Headline and bio only for an
    // account with a public profile here (a users.slug), so a private account's text never reaches the page.
    const rows = await db<Array<{ id: string; name: string | null; headline: string | null; bio: string | null; avatar: string | null; slug: string | null }>>`
      SELECT id::text AS id, display_name AS name, headline, bio, avatar_url AS avatar, slug FROM users WHERE id = ANY(${list}::uuid[])`;
    return Object.fromEntries(
      rows.map((r) => [
        r.id,
        { id: r.id, name: r.name ?? "Host", role: r.slug ? r.headline : null, bio: r.slug ? r.bio : null, portrait: r.avatar, links: [] } satisfies SurfaceProfile,
      ])
    );
  } catch (err) {
    console.error("[offer-load] people:", err);
    return {};
  }
}

/**
 * `opts.featuredKey` overrides `offer:featured` for one request: the dev-only `?featured=` preview of a piece
 * the site has not chosen. The caller must pass it only when NODE_ENV is development; it still resolves under the public test.
 */
export async function loadOfferPage(
  slug: string,
  viewer: OfferSiteViewer | null,
  origin: string,
  opts: { featuredKey?: string | null } = {}
): Promise<OfferPageData | null> {
  const org = await getOrgBySlug(slug);
  if (!org) return null;

  const [identity, followerCount, lookRow, followRow, config, offerRows, writingIndex] = await Promise.all([
    getOrgIdentity(slug),
    getOrgFollowerCount(org.id),
    readOfferLook(org.id),
    viewer
      ? db<Array<{ role: string }>>`SELECT role FROM user_organizations WHERE user_id = ${viewer.userId} AND org_id = ${org.id} LIMIT 1`.catch(() => [])
      : Promise.resolve([] as Array<{ role: string }>),
    readConfig(org.id, [FEATURED_KEY]),
    readOfferThreads(org.id, 9),
    readWritingIndex(org.id, 12),
  ]);

  const ownerId = identity?.profileUserId ?? org.id;
  const owner: SurfaceProfile = {
    id: ownerId,
    name: identity?.orgName ?? org.name,
    role: identity?.headline ?? null,
    bio: identity?.bio ?? org.description ?? org.profile?.bio ?? null,
    portrait: identity?.avatarUrl ?? null,
    links: (identity?.socialLinks ?? []).map((l) => ({ label: l.label ?? l.url, href: l.url })),
    followers: followerCount,
    following: viewer ? followRow.length > 0 : null,
    siteHref: identity?.primaryDomain ? `https://${identity.primaryDomain}` : null,
    directoryHref: null,
  };

  // ── which piece is featured ────────────────────────────────────────────────
  const wantedKey = isContentKey(opts.featuredKey) ? opts.featuredKey : parseFeatured(config.get(FEATURED_KEY));
  let featuredThread: ThreadRow | null = null;
  let featuredArt: Awaited<ReturnType<typeof readArtworks>> | null = null;
  if (wantedKey?.startsWith("thread:")) featuredThread = await readFeaturedThread(org.id, wantedKey.slice(7));
  else if (wantedKey?.startsWith("artwork:")) {
    const a = await readArtworks(org.id, 1, wantedKey.slice(8));
    if (a.rows.length) featuredArt = a;
  }
  if (!featuredThread && !featuredArt) featuredThread = await readFallbackFeatured(org.id);
  const featuredKey = featuredArt ? `artwork:${featuredArt.rows[0]!.id}` : featuredThread ? `thread:${featuredThread.id}` : null;

  // ── the other offers: threads, then artworks ───────────────────────────────
  const otherThreads = offerRows.filter((r) => r.id !== featuredThread?.id).slice(0, 8);
  const art = await readArtworks(org.id, 5);
  const otherArt = art.rows.filter((a) => `artwork:${a.id}` !== featuredKey).slice(0, 4);

  const threadsToLoad = [...(featuredThread ? [featuredThread] : []), ...otherThreads];
  const counts = new Map<string, number>(
    await Promise.all(
      threadsToLoad.filter((r) => r.is_rsvp_enabled).map(async (r) => [r.id, await countConfirmedRsvps(r.id).catch(() => 0)] as const)
    )
  );
  const coHosts = await readCoHosts(
    threadsToLoad.filter((r) => kindOf(r.kind) !== "writing").map((r) => r.id),
    new Map(threadsToLoad.map((r) => [r.id, r.author_id] as const))
  );

  // ── the featured offer, its extras and its pieces ──────────────────────────
  let featured: SurfaceOffer | null = null;
  let extras: OfferExtras = {};
  let pieces: TemplatePiece[] = writingIndex;
  let storedTemplate: unknown;

  if (featuredArt) {
    const a = featuredArt.rows[0]!;
    featured = artworkOffer(a, featuredArt.images.get(a.id) ?? [], ownerId, true);
  } else if (featuredThread) {
    const r = featuredThread;
    let sessions: OfferExtras["sessions"];
    let nextIso: string | null = null;
    if (r.kind === "series") {
      const tz = typeof r.metadata?.timeZone === "string" ? r.metadata.timeZone : null;
      const s = await readSeriesSessions(r.id, tz);
      sessions = s.sessions;
      nextIso = s.nextIso;
    }
    featured = toOffer(r, r.id, { coming: counts.get(r.id) ?? null, coHostIds: coHosts.get(r.id) ?? [], nextSessionIso: nextIso });
    extras = extrasOf(r, featured, sessions);
    storedTemplate = storedTemplateOf(r);
    if (featured.kind === "writing") {
      const piece = await pieceOf(r, writingIndex);
      pieces = [piece, ...writingIndex.filter((p) => p.key !== piece.key)];
    }
  }

  if (featured && featuredKey && storedTemplate === undefined) {
    // An artwork, or a piece the org only lists: the template lives in site_config.
    const t = await readConfig(org.id, [`${TEMPLATE_KEY_PREFIX}${featuredKey}`]);
    const v = t.get(`${TEMPLATE_KEY_PREFIX}${featuredKey}`);
    storedTemplate = v && typeof v === "object" ? (v as Record<string, unknown>).template : undefined;
  }
  const templateId = featured ? cleanTemplate(storedTemplate, featured.kind) ?? DEFAULT_TEMPLATE[featured.kind] : "event";

  const offers: SurfaceOffer[] = [
    ...otherThreads.map((r) =>
      toOffer(r, null, { coming: counts.get(r.id) ?? null, coHostIds: coHosts.get(r.id) ?? [] })
    ),
    ...otherArt.map((a) => artworkOffer(a, art.images.get(a.id) ?? [], ownerId, false)),
  ];

  const personIds = [
    ...(featured ? [featured.hostId, ...(featured.coHostIds ?? [])] : []),
    ...offers.flatMap((o) => [o.hostId, ...(o.coHostIds ?? [])]),
    // The featured piece's author (a person, not the org). The index pieces' authors are not needed.
    ...(featured?.kind === "writing" ? pieces.slice(0, 1).map((p) => p.authorId ?? "") : []),
  ].filter((id) => id && id !== ownerId);
  const people = await readPeople(personIds);
  people[ownerId] = owner;

  return {
    site: { orgId: org.id, slug, name: org.name, origin },
    owner,
    featured,
    offers,
    writing: pieces.slice(0, 6).map(toWritingShelf),
    people,
    viewer: viewer ? { signedIn: true, name: viewer.name ?? null, email: viewer.email ?? null } : { signedIn: false },
    look: lookRow?.look ?? FALLBACK_LOOK,
    extras,
    pieces,
    templateId,
  };
}
