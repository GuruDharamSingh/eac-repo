import type { BlockDef } from "@elkdonis/blocks";

// ============================================================================
// Parts of the record blocks on the generated pages: the event detail page
// (event-detail), the services page, and the writing pages (journal,
// journal-piece). Added 2026-11-14 (editing landscape, round 1), so these
// blocks open on their surface like Forum and Next gathering do: a page can
// restyle each piece, and the block's own words are typed in place.
//
// Data only, as shared-parts.ts: the block declarations import these.
// Selectors read today's markup; no data-part attribute was added, so what a
// visitor is sent is unchanged.
//
// `prop` marks only the block's OWN words (a heading, a line above it, a
// button label). Words that come from the record (a gathering's title, a
// service's price, a piece's body) are data and are never marked. Part names
// never equal prop names (discussion-block contract, rule 11): the heading
// part is `headline`, its prop `heading`.
//
// Selector grammar (PartDef in packages/blocks/src/types.ts): one complex
// selector, no comma; ">" starts at the block's root element, otherwise the
// selector is looked up inside the root.
// ============================================================================

type Parts = NonNullable<BlockDef["parts"]>;

// ── event detail ───────────────────────────────────────────────────────────

/** pt-event-header (event.client.tsx EventHeaderView): `<header>` > words column + cover. */
export const EVENT_HEADER_PARTS: Parts = {
  root: { label: "Event header", sel: "> header" },
  words: { label: "Words", sel: "> header > div" },
  crumb: { label: "“← section” link", sel: "> header > div > a", draws: { props: { showCrumb: true } } },
  kicker: { label: "Small label", sel: "> header > div > p:first-of-type" },
  title: { label: "Title", sel: "> header > div > h1" },
  cancelled: { label: "Cancelled note", sel: "> header > div > p.inline-block" },
  excerpt: { label: "Summary", sel: "> header > div > p.text-lg" },
  facts: { label: "Facts", sel: "> header > div > dl", draws: { props: { showFacts: true } } },
  fact: { label: "Fact", sel: "> header > div > dl > div", repeat: true },
  factName: { label: "Fact name", sel: "> header > div > dl > div > dt", repeat: true },
  factValue: { label: "Fact value", sel: "> header > div > dl > div > dd", repeat: true },
  cover: { label: "Cover picture", sel: "> header > img", draws: { props: { showCover: true } } },
};

/** pt-event-about (EventAboutView): `<section>` > heading, rule, description. */
export const EVENT_ABOUT_PARTS: Parts = {
  root: { label: "Event description", sel: "> section" },
  headline: { label: "Heading", sel: "> section > h2", prop: "heading", draws: { props: { heading: "A heading" } } },
  rule: { label: "Bronze line", sel: "> section > hr", draws: { props: { heading: "A heading" } } },
  body: { label: "Description", sel: "> section > div" },
};

/** pt-talk-room (TalkRoomView): `<section class="card-natural">` > heading, note, buttons, the room. */
export const TALK_ROOM_PARTS: Parts = {
  root: { label: "Talk room", sel: "> section" },
  headline: { label: "Heading", sel: "> section > h2", prop: "heading", draws: { props: { heading: "A heading" } } },
  noteLine: { label: "Words above the buttons", sel: "> section > p.max-w-2xl", prop: "note", draws: { props: { note: "A line about the room." } } },
  status: { label: "Room status", sel: "> section > p:not(.max-w-2xl)" },
  buttons: { label: "Button row", sel: "> section > div" },
  button: { label: "Button", sel: "> section > div > *", repeat: true },
  room: { label: "The room", sel: "> section > iframe" },
};

/** pt-event-rsvp (EventRsvpView): `<div>` > RSVP panel, then who is coming. */
export const EVENT_RSVP_PARTS: Parts = {
  root: { label: "RSVP", sel: "> div" },
  panel: { label: "Are you coming?", sel: "> div > :first-child" },
  attendees: { label: "Who is coming", sel: "> div > :nth-child(2)", draws: { props: { showAttendees: true } } },
};

/** pt-event-materials (EventMaterialsView): `<section>` > heading, rule, file list. */
export const EVENT_MATERIALS_PARTS: Parts = {
  root: { label: "Event materials", sel: "> section" },
  headline: { label: "Heading", sel: "> section > h2", prop: "heading", draws: { props: { heading: "A heading" } } },
  rule: { label: "Bronze line", sel: "> section > hr", draws: { props: { heading: "A heading" } } },
  list: { label: "Files", sel: "> section > ul" },
  file: { label: "File", sel: "> section > ul > li", repeat: true },
  link: { label: "File link", sel: "> section > ul > li > a", repeat: true },
};

