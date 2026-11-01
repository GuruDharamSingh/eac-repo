import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { bookingAvailability, BOOKING_UNAVAILABLE } from "@elkdonis/checkout/booking";
import { MAX_PARTY_SIZE } from "@elkdonis/commerce/server";
import { BookingForm } from "@/components/tours/booking-form";
import { TourStory } from "@/components/tours/tour-story";
import { RoutePreviewLauncher } from "@/components/tours/route-preview-launcher";
import { getViewer } from "@/lib/auth";
import { formatDeparture, formatDuration, formatPrice, getTourBySlug, loadTourFull } from "@/lib/tours";
import { siteConfig } from "@/config/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Editors previewing a draft get its title; everyone else sees the site default (the page 404s for them anyway).
  const viewer = await getViewer().catch(() => null);
  const tour = await getTourBySlug(slug, { includeDrafts: Boolean(viewer?.canEdit) });
  if (!tour) return {};
  return {
    title: tour.title,
    description: tour.excerpt ?? undefined,
    openGraph: {
      title: tour.title,
      description: tour.excerpt ?? undefined,
      images: tour.coverImageUrl ? [tour.coverImageUrl] : undefined,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getViewer().catch(() => null);
  // Editors may preview a draft; everyone else sees published tours only.
  const base = await getTourBySlug(slug, { includeDrafts: Boolean(viewer?.canEdit) });
  if (!base) notFound();
  const tour = await loadTourFull(base, { upcomingOnly: true });

  let unavailable: string | null = null;
  if (!(tour.price && tour.price > 0)) {
    unavailable = "This tour is not priced yet; ask about it by email.";
  } else {
    const availability = await bookingAvailability(tour.authorId);
    if (availability.ok === false) unavailable = BOOKING_UNAVAILABLE[availability.reason];
  }

  const length = formatDuration(tour.durationMinutes);
  const facts = [
    length ? { k: "Length", v: length } : null,
    tour.details.languages.length ? { k: "Language", v: tour.details.languages.join(", ") } : null,
    tour.details.effort ? { k: "Walking", v: tour.details.effort } : null,
    tour.details.maxParty ? { k: "Group", v: `up to ${tour.details.maxParty}` } : null,
    tour.location ? { k: "Meet at", v: tour.location } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  const meetingPoint = tour.details.meetingPoint ? { ...tour.details.meetingPoint, label: tour.location } : null;

  return (
    <article>
      {/* Hero: the route preview, full width; the cover image when a tour has no placed stops yet. */}
      <header className="relative">
        {tour.stops.some((s) => s.lat != null) ? (
          <div className="mx-auto max-w-6xl px-0 sm:px-5 sm:pt-6">
            <RoutePreviewLauncher
              hero
              title={tour.title}
              stops={tour.stops.map(({ guideNotes: _g, ...s }) => ({ ...s, guideNotes: null }))}
              meetingPoint={meetingPoint}
              route={tour.details.route}
              googleMapsKey={siteConfig.googleMapsKey}
              coverImageUrl={tour.coverImageUrl ?? tour.stops.find((s) => s.stillUrl)?.stillUrl ?? null}
            />
          </div>
        ) : tour.coverImageUrl ? (
          <div className="aspect-[21/9] max-h-[70vh] w-full overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tour.coverImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-5 pt-10">
          <Link href="/tours" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← All tours</Link>
          {tour.status !== "published" && (
            <span className="ml-3 rounded bg-secondary px-2 py-0.5 text-xs">Draft — only editors can see this</span>
          )}
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{tour.title}</h1>
          {tour.excerpt && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{tour.excerpt}</p>}
          {facts.length > 0 && (
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {facts.map((f) => (
                <div key={f.k}>
                  <dt className="inline font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{f.k} </dt>
                  <dd className="inline">{f.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <div className="min-w-0">
          {tour.body && (
            <div className="eac-article max-w-2xl" data-layout="note">
              <div className="eac-article__body" dangerouslySetInnerHTML={{ __html: tour.body }} />
            </div>
          )}

          {(tour.details.highlights.length > 0 || tour.details.includes.length > 0) && (
            <div className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
              {tour.details.highlights.length > 0 && (
                <section>
                  <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Highlights</h2>
                  <ul className="mt-2 space-y-1 text-sm">{tour.details.highlights.map((h) => <li key={h}>— {h}</li>)}</ul>
                </section>
              )}
              {tour.details.includes.length > 0 && (
                <section>
                  <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Included</h2>
                  <ul className="mt-2 space-y-1 text-sm">{tour.details.includes.map((h) => <li key={h}>— {h}</li>)}</ul>
                </section>
              )}
            </div>
          )}

          {(tour.stops.length > 0 || meetingPoint) && (
            <section className="mt-14">
              <h2 className="font-serif text-2xl">The route</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tour.stops.length} stop{tour.stops.length === 1 ? "" : "s"}. Scroll through them; the map follows.
              </p>
              <div className="mt-6">
                <TourStory stops={tour.stops.map(({ guideNotes: _g, ...s }) => ({ ...s, guideNotes: null }))} meetingPoint={meetingPoint} googleMapsKey={siteConfig.googleMapsKey} />
              </div>
            </section>
          )}
        </div>

        {/* Booking */}
        <aside id="book" className="mt-12 lg:mt-0">
          <div className="sticky top-24 border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Book</p>
            <p className="mt-1 font-serif text-2xl">{formatPrice(tour.price, tour.currency)} <span className="text-base text-muted-foreground">per person</span></p>
            <div className="mt-5">
              <Suspense>
                <BookingForm
                  tourSlug={tour.slug}
                  departures={tour.departures}
                  priceLabel={formatPrice(tour.price, tour.currency)}
                  pricePerPerson={tour.price}
                  currency={tour.currency}
                  maxParty={Math.min(MAX_PARTY_SIZE, tour.details.maxParty ?? MAX_PARTY_SIZE)}
                  unavailable={unavailable}
                  signedInEmail={viewer?.email ?? null}
                />
              </Suspense>
            </div>
            {tour.authorName && (
              <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                Led by <span className="text-foreground">{tour.authorName}</span>
              </p>
            )}
            {viewer?.canEdit && (
              <Link href={`/manage/tours/${tour.id}`} className="mt-3 inline-block text-xs underline underline-offset-4">
                Edit this tour
              </Link>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
