import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import {
  canViewFeed,
  getOrgFeed,
  getPersonPage,
  getServiceOffering,
  listServiceOfferings,
  personThreadHref,
  type PersonThread,
} from "@elkdonis/services";
import { BOOKING_UNAVAILABLE, bookingAvailability } from "@elkdonis/checkout/booking";
import { sanitizeRichText } from "@elkdonis/utils";
import { bookingAfterPayment } from "@/lib/booking-after";
import { getForumSnapshot } from "@/lib/forum";
import { getGuides, getThreadBySlug, getThreadsForFeed } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { ServiceBookingState, ServiceView } from "@/blocks/service";
import type { ForumTopic, PersonPageView, PersonView } from "@/blocks/records";
import type { PostView } from "@/blocks/post";

// ============================================================================
// The records behind the round 3 blocks (server only). The published page
// calls these from lib/puck/config.server.ts; the editor reaches the same
// through /api/blocks/he-records (visitor-visible data only: published
// services, the forum as an anonymous visitor sees it, public profiles).
// Round 6 adds the article (he-post) and the whole person page (he-person,
// layout "page"): the same reads the two routes made before they became
// templates, with the same viewer rules.
// ============================================================================

const BOOKING: Record<string, string> = { one_on_one: "One-on-one", group: "Group", async: "Self-paced" };
const FORMAT: Record<string, string> = { in_person: "In person", online: "Online", hybrid: "Hybrid" };
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

async function serviceView(slug: string | null): Promise<(ServiceView & { id: string; authorId: string | null }) | null> {
  const svc = slug && SLUG.test(slug)
    ? await getServiceOffering(siteConfig.orgId, slug)
    : (await listServiceOfferings(siteConfig.orgId))[0] ?? null;
  if (!svc) return null;
  const facts = [
    { label: "Kind", value: svc.bookingType ? BOOKING[svc.bookingType] ?? svc.bookingType : null },
    { label: "Format", value: svc.format ? FORMAT[svc.format] ?? null : null },
    { label: "Schedule", value: svc.recurrenceLabel },
    { label: "Sessions", value: svc.sessionCount ? `${svc.sessionCount}${svc.sessionDurationHrs ? ` × ${svc.sessionDurationHrs}h` : ""}` : null },
    { label: "Where", value: svc.location },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));
  return {
    id: svc.id,
    authorId: svc.authorId,
    slug: svc.slug,
    title: svc.title,
    subtitle: svc.subtitle,
    bodyHtml: svc.body ? sanitizeRichText(svc.body) : null,
    bookingType: svc.bookingType,
    facts,
    price: svc.price,
    priceSlidingMin: svc.priceSlidingMin,
    slidingScaleNote: svc.slidingScaleNote,
    currency: svc.currency,
    registrationStatus: svc.registrationStatus,
    bannerUrl: svc.bannerImageUrl ?? svc.coverImageUrl,
  };
}

type Query = { booked?: unknown; order?: unknown; card?: unknown; payment?: unknown };

/** he-service: the service in the address (or chosen, or the first), and where its booking stands. */
export async function loadServiceBlock(props: { routeSlug?: unknown; routeQuery?: unknown; serviceSlug?: unknown }): Promise<{ service: ServiceView | null; booking: ServiceBookingState | null }> {
  try {
    const slug = (typeof props.routeSlug === "string" && props.routeSlug) || (typeof props.serviceSlug === "string" && props.serviceSlug) || null;
    const view = await serviceView(slug);
    if (!view) return { service: null, booking: null };
    const { id, authorId, ...service } = view;
    const q = (props.routeQuery && typeof props.routeQuery === "object" ? props.routeQuery : {}) as Query;
    const booked = q.booked === "1";
    const after = booked ? await bookingAfterPayment(typeof q.order === "string" ? q.order : null, id) : null;
    const availability = !booked && service.registrationStatus === "open" ? await bookingAvailability(authorId) : { ok: true as const };
    return {
      service,
      booking: {
        booked,
        orderId: after && after.state !== "none" ? after.orderId : null,
        after: after?.state ?? null,
        unavailable: availability.ok === false ? BOOKING_UNAVAILABLE[availability.reason] : null,
        card: typeof q.card === "string" ? q.card.slice(0, 20) : null,
        cancelled: q.payment === "cancelled",
      },
    };
  } catch (err) {
    console.error("[hidden-enneagram] loadServiceBlock:", err);
    return { service: null, booking: null };
  }
}

