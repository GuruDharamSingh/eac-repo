import Link from "next/link";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { RichText } from "@elkdonis/blocks";
import { FactsStrip, Porthole, PrimaryButton } from "@/components/mobile";
import { TourHeroView, TourRouteView, TourTopbarView } from "./views.client";
import type { MobileTourDetail } from "./types";

// ============================================================================
// The tour template (screen 03), G3a: six blocks drawn over one tour. The tour arrives as `tour` from the resolver
// (page.tsx passes it as metadata.mobileTour; the Studio gets a sample) and is never stored. The owner's words are
// the labels; the tour's own words (title, blurb, stop names, dates, price) are locked and edited in /manage.
// EMPTY: with no tour at all (no published tours in the Studio) every block draws nothing.
// ============================================================================

type T = { tour?: MobileTourDetail | null };

/* ---- m-tour-topbar: back and a heart that saves the tour on this device. EMPTY: nothing without a tour. ---- */
const topbarProps = [{ name: "savedLabel", kind: "string", label: "Heart, accessible name", default: "Save this tour", inlineEditable: false }] as const;
export const mTourTopbar = defineBlock(
  {
    id: "m-tour-topbar", category: "headers", label: "Phone tour top bar", description: "Back button and a heart that save the tour on this device; they float over the top corners of the hero.",
    memberSafe: true, dataDriven: true, interactive: true, styling: "tokens", props: topbarProps,
    parts: { root: { label: "Top bar", sel: "> .blk-mttop" } },
  },
  ({ tour, savedLabel }: PropsOf<typeof topbarProps> & T) =>
    tour ? <TourTopbarView slug={tour.slug} savedLabel={savedLabel} /> : null,
  () => ({ savedLabel: "Save this tour" })
);

/* ---- m-tour-hero: Film / 3D route / Photos. EMPTY: no hero when nothing is switched on. ---- */
const heroProps = [
  { name: "filmLabel", kind: "string", label: "Film pill and label", default: "Fly-over film", inlineEditable: true },
  { name: "mapLabel", kind: "string", label: "3D route pill", default: "Preview the route", inlineEditable: true },
  { name: "photosLabel", kind: "string", label: "Photos pill", default: "Photos", inlineEditable: true },
  { name: "routeNote", kind: "string", label: "3D route note", default: "A flight along the walk, stop by stop", inlineEditable: true },
] as const;
export const mTourHero = defineBlock(
  {
    id: "m-tour-hero", category: "headers", label: "Phone tour hero", description: "The film, the 3D route or the photos, whichever the guide leads with. The film is shown whole.",
    memberSafe: true, dataDriven: true, interactive: true, styling: "tokens", props: heroProps,
    parts: {
      root: { label: "Hero", sel: "> .blk-mth" },
      film: { label: "Film label", sel: ".blk-mth-label", prop: "filmLabel" },
      pills: { label: "Pills", sel: ".blk-mth-pills" },
    },
  },
  ({ tour, filmLabel, mapLabel, photosLabel, routeNote }: PropsOf<typeof heroProps> & T) =>
    tour ? <TourHeroView tour={tour.hero} filmLabel={filmLabel} mapLabel={mapLabel} photosLabel={photosLabel} routeNote={routeNote} /> : null,
  () => ({ filmLabel: "Fly-over film", mapLabel: "Preview the route", photosLabel: "Photos", routeNote: "A flight along the walk, stop by stop" })
);

