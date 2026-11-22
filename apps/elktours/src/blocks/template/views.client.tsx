"use client";

// The two template blocks' drawing halves (client). They draw the phone tour page's own sections, exported from
// phone/index/tour-phone-index.tsx (Dates, Route, WhenNear), and the existing BookingForm untouched; they add the
// settings around them. TEMPLATE lane, 2026-11-21.

import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";
import { useTourPage, type TourPageData } from "@/blocks/tour/context";
import { BookingForm } from "@/components/tours/booking-form";
import { Dates, Route, WhenNear } from "@/components/tours/stage/phone/index/tour-phone-index";
import { useTourPhone } from "@/components/tours/stage/phone/tour-stage-phone";
import { buildModel, type IndexModel } from "@/components/tours/stage/phone/index/data";
import { formatPrice } from "@/lib/tour-format";
import { officeHref } from "@/lib/office-links";
import { SAMPLE_TOUR_ID } from "./sample";
import "./template-blocks.css";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), { ssr: false });

type Page = TourPageData | null | undefined;

/** The record: the resolver's, else the tour page's provider. A page whose stage failed to load still has dates and stops. */
function useRecord(given: Page): TourPageData | null {
  const ctx = useTourPage();
  const page = given ?? ctx;
  return useMemo(() => {
    if (!page) return null;
    if (page.stage) return page;
    const stops: never[] = [];
    return { ...page, stage: { stops, byStop: {}, tourLede: null, overviewPhotos: [], tourTakes: [], nextDeparture: null, price: page.tour.price, currency: page.tour.currency } } as TourPageData;
  }, [page]);
}

const isSample = (p: TourPageData) => p.tour.id === SAMPLE_TOUR_ID;

// ── Booking options ────────────────────────────────────────────────────────

export interface BookingOptionsViewProps {
  page?: Page;
  showDates?: boolean;
  showPrice?: boolean;
  showPlacesLeft?: boolean;
  showBook?: boolean;
  layout?: "compact" | "full";
}

export function BookingOptionsView({ page: given, showDates = true, showPrice = false, showPlacesLeft = true, showBook = false, layout = "compact" }: BookingOptionsViewProps) {
  const page = useRecord(given);
  const phone = useTourPhone();
  const [now] = useState(() => Date.now());
  const [mine, setMine] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const chosenId = mine ?? phone.chosenDepartureId;
  const model = useMemo(() => (page ? buildModel(page, chosenId, now) : null), [page, chosenId, now]);
  if (!page || !model) return null;

  const t = page.tour;
  const priced = !!(t.price && t.price > 0);
  const label = formatPrice(t.price, t.currency);
  const deps = showPlacesLeft ? model.deps : model.deps.map((d) => ({ ...d, left: d.full ? "Full" : "" }));
  const shown: IndexModel = { ...model, deps };
  const choose = (id: string) => {
    setMine(id);
    phone.chooseDeparture(id);
  };
  const changeHref = page.fieldEditId ? officeHref("schedule", { tourId: page.fieldEditId }) : null;
  const formOpen = layout === "full" || open;
  const sample = isSample(page);

  return (
    <div className="tpi-root tb-root" data-block="booking-options">
      <section className="tpi-sec" data-kind="event">
        {showPrice && priced && (
          <p className="tb-price">
            {label} <span>per person</span>
          </p>
        )}
        {showDates && <Dates model={shown} chosenId={model.selected?.id ?? null} onChoose={choose} changeHref={changeHref} />}
        {showBook && (
          <div className="tb-book">
            {layout === "compact" && (
              <button type="button" className="tpi-stop__act" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? "Close" : "Book"}
              </button>
            )}
            {formOpen && (
              <div className="tb-book__form" data-no-swipe="" {...(sample ? { inert: true } : {})}>
                <Suspense>
                  <BookingForm
                    key={chosenId ?? "none"}
                    tourSlug={t.slug}
                    departures={t.departures}
                    priceLabel={label}
                    pricePerPerson={t.price}
                    currency={t.currency}
                    maxParty={page.maxParty}
                    unavailable={page.unavailable}
                    signedInEmail={page.signedInEmail}
                    tourTitle={t.title}
                    contactEmail={page.contactEmail}
                    initialDepartureId={chosenId}
                  />
                </Suspense>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Locations ──────────────────────────────────────────────────────────────

export interface LocationsViewProps {
  page?: Page;
  showMap?: boolean;
  showList?: boolean;
  order?: "route" | "alphabetical";
  detail?: "name" | "summary" | "full";
  showCover?: boolean;
}

export function LocationsView({ page: given, showMap = true, showList = true, order = "route", detail = "full", showCover = false }: LocationsViewProps) {
  const page = useRecord(given);
  const phone = useTourPhone();
  const [now] = useState(() => Date.now());
  const model = useMemo(() => (page ? buildModel(page, null, now) : null), [page, now]);
  if (!page || !model || model.stops.length === 0) return null;

  const sorted = order === "alphabetical" ? [...model.stops].sort((a, b) => a.title.localeCompare(b.title)) : model.stops;
  const points = model.mapStops.length + (model.meetingPoint ? 1 : 0);
  const activeId = phone.activeStop?.id ?? null;

  // The page's own section, as it draws today: used whenever nothing it cannot do is asked for.
  if (showList && detail === "full" && !showCover) {
    const m: IndexModel = { ...model, stops: sorted, ...(showMap ? {} : { mapStops: [], meetingPoint: null }) };
    return (
      <div className="tpi-root tb-root" data-block="locations">
        <section className="tpi-sec">
          <Route model={m} activeId={activeId} onPick={(id) => phone.selectFace(id)} />
        </section>
      </div>
    );
  }

  return (
    <div className="tpi-root tb-root" data-block="locations">
      <section className="tpi-sec">
        {showMap && points >= 2 && (
          <WhenNear className="tpi-map" caption={`Map · ${model.stops.length} ${model.stops.length === 1 ? "place" : "places"}`}>
            <TourMap stops={model.mapStops} meetingPoint={model.meetingPoint} activeIndex={-1} interactive={false} padding={18} fitMeeting={false} />
          </WhenNear>
        )}
        {showList && (
          <ol className="tb-list">
            {sorted.map((s) => {
              const kind = s.place?.title && s.place.title !== s.title ? s.place.title : null;
              return (
                <li key={s.id} className="tb-loc">
                  {showCover && s.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="tb-loc__pic" src={s.cover} alt="" loading="lazy" />
                  )}
                  <span className="tpi-stop__n">{s.numeral}</span>
                  <span className="tb-loc__text">
                    <span className="tb-loc__t">{s.title}</span>
                    {detail !== "name" && kind && <span className="tb-loc__k">{kind}</span>}
                    {detail === "full" && s.place?.address && <span className="tb-loc__a">{s.place.address}</span>}
                  </span>
                  {detail !== "name" && s.durationMinutes ? <span className="tb-loc__min">{s.durationMinutes} min</span> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