/** pt-offering-card (offering-card.client.tsx): `<section class="pt-offer-section">` > header + the card. */
export const OFFERING_CARD_PARTS: Parts = {
  root: { label: "Offering card", sel: "> section" },
  header: { label: "Heading area", sel: ".pt-offer-header", draws: { props: { heading: "A heading" } } },
  eyebrowLine: { label: "Line above the heading", sel: ".pt-offer-eyebrow", prop: "eyebrow", draws: { props: { heading: "A heading", eyebrow: "A line" } } },
  headline: { label: "Heading", sel: ".pt-offer-heading", prop: "heading", draws: { props: { heading: "A heading" } } },
  card: { label: "Card", sel: ".pt-offer-card" },
  media: { label: "Picture area", sel: ".pt-offer-media" },
  picture: { label: "Picture", sel: ".pt-offer-media img" },
  body: { label: "Card words", sel: ".pt-offer-body" },
  kicker: { label: "Small label", sel: ".pt-offer-kicker" },
  title: { label: "Title", sel: ".pt-offer-title" },
  blurb: { label: "Summary", sel: ".pt-offer-blurb" },
  facts: { label: "Facts", sel: ".pt-offer-facts" },
  actions: { label: "Button row", sel: ".pt-offer-actions" },
  button: { label: "Button", sel: ".pt-offer-btn", repeat: true },
  details: { label: "“Details →” link", sel: ".pt-offer-link" },
  rsvp: { label: "RSVP column", sel: ".pt-offer-rsvp", draws: { props: { showRsvp: true } } },
  call: { label: "The call", sel: ".pt-offer-call" },
  empty: { label: "When nothing is scheduled", sel: ".pt-offer-empty" },
};

// ── services ───────────────────────────────────────────────────────────────

/** pt-services (service-blocks.tsx ServicesList): `<section>` > heading, intro, rule, then cards (grid) or rows (ul). */
export const SERVICES_PARTS: Parts = {
  root: { label: "Services list", sel: "> section" },
  headline: { label: "Heading", sel: "> section > h2", prop: "heading", draws: { props: { heading: "A heading" } } },
  introLine: { label: "Line under the heading", sel: "> section > p.mt-2", prop: "intro", draws: { props: { intro: "A line" } } },
  rule: { label: "Bronze line", sel: "> section > hr" },
  emptyLine: { label: "When there are none", sel: "> section > p:not(.mt-2)", prop: "emptyMessage" },
  cards: { label: "Cards", sel: "> section > div.grid", draws: { props: { layout: "cards" } } },
  card: { label: "Card", sel: "> section > div.grid > article", repeat: true },
  picture: { label: "Picture", sel: "> section > div.grid > article > img", repeat: true, draws: { props: { showImages: true } } },
  cardFacts: { label: "Kind and format", sel: "> section > div.grid > article p.uppercase", repeat: true },
  cardTitle: { label: "Service name", sel: "> section > div.grid > article h3", repeat: true },
  cardSubtitle: { label: "Subtitle", sel: "> section > div.grid > article p.italic", repeat: true },
  cardSummary: { label: "Summary", sel: "> section > div.grid > article p.leading-relaxed", repeat: true },
  cardPrice: { label: "Price", sel: "> section > div.grid > article span.font-serif", repeat: true },
  choose: { label: "Button", sel: "> section > div.grid > article a", repeat: true, prop: "chooseLabel" },
  rows: { label: "Rows", sel: "> section > ul", draws: { props: { layout: "rows" } } },
  row: { label: "Row", sel: "> section > ul > li", repeat: true },
  rowTitle: { label: "Row name", sel: "> section > ul > li h3", repeat: true },
  rowFacts: { label: "Row details", sel: "> section > ul > li p", repeat: true },
  rowPrice: { label: "Row price", sel: "> section > ul > li span", repeat: true },
  rowChoose: { label: "Row link", sel: "> section > ul > li a", repeat: true, prop: "chooseLabel", draws: { props: { layout: "rows" } } },
};

/** pt-service (ServiceDetail): `<article class="card-natural">` > picture, words. Every word is the service's: no `prop`. */
export const SERVICE_PARTS: Parts = {
  root: { label: "Service", sel: "> article" },
  picture: { label: "Picture", sel: "> article > img", draws: { props: { showImage: true } } },
  words: { label: "Words", sel: "> article > div" },
  kind: { label: "Kind and format", sel: "> article > div > p.uppercase" },
  title: { label: "Service name", sel: "> article > div > h2" },
  subtitle: { label: "Subtitle", sel: "> article > div > p.italic" },
  price: { label: "Price", sel: "> article > div > p.font-serif" },
  sliding: { label: "Sliding-scale note", sel: "> article > div > p.font-serif > span" },
  summary: { label: "Summary", sel: "> article > div > p.leading-relaxed" },
  body: { label: "Full description", sel: "> article > div > div", draws: { props: { showBody: true } } },
};