/** he-forum: the newest topics, as the visitor may see them. */
export async function loadForumTopics(limit: unknown): Promise<ForumTopic[]> {
  const n = Math.min(10, Math.max(0, Math.trunc(Number(limit) || 4)));
  if (!n) return [];
  try {
    const snap = await getForumSnapshot();
    const recent = ((snap as { recent?: unknown[] } | null)?.recent ?? []) as Array<Record<string, unknown>>;
    return recent.slice(0, n).map((t, i) => ({
      id: String(t.id ?? i),
      title: String(t.title ?? ""),
      href: String(t.href ?? "/forum"),
      meta: typeof t.feedName === "string" ? t.feedName : typeof t.boardName === "string" ? t.boardName : null,
    })).filter((t) => t.title);
  } catch (err) {
    console.error("[hidden-enneagram] loadForumTopics:", err);
    return [];
  }
}

/** he-person: a public profile on this site; the portrait is the profile's photo, else the person's avatar. */
export async function loadPerson(slug: unknown): Promise<PersonView | null> {
  try {
    const guides = await getGuides();
    // The profile's address (users.slug, e.g. "aeon"), or its name ("Ario"); empty = the first guide.
    const want = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    const g = (want ? guides.find((x) => x.slug.toLowerCase() === want || x.displayName.toLowerCase() === want) : guides[0]) ?? null;
    if (!g) return null;
    let photo = g.photoUrl;
    if (!photo) {
      const [u] = (await db`SELECT avatar_url FROM users WHERE id = ${g.userId} LIMIT 1`) as unknown as Array<{ avatar_url: string | null }>;
      photo = u?.avatar_url ?? null;
    }
    return {
      name: g.displayName,
      role: g.roleTitle,
      city: g.city,
      bio: g.bio,
      photoUrl: photo,
      href: `/about/${g.slug}`,
      links: (g.socialLinks ?? []).filter((l) => l.url).map((l) => ({ label: l.label || l.url.replace(/^https?:\/\//, ""), url: l.url })),
    };
  } catch (err) {
    console.error("[hidden-enneagram] loadPerson:", err);
    return null;
  }
}

// ── Round 6: the article and the person page ────────────────────────────────

const FEED = /^[a-z0-9][a-z0-9-]{0,63}$/;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * he-post: the post in the address (`routeFeed`/`routeSlug`, injected by
 * app/[page]/[slug]/page.tsx), else the chosen one, else the feed's newest.
 * The same reads and rules as the route: the feed must exist and be open to
 * this viewer's role (canViewFeed), and the read is member-aware
 * (getThreadBySlug's visibility filter), so an ORGANIZATION post stays
 * unreachable to a signed-out visitor. `visitor` = the editor's sample (as a
 * signed-out visitor sees it, whoever asks).
 */
export async function loadPostBlock(
  props: { routeFeed?: unknown; routeSlug?: unknown; postFeed?: unknown; postSlug?: unknown },
  { visitor = false }: { visitor?: boolean } = {},
): Promise<{ post: PostView | null }> {
  try {
    const routed = typeof props.routeFeed === "string" && typeof props.routeSlug === "string";
    const feedSlug = routed ? (props.routeFeed as string) : str(props.postFeed) || "writing";
    if (!routed && !FEED.test(feedSlug)) return { post: null };
    const [feed, viewer] = await Promise.all([getOrgFeed(siteConfig.orgId, feedSlug), visitor ? null : getViewer()]);
    if (!feed || !canViewFeed(feed, viewer?.role ?? null)) return { post: null };
    const isMember = Boolean(viewer?.isAffiliate);
    const slug = routed ? (props.routeSlug as string) : str(props.postSlug).slice(0, 200);
    const thread = slug
      ? await getThreadBySlug(feedSlug, slug, { isMember })
      : ((await getThreadsForFeed(feedSlug, { isMember, limit: 1 }))[0] ?? null);
    if (!thread) return { post: null };
    return {
      post: {
        id: thread.id,
        kind: thread.kind,
        feedSlug: feed.slug,
        feedName: feed.name,
        title: thread.title,
        excerpt: thread.excerpt,
        bodyHtml: thread.description,
        authorName: thread.authorName,
        authorSlug: thread.authorSlug,
        publishedAt: new Date(thread.publishedAt ?? thread.createdAt).toISOString(),
        coverImageUrl: thread.coverImageUrl,
        membersOnly: thread.visibility === "ORGANIZATION",
      },
    };
  } catch (err) {
    console.error("[hidden-enneagram] loadPostBlock:", err);
    return { post: null };
  }
}

const NETWORK_URL =
  process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
  `https://${process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com"}`;

function plain(html: string | null, max = 160): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function formatDay(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "America/Toronto",
  });
}

/** Posts homed here open on this site's `/<feed>/<slug>` route. */
function threadHref(t: PersonThread): string {
  return personThreadHref(t, {
    networkUrl: NETWORK_URL,
    localOrgId: siteConfig.orgId,
    localHref: (x) => (x.section ? `/${x.section}/${x.slug}` : null),
  });
}

/**
 * he-person, layout "page": the person page `/about/<slug>` drew before round
 * 6 (getPersonPage, docs/open/PERSON_PAGES_BRIEF_2026-09-26.md), as data. The
 * viewer decides what getPersonPage shows (drafts and empty sections for the
 * person themselves); `visitor` = the editor's sample, as a signed-out visitor
 * sees it. An empty slug = the site's first guide.
 */
export async function loadPersonPage(slug: unknown, { visitor = false }: { visitor?: boolean } = {}): Promise<PersonPageView | null> {
  try {
    const want = str(slug).slice(0, 200) || ((await getGuides())[0]?.slug ?? "");
    if (!want) return null;
    let viewerId: string | null = null;
    if (!visitor) {
      const session = await getServerSession();
      viewerId = session.user?.db_user_id ?? session.user?.id ?? null;
    }
    const page = await getPersonPage(want, { orgId: siteConfig.orgId, viewerId });
    if (!page) return null;
    const { profile, orgProfile } = page;
    const bio = profile.bio;
    const bioIsHtml = Boolean(bio && bio.includes("<"));
    return {
      name: profile.displayName,
      role: orgProfile?.roleTitle ?? profile.headline ?? null,
      city: profile.city ?? null,
      verified: Boolean(profile.verified),
      bio: bioIsHtml ? null : (bio ?? null),
      // Sanitised here: PersonPage renders bioHtml as given.
      bioHtml: bioIsHtml ? sanitizeRichText(bio) : null,
      avatarUrl: profile.avatarUrl ?? null,
      socialLinks: (profile.socialLinks ?? []).map((l) => ({ label: l.label ?? null, url: l.url })),
      portfolio: page.portfolio.map((p) => ({ url: p.url, title: p.title ?? null })),
      order: page.sections.map((s) => s.key),
      posts: page.show.posts
        ? page.posts.map((t) => {
            const foreign = t.orgId !== siteConfig.orgId;
            return {
              href: threadHref(t),
              title: t.title,
              meta: [t.publishedAt ? formatDay(t.publishedAt) : null, foreign ? `on ${t.orgName}` : null].filter(Boolean).join(" · ") || null,
              excerpt: t.excerpt ? (plain(t.excerpt, 200) ?? null) : null,
              external: foreign,
              draft: t.status !== "published",
            };
          })
        : null,
      events: page.show.events
        ? page.events.map((t) => {
            const foreign = t.orgId !== siteConfig.orgId;
            return {
              href: threadHref(t),
              title: t.title,
              meta: [t.scheduledAt ? formatDay(t.scheduledAt, true) : null, t.location, foreign ? `on ${t.orgName}` : null].filter(Boolean).join(" · ") || null,
              external: foreign,
              draft: t.status !== "published",
            };
          })
        : null,
      canEdit: page.canEdit,
    };
  } catch (err) {
    console.error("[hidden-enneagram] loadPersonPage:", err);
    return null;
  }
}
