import { db } from "@elkdonis/db";
import { getServiceOffering, listServiceOfferings } from "@elkdonis/services";
import { BOOKING_UNAVAILABLE, bookingAvailability } from "@elkdonis/checkout/booking";
import { sanitizeRichText } from "@elkdonis/utils";
import { bookingAfterPayment } from "@/lib/booking-after";
import { getForumSnapshot } from "@/lib/forum";
import { getGuides } from "@/lib/data";
import { siteConfig } from "@/config/site";
import type { ServiceBookingState, ServiceView } from "@/blocks/service";
import type { ForumTopic, PersonView } from "@/blocks/records";

// ============================================================================
// The records behind the round 3 blocks (server only). The published page
// calls these from lib/puck/config.server.ts; the editor reaches the same
// through /api/blocks/he-records (visitor-visible data only: published
// services, the forum as an anonymous visitor sees it, public profiles).
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