/** pt-booking (booking.client.tsx BookingView): `<section id="book">` > heading, the service line, the form. */
export const BOOKING_PARTS: Parts = {
  root: { label: "Book this service", sel: "> section" },
  headline: { label: "Heading", sel: "> section > h2", prop: "heading", draws: { props: { heading: "A heading" } } },
  chosen: { label: "Service and price", sel: "> section > p.mt-1" },
  unavailable: { label: "Why card booking is off", sel: "> section > p.mt-4" },
  form: { label: "Form", sel: "> section > div.mt-4" },
};

// ── writing ────────────────────────────────────────────────────────────────

/** pt-journal (cms-ui WritingShelf, drawn bare): `<section class="eac-shelf">`. The same classes as pt-writing's parts. */
export const JOURNAL_PARTS: Parts = {
  root: { label: "Writing cards", sel: "> section" },
  head: { label: "Heading area", sel: ".eac-shelf__head" },
  headline: { label: "Heading", sel: ".eac-shelf__heading", prop: "heading" },
  introLine: { label: "Line under the heading", sel: ".eac-shelf__intro", prop: "intro", draws: { props: { intro: "A line" } } },
  empty: { label: "When there is nothing", sel: ".eac-shelf__empty", prop: "emptyNote" },
  shelf: { label: "Pieces", sel: ".eac-shelf__body" },
  leadPiece: { label: "First piece", sel: ".eac-shelf__lead", draws: { props: { lead: true } } },
  leadPicture: { label: "First piece picture", sel: ".eac-shelf__lead-cover" },
  leadTitle: { label: "First piece title", sel: ".eac-shelf__lead-title" },
  list: { label: "The others", sel: ".eac-shelf__list" },
  row: { label: "Piece", sel: ".eac-shelf__row", repeat: true },
  rowPicture: { label: "Piece picture", sel: ".eac-shelf__row-cover", repeat: true },
  rowTitle: { label: "Piece title", sel: ".eac-shelf__row-title", repeat: true },
  lede: { label: "Summary", sel: ".eac-shelf__lede", repeat: true },
  date: { label: "Date", sel: ".eac-shelf__dateline", repeat: true },
};

/** pt-article (writing-blocks.tsx Article): `<div>` > "← Writing" link + cms-ui ArticleView. The piece's words are data. */
export const ARTICLE_PARTS: Parts = {
  root: { label: "Piece", sel: "> div" },
  back: { label: "“← Writing” link", sel: "> div > a", draws: { props: { showBack: true } } },
  article: { label: "Article", sel: ".eac-article" },
  eyebrow: { label: "Labels above", sel: ".eac-article__eyebrow" },
  label: { label: "Label", sel: ".eac-article__label", repeat: true },
  series: { label: "Series name", sel: ".eac-article__series" },
  title: { label: "Title", sel: ".eac-article__title" },
  lede: { label: "Opening line", sel: ".eac-article__lede" },
  byline: { label: "Byline", sel: ".eac-article__byline" },
  cover: { label: "Cover", sel: ".eac-article__cover", draws: { props: { showCover: true } } },
  body: { label: "Body", sel: ".eac-article__body" },
  colophon: { label: "Colophon", sel: ".eac-article__colophon" },
};

/** pt-series-nav (SeriesNav): `<nav class="card-natural">` > heading line, series name, list. */
export const SERIES_NAV_PARTS: Parts = {
  root: { label: "Series list", sel: "> nav" },
  headline: { label: "Heading", sel: "> nav > p", prop: "heading" },
  seriesName: { label: "Series name", sel: "> nav > h2" },
  list: { label: "Pieces", sel: "> nav > ol" },
  item: { label: "Piece", sel: "> nav > ol > li", repeat: true },
  current: { label: "This piece", sel: "> nav > ol > li > span" },
  link: { label: "Piece link", sel: "> nav > ol > li > a", repeat: true },
};

// ── small blocks ───────────────────────────────────────────────────────────

/** pt-notice (small-blocks.tsx Notice): `<aside class="card-natural">` > title, words. Both are the block's own. */
export const NOTICE_PARTS: Parts = {
  root: { label: "Notice", sel: "> aside" },
  headline: { label: "Title", sel: "> aside > h3", prop: "title", draws: { props: { title: "A title" } } },
  words: { label: "Words", sel: "> aside > div", prop: "body", draws: { props: { body: "<p>Some words.</p>" } } },
};

/** pt-post (writing-blocks.tsx Post, 2026-11-14): the route's post drawing, `<div>` > section link + cms-ui ArticleView. */
export const POST_PARTS: Parts = {
  ...ARTICLE_PARTS,
  root: { label: "Post", sel: "> div" },
  back: { label: "“← section” link", sel: "> div > a", draws: { props: { showBack: true } } },
};
