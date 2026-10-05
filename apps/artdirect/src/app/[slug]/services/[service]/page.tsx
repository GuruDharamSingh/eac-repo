import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ARTIST_SPACE_ORG_ID,
  getProfileBySlug,
  getServiceOffering,
  servicePriceLabel,
  type Profile,
  type ServiceOffering,
} from "@elkdonis/services";
import { BOOKING_UNAVAILABLE, bookingAvailability } from "@elkdonis/checkout/booking";
import { ServiceBookingForm } from "@elkdonis/checkout/components";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import { isOadSteward } from "@/lib/oad";
import { bookServiceAction } from "@/lib/booking-actions";
import "@elkdonis/checkout/booking.css";

// ============================================================================
// /<slug>/services/<service> — one of a person's own services, and the form
// to book it and pay by card (2026-09-27).
//
// The service is a `threads` row of kind `service` homed in `oad`, saved
// through the shared service layer (booking type, sliding scale,
// registration). It must be authored by the person in the address: another
// person's service under this slug is a 404. Unlisted people 404 for
// visitors, as on their root page.
// ============================================================================

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; service: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const MARKETPLACE_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";

const BOOKING_WORD: Record<string, string> = {
  one_on_one: "One to one",
  group: "Group",
  async: "Self-paced",
};
const FORMAT_WORD: Record<string, string> = { online: "Online", in_person: "In person", hybrid: "Online or in person" };

function hiddenFrom(identity: Profile, viewerId: string | null | undefined, steward: boolean): boolean {
  if (identity.directoryListed) return false;
  if (viewerId && viewerId === identity.userId) return false;
  return !steward;
}

async function load(slug: string, serviceSlug: string) {
  const [identity, service] = await Promise.all([
    getProfileBySlug(slug),
    getServiceOffering(ARTIST_SPACE_ORG_ID, serviceSlug),
  ]);
  if (!identity || !service || service.authorId !== identity.userId) return null;
  return { identity, service };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, service } = await params;
  const found = await load(slug, service);
  if (!found || !found.identity.directoryListed) return {};
  return {
    title: `${found.service.title} — ${found.identity.displayName} — ArtDirect`,
    description: found.service.descriptionShort ?? undefined,
  };
}

function facts(s: ServiceOffering): string[] {
  const hours = s.sessionDurationHrs;
  return [
    s.bookingType ? BOOKING_WORD[s.bookingType] : null,
    s.format ? FORMAT_WORD[s.format] : null,
    hours ? (hours < 1 ? `${Math.round(hours * 60)} min` : `${hours} ${hours === 1 ? "hour" : "hours"}`) : null,
    s.sessionCount && s.sessionCount > 1 ? `${s.sessionCount} sessions` : null,
    s.recurrenceLabel,
    s.format !== "online" ? s.location : null,
    servicePriceLabel(s),
  ].filter((x): x is string => Boolean(x));
}

export default async function ServicePage({ params, searchParams }: Props) {
  const [{ slug, service: serviceSlug }, query, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const found = await load(slug, serviceSlug);
  if (!found) notFound();
  const { identity, service } = found;
  const viewerId = user?.id ?? null;
  const steward = user ? await isOadSteward(user.id) : false;
  if (hiddenFrom(identity, viewerId, steward)) notFound();

  const home = identity.slug ?? slug;
  const isSelf = viewerId === identity.userId;
  const booked = query.booked === "1";
  const cancelled = query.payment === "cancelled";

  const open = service.registrationStatus === "open" && (service.price ?? 0) > 0;
  const availability = open ? await bookingAvailability(identity.userId) : null;
  const unavailable = availability && availability.ok === false ? BOOKING_UNAVAILABLE[availability.reason] : null;

  return (
    <>
      <ThemeStyle userId={identity.userId} precedence="user" />
      <div className="eac-person-page eac-person-page--frame oad-person" data-person-page="" data-person-doc="service">
        <nav className="eac-person-intro oad-person-bar" aria-label="Page">
          <a className="eac-person-back" href={`/${home}`}>
            ← {identity.displayName}
          </a>
        </nav>
        <div className="eac-person-slot">
          <article className="eac-person-section eac-person-panel">
            {service.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={service.coverImageUrl} alt="" style={{ width: "100%", height: "auto", borderRadius: "0.375rem" }} />
            ) : null}
            <p className="eac-person-meta">{["Service", ...facts(service)].join(" · ")}</p>
            <h1 className="eac-person-name">{service.title}</h1>
            {service.subtitle ? <p className="eac-person-excerpt">{service.subtitle}</p> : null}
            {/* Sanitised on write (upsertServiceOffering → sanitizePostBody). */}
            {service.body ? (
              <div className="eac-person-bio" dangerouslySetInnerHTML={{ __html: service.body }} />
            ) : service.descriptionShort ? (
              <p className="eac-person-bio">{service.descriptionShort}</p>
            ) : null}
          </article>
        </div>

        <div className="eac-person-slot">
          <section className="eac-person-section eac-person-panel" aria-labelledby="book-heading">
            <h2 id="book-heading" className="eac-person-heading">
              Book
            </h2>
            {booked ? (
              <p role="status">
                Thank you — your booking is paid.{" "}
                {(service.bookingType ?? "one_on_one") === "one_on_one"
                  ? `${identity.displayName} will confirm one of your times, or suggest others. The email we sent you has a link to follow it.`
                  : `${identity.displayName} will be in touch by email.`}
              </p>
            ) : !open ? (
              <p>
                {service.registrationStatus === "full"
                  ? "This is full at the moment."
                  : service.registrationStatus === "waitlist"
                    ? "There is a waiting list. Get in touch to be added."
                    : service.price
                      ? "Booking is closed at the moment."
                      : "This has no price set, so it is arranged directly. Get in touch."}
              </p>
            ) : (
              <>
                {cancelled ? <p role="status">Payment was cancelled; nothing was charged.</p> : null}
                <ServiceBookingForm
                  action={bookServiceAction.bind(null, home, service.slug)}
                  listPrice={service.price!}
                  slidingFloor={service.priceSlidingMin}
                  slidingNote={service.slidingScaleNote}
                  currency={service.currency}
                  defaultEmail={user?.email ?? null}
                  unavailable={unavailable}
                  schedule={(service.bookingType ?? "one_on_one") === "one_on_one"}
                />
                {isSelf && availability?.ok === false && availability.reason === "no_payouts" ? (
                  <p className="eac-booking-hint">
                    Only you see this: set up payouts in{" "}
                    <a href={`${MARKETPLACE_URL}/studio/payouts`}>Studio</a> so people can book and pay.
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
