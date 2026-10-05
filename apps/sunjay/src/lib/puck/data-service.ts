import { getProfile, getServiceOffering, listServiceOfferings, servicePriceLabel } from "@elkdonis/services";
import type { ServiceOffering } from "@elkdonis/services";
import { BOOKING_UNAVAILABLE, bookingAvailability } from "@elkdonis/checkout/booking";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { WireBooking, WireService } from "@/blocks/service-sample";

// ============================================================================
// The services behind the service blocks.
//
// `pt-service` and `pt-booking` pick one service: the block's own choice, else
// the visitor's (`?service=<slug>` on the page, passed as metadata.service),
// else the newest. `bookingAvailability` (checkout) decides whether the card
// form may be shown; it reads configuration and the author's payout identity
// and does not touch Stripe.
// ============================================================================

const ORG = siteConfig.orgId;

export function toWireService(o: ServiceOffering): WireService {
  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    subtitle: o.subtitle,
    summary: o.descriptionShort,
    bodyHtml: o.body ?? "",
    bookingType: o.bookingType,
    format: o.format,
    priceLabel: servicePriceLabel(o),
    price: o.price,
    currency: o.currency,
    priceSlidingMin: o.priceSlidingMin,
    slidingScaleNote: o.slidingScaleNote,
    registrationStatus: o.registrationStatus,
    sessionCount: o.sessionCount,
    sessionDurationHrs: o.sessionDurationHrs,
    recurrenceLabel: o.recurrenceLabel,
    location: o.location,
    coverImageUrl: o.coverImageUrl ?? o.heroMediaUrl,
  };
}

async function pick(props: Record<string, unknown>, ctx: Record<string, unknown>): Promise<ServiceOffering | null> {
  const wanted =
    (typeof props.service === "string" && props.service) || (typeof ctx.service === "string" && ctx.service) || "";
  if (wanted) {
    const hit = await getServiceOffering(ORG, wanted);
    if (hit) return hit;
  }
  return (await listServiceOfferings(ORG))[0] ?? null;
}

export async function loadServices(props: Record<string, unknown>): Promise<{ services: WireService[] }> {
  const limit = typeof props.limit === "number" ? Math.min(Math.max(Math.trunc(props.limit), 1), 24) : 12;
  const all = await listServiceOfferings(ORG);
  return { services: all.slice(0, limit).map(toWireService) };
}

export async function loadService(
  props: Record<string, unknown>,
  ctx: Record<string, unknown>
): Promise<{ chosen: WireService | null }> {
  // `chosen`, not `service`: `service` is the block's own field (the slug the
  // author picked), and a resolver key of the same name would overwrite it.
  const o = await pick(props, ctx);
  return { chosen: o ? toWireService(o) : null };
}

export async function loadBooking(
  props: Record<string, unknown>,
  ctx: Record<string, unknown>
): Promise<{ booking: WireBooking }> {
  const o = await pick(props, ctx);
  const viewer = await getViewer().catch(() => null);
  if (!o) return { booking: { service: null, unavailable: null, inquiry: false, defaultName: null, defaultEmail: null } };

  const profile = viewer ? await getProfile(viewer.userId).catch(() => null) : null;
  let unavailable: string | null = null;
  let inquiry = false;

  if (o.price == null) {
    inquiry = true;
    unavailable = "This one has no set price. Send an enquiry.";
  } else if (o.bookingType === "one_on_one") {
    // One-to-one services are scheduled after payment through service_bookings
    // (migration 174, not applied on 2026-10-03), so card booking is limited
    // to group and self-paced services. The enquiry form is the way in.
    inquiry = true;
    unavailable = "One-to-one sessions are arranged first. Send an enquiry and we will find a time.";
  } else if (o.registrationStatus !== "open") {
    unavailable =
      o.registrationStatus === "waitlist"
        ? "Registration is on a waitlist."
        : o.registrationStatus === "full"
          ? "This one is full."
          : "Registration is closed.";
  } else {
    const ok = await bookingAvailability(o.authorId);
    if (ok.ok === false) {
      unavailable = BOOKING_UNAVAILABLE[ok.reason];
      inquiry = true;
    }
  }

  return {
    booking: {
      service: toWireService(o),
      unavailable,
      inquiry,
      defaultName: profile?.displayName ?? null,
      defaultEmail: viewer?.email ?? null,
    },
  };
}