/* ---- m-tour-head: title, guide row, facts strip. ---- */
const headProps = [{ name: "showGuide", kind: "boolean", label: "Show the guide row", default: true }] as const;
export const mTourHead = defineBlock(
  {
    id: "m-tour-head", category: "headers", label: "Phone tour head", description: "The tour title, who leads it, and four facts.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: headProps,
    parts: { root: { label: "Tour head", sel: "> .blk-mtt" }, title: { label: "Title", sel: ".blk-mtt-title" }, guide: { label: "Guide row", sel: ".blk-mtt-guide" } },
  },
  ({ tour, showGuide = true }: PropsOf<typeof headProps> & T) =>
    tour ? (
      <header className="blk blk-mtt">
        <h1 className="blk-mtt-title">{tour.title}</h1>
        {showGuide && tour.guide && (
          <div className="blk-mtt-guide">
            <Porthole size={40} src={tour.guide.photo} initial={tour.guide.name.slice(0, 1)} />
            <div>
              <div className="blk-mtt-guide-name">{tour.guide.name}</div>
              <div className="blk-mtt-guide-sub">{[tour.guide.craft, tour.guide.languages && `leads in ${tour.guide.languages}`].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        )}
        <FactsStrip items={tour.facts} />
      </header>
    ) : null,
  () => ({ showGuide: true })
);

/* ---- m-tour-blurb: the tour's text with a drop cap. EMPTY: nothing without a body. ---- */
export const mTourBlurb = defineBlock(
  {
    id: "m-tour-blurb", category: "content", label: "Phone tour blurb", description: "The tour's own text, with a drop cap.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: [] as const,
    parts: { root: { label: "Blurb", sel: "> .blk-mtb" } },
  },
  ({ tour }: T) => (tour?.bodyHtml ? <div className="blk blk-mtb m-dropcap"><RichText body={tour.bodyHtml} /></div> : null),
  () => ({})
);

/* ---- m-tour-meet: where to meet, placed just above the route. EMPTY: nothing without a meeting point. ---- */
const meetProps = [{ name: "meetLabel", kind: "string", label: "Meeting point label", default: "Meet at", inlineEditable: true }] as const;
export const mTourMeet = defineBlock(
  {
    id: "m-tour-meet", category: "content", label: "Phone tour meeting point", description: "Where the tour starts, shown just above the route.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: meetProps,
    parts: { root: { label: "Meeting point", sel: "> .blk-mtm" }, label: { label: "Label", sel: ".blk-mtm-label", prop: "meetLabel" } },
  },
  ({ tour, meetLabel }: PropsOf<typeof meetProps> & T) =>
    tour?.meetAt ? (
      <p className="blk blk-mtm">
        <span className="m-kicker blk-mtm-label">{meetLabel}</span> {tour.meetAt}
      </p>
    ) : null,
  () => ({ meetLabel: "Meet at" })
);

/* ---- m-tour-route: the stops. EMPTY: nothing without stops. ---- */
const routeProps = [
  { name: "heading", kind: "string", label: "Section label", default: "The route", inlineEditable: true },
  { name: "placeLabel", kind: "string", label: "Place button", default: "About this place", inlineEditable: true },
  { name: "experiencePrefix", kind: "string", label: "Experience pill, first words", default: "Experience at this stop", inlineEditable: true },
] as const;
export const mTourRoute = defineBlock(
  {
    id: "m-tour-route", category: "content", label: "Phone tour route", description: "The stops on a brass thread; tap one to open it in place.",
    memberSafe: true, dataDriven: true, interactive: true, styling: "tokens", props: routeProps,
    parts: {
      root: { label: "Route", sel: "> .blk-mtr" },
      heading: { label: "Section label", sel: ".blk-mtr-heading", prop: "heading" },
    },
  },
  ({ tour, heading, placeLabel, experiencePrefix }: PropsOf<typeof routeProps> & T) =>
    tour && tour.stops.length > 0 ? (
      <section className="blk blk-mtr">
        <div className="m-section">
          <span className="m-kicker m-section-label blk-mtr-heading">{heading}</span>
          <span className="m-rule" aria-hidden="true" />
        </div>
        <TourRouteView stops={tour.stops} mapsKey={tour.mapsKey ?? null} placeLabel={placeLabel} experiencePrefix={experiencePrefix} />
      </section>
    ) : null,
  () => ({ heading: "The route", placeLabel: "About this place", experiencePrefix: "Experience at this stop" })
);

/* ---- m-tour-dates: up to three next dates. EMPTY: "Dates coming" line (no upcoming slots yet). ---- */
const datesProps = [
  { name: "datesLabel", kind: "string", label: "Dates label", default: "Next dates", inlineEditable: true },
  { name: "emptyText", kind: "string", label: "When there are no dates", default: "Dates are coming soon.", inlineEditable: true },
] as const;
export const mTourDates = defineBlock(
  {
    id: "m-tour-dates", category: "content", label: "Phone tour dates", description: "The next three dates, each leading to the date picker.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: datesProps,
    parts: {
      root: { label: "Dates", sel: "> .blk-mtd" },
      dates: { label: "Dates label", sel: ".blk-mtd-dates-label", prop: "datesLabel" },
      empty: { label: "Empty line", sel: ".blk-mtd-empty", prop: "emptyText" },
    },
  },
  ({ tour, datesLabel, emptyText }: PropsOf<typeof datesProps> & T) =>
    tour ? (
      <section className="blk blk-mtd">
        <span className="m-kicker blk-mtd-dates-label">{datesLabel}</span>
        <div className="blk-mtd-chips">
          {tour.slots.length === 0 ? (
            <span className="blk-mtd-empty">{emptyText}</span>
          ) : (
            tour.slots.map((s) => (
              <Link key={s.slotId} href={`/tours/${tour.slug}/dates?slot=${s.slotId}`} className="blk-mtd-chip">
                <span className="blk-mtd-chip-day">{s.day}</span>
                <span className="blk-mtd-chip-left">{s.left}</span>
              </Link>
            ))
          )}
        </div>
      </section>
    ) : null,
  () => ({ datesLabel: "Next dates", emptyText: "Dates are coming soon." })
);

/* ---- m-tour-bookbar: sticky price and "Choose a date". EMPTY: no price shown for an unpriced tour; the button reads "Ask by email". ---- */
const barProps = [
  { name: "perLabel", kind: "string", label: "After the price", default: "per person", inlineEditable: true },
  { name: "ctaLabel", kind: "string", label: "Button", default: "Choose a date →", inlineEditable: true },
] as const;
export const mTourBookbar = defineBlock(
  {
    id: "m-tour-bookbar", category: "actions", label: "Phone book bar", description: "Price and the Choose a date button, stuck to the bottom of the tour page.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: barProps,
    parts: {
      root: { label: "Book bar", sel: "> .blk-mtbar" },
      per: { label: "After the price", sel: ".blk-mtbar-per", prop: "perLabel" },
      cta: { label: "Button", sel: ".blk-mtbar .m-btn" },
    },
  },
  ({ tour, perLabel, ctaLabel }: PropsOf<typeof barProps> & T) =>
    tour ? (
      <div className="blk blk-mtbar">
        {tour.priced && (
          <div className="blk-mtbar-price">
            <span className="blk-mtbar-amount">{tour.priceLabel}</span>
            <span className="blk-mtbar-per">{perLabel}</span>
          </div>
        )}
        <PrimaryButton href={tour.priced ? `/tours/${tour.slug}/dates` : "/about"}>{tour.priced ? ctaLabel : "Ask us about it"}</PrimaryButton>
      </div>
    ) : null,
  () => ({ perLabel: "per person", ctaLabel: "Choose a date →" })
);
