import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { BookingOptionsView } from "./views.client";
import { samplePage } from "./sample";

// ============================================================================
// booking-options (TEMPLATE lane, 2026-11-21): the ways to book the record in the address, drawn as the phone tour page's
// Dates section draws them (rows of dates with places left, tap one to choose it), with the price and the existing booking
// form switched on by settings. It never books by itself: the form is the page's own BookingForm, untouched, and a sample
// (the editor) draws it inert. No "tour" in a setting: a workshop's sessions read the same way.
// ============================================================================

const props = [
  { name: "showDates", kind: "boolean", label: "Show the dates", default: true },
  { name: "showPlacesLeft", kind: "boolean", label: "Show places left", default: true },
  { name: "showPrice", kind: "boolean", label: "Show the price", default: false },
  { name: "showBook", kind: "boolean", label: "Show the Book action", default: false },
  {
    name: "layout",
    kind: "select",
    label: "Booking form",
    description: "Compact: the form opens when Book is pressed. Full: the form is always open.",
    default: "compact",
    options: [
      { value: "compact", label: "Compact" },
      { value: "full", label: "Full" },
    ],
  },
] as const;

export const bookingOptions = defineBlock(
  {
    id: "booking-options",
    category: "actions",
    label: "Booking options",
    description: "The dates to choose from, with places left, the price and the Book action, for the record on this page.",
    memberSafe: true,
    dataDriven: true,
    interactive: true,
    styling: "tokens",
    props,
    reads: [
      { from: "route", what: "record", kinds: ["tour"] },
      { from: "viewer", what: "signed-in" },
      { from: "flow", what: "booking" },
    ],
    parts: { root: { label: "Booking options", sel: "> .tb-root" } },
  },
  ({ page, showDates, showPlacesLeft, showPrice, showBook, layout }: PropsOf<typeof props> & { page?: unknown }) => (
    <BookingOptionsView
      page={page as never}
      showDates={showDates}
      showPlacesLeft={showPlacesLeft}
      showPrice={showPrice}
      showBook={showBook}
      layout={layout === "full" ? "full" : "compact"}
    />
  ),
  () => ({ showDates: true, showPlacesLeft: true, showPrice: false, showBook: false, layout: "compact", page: samplePage() }) as never
);
