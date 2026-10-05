import type { PageTemplate, TemplateNode } from "@elkdonis/blocks";

// ============================================================================
// Starting documents for this site's designed pages.
//
//   featured        the front-of-house page for an auction: announcement,
//                   the lot on the block, a countdown, what closes next, live
//                   bids, and doors into the rest of the marketplace
//   auction         the silent auction itself: countdown, numbers, the closing
//                   timeline with live bids beside it, every lot, closed lots
//                   and the evening's schedule
//   article-detail  the layout every article under /read/<slug> is drawn in: the
//                   topic as an article, its forum discussion live beside the
//                   lots about to close
//   card-kit        a sampler of card looks to copy from
//
// Data only: block types and settings, the same shape the editor saves. The
// live blocks store settings and fetch their rows when drawn, so a template
// shows the real auction the moment one exists, and example data before that.
// Cards get their look from the generic Style (`blkStyle`), so any block can
// be restyled without a developer.
// ============================================================================

const swatch = { ground: "#F6F3EE", ink: "#2B2420", accent: "#C0402E" };

const card = { bg: "soft", padX: 20, padY: 20, borderWidth: 1, borderColor: "line", radius: "theme" };

const split = (
  ratio: "even" | "wide-start" | "wide-end",
  start: TemplateNode[],
  end: TemplateNode[]
): TemplateNode => ({
  type: "split-row",
  props: { ratio, align: "start", gap: "loose", columns: "stacked", start, end },
});

const heading = (title: string, eyebrow = "", subtitle = ""): TemplateNode => ({
  type: "section-heading",
  props: { title, eyebrow, subtitle, level: "h2", align: "start", rule: false },
});

export const FEATURED_TEMPLATE: PageTemplate = {
  id: "featured",
  name: "Featured page",
  description:
    "The front of the auction: an announcement, the lot on the block, a countdown, what closes next, live bids, and doors into the rest of the marketplace.",
  swatch,
  cards: "Live lots, tickets",
  content: [
    {
      type: "ha-announcement",
      props: { message: "Silent auction · bidding is open", label: "See the schedule →", href: "/auction", tone: "accent" },
    },
    { type: "au-hero", props: { kicker: "On the block", event: "", pick: "soonest", refresh: 6 } },
    { type: "au-countdown", props: { label: "The next lot closes in", source: "next-close", until: "", event: "", endedText: "Bidding has closed", refresh: 12 } },
    heading("Closing next", "Bid now", "Every lot below is open. The clock is the server's, so it is the same for everyone."),
    { type: "au-lots", props: { heading: "", intro: "", event: "", scope: "open", limit: 4, layout: "grid", columns: "4", showImages: true, refresh: 8, emptyMessage: "Nothing is open for bidding right now." } },
    split(
      "even",
      [{ type: "au-ticker", props: { heading: "Live bids", event: "", limit: 8, refresh: 6, blkStyle: card } }],
      [
        { type: "au-stats", props: { event: "", showLots: true, showBids: true, showBidders: true, showHigh: true, refresh: 10 } },
        {
          type: "ha-card-ticket",
          props: {
            kicker: "How to bid",
            title: "Sign in, then bid",
            meta: "Each bid must beat the last by the increment. A bid in the last five minutes extends the clock.",
            figure: "5 min",
            figureLabel: "extension",
            href: "/lots",
            buttonLabel: "Browse the lots",
          },
        },
      ]
    ),
    heading("Explore the room", "", ""),
    {
      type: "grid",
      props: {
        columns: "3",
        minWidth: 240,
        gap: "regular",
        align: "stretch",
        items: [
          { type: "ha-card-image", props: { image: "", kicker: "Every lot", title: "All lots", text: "See everything open for bidding.", href: "/lots", label: "Browse" } },
          { type: "ha-card-image", props: { image: "", kicker: "The makers", title: "The artists", text: "Meet who made the work.", href: "/artists", label: "Meet them" } },
          { type: "ha-card-image", props: { image: "", kicker: "In three dimensions", title: "The virtual gallery", text: "Walk the room.", href: "/gallery", label: "Step in" } },
        ],
      },
    },
    { type: "au-topics", props: { heading: "From the forum", limit: 5, emptyMessage: "Nothing has been posted yet." } },
  ],
};

export const AUCTION_TEMPLATE: PageTemplate = {
  id: "auction",
  name: "Silent auction page",
  description:
    "The auction in one page: a countdown, the numbers, a closing timeline with live bids beside it, every open lot, the closed ones, and the evening's schedule.",
  swatch,
  cards: "Timeline, live lots",
  content: [
    { type: "hero-banner", props: { title: "Silent Auction", subtitle: "Bid through the evening. Lots close one by one.", imageUrl: "", imageAlt: "", align: "center", height: 0 } },
    { type: "au-countdown", props: { label: "The auction closes in", source: "last-close", until: "", event: "", endedText: "The auction has closed", refresh: 12 } },
    { type: "au-stats", props: { event: "", showLots: true, showBids: true, showBidders: true, showHigh: true, refresh: 10 } },
    split(
      "wide-start",
      [
        {
          type: "au-timeline",
          props: { heading: "Closing order", intro: "Lots are grouped by the hour they close. A late bid can extend a lot.", event: "", scope: "open", group: "hour", limit: 24, showImages: true, refresh: 8, emptyMessage: "No lots are scheduled yet." },
        },
      ],
      [
        { type: "au-ticker", props: { heading: "Live bids", event: "", limit: 10, refresh: 6, blkStyle: card } },
        {
          type: "ha-feature-list",
          props: {
            heading: "How it works",
            intro: "",
            items: [
              { title: "Sign in to bid", text: "Any signed-in member can bid." },
              { title: "Beat the last bid", text: "Each bid must clear the current one by the increment." },
              { title: "Late bids extend the clock", text: "A bid in the last five minutes adds time, so no one is sniped." },
              { title: "Winners are invoiced", text: "A winning bidder gets an order to pay." },
            ],
          },
        },
      ]
    ),
    heading("All lots", "", "Open for bidding."),
    { type: "au-lots", props: { heading: "", intro: "", event: "", scope: "open", limit: 24, layout: "grid", columns: "4", showImages: true, refresh: 8, emptyMessage: "Nothing is open for bidding right now." } },
    heading("Closed", "", "Lots that have ended."),
    { type: "au-lots", props: { heading: "", intro: "", event: "", scope: "closed", limit: 12, layout: "compact", columns: "4", showImages: false, refresh: 30, emptyMessage: "Nothing has closed yet." } },
    {
      type: "ha-timeline",
      props: {
        highlightFirst: false,
        events: [
          { when: "Doors", title: "Preview the work", text: "Walk the room before bidding opens." },
          { when: "Bidding opens", title: "Silent bidding", text: "Bids are placed on this site, from anywhere." },
          { when: "First lots close", title: "The evening begins", text: "Watch the timeline above." },
          { when: "Last lots close", title: "Winners are announced", text: "Winning bidders are sent an order." },
        ],
      },
    },
  ],
};

export const ARTICLE_DETAIL_TEMPLATE: PageTemplate = {
  id: "article-detail",
  name: "Article page",
  description:
    "The layout of every article under /read/<slug>: the forum topic as an article, its live discussion, and the lots about to close beside it. Edits here change every article.",
  swatch,
  cards: "Discussion, live lots",
  content: [
    { type: "au-article", props: { slug: "", reading: "journal", showCover: true } },
    split(
      "wide-start",
      [{ type: "au-discussion", props: { heading: "Discussion", limit: 8, refresh: 10, joinLabel: "Join the discussion", emptyMessage: "No replies yet. Start the conversation on the forum." } }],
      [
        { type: "au-lots", props: { heading: "Closing soon", intro: "", event: "", scope: "open", limit: 4, layout: "rows", columns: "4", showImages: true, refresh: 8, emptyMessage: "Nothing is open for bidding right now.", blkStyle: card } },
        { type: "au-topics", props: { heading: "More from the forum", limit: 5, emptyMessage: "Nothing has been posted yet." } },
      ]
    ),
  ],
};

export const CARD_KIT_TEMPLATE: PageTemplate = {
  id: "card-kit",
  name: "Card kit (sampler)",
  description:
    "The same block in a dozen looks, to copy from. Every card here is an ordinary block with a Style setting; open one and change it.",
  swatch,
  cards: "Style presets",
  content: [
    heading("Card styles", "Sampler", "Select a block and open Style at the foot of its fields: these are its presets."),
    {
      type: "grid",
      props: {
        columns: "3",
        minWidth: 240,
        gap: "regular",
        align: "stretch",
        items: [
          { type: "quote", props: { text: "Plain: no style set.", attribution: "", source: "", tone: "rule" } },
          { type: "quote", props: { text: "Card.", attribution: "", source: "", tone: "rule", blkStyle: { bg: "soft", padX: 24, padY: 24, borderWidth: 1, borderColor: "line", radius: "theme" } } },
          { type: "quote", props: { text: "Gallery label.", attribution: "", source: "", tone: "rule", blkStyle: { bg: "ground", padX: 28, padY: 24, borderWidth: 1, borderColor: "ink", borderSides: "all" } } },
          { type: "quote", props: { text: "Ticket.", attribution: "", source: "", tone: "rule", blkStyle: { padX: 24, padY: 24, borderWidth: 2, borderStyle: "dashed", borderColor: "accent", radius: 12 } } },
          { type: "quote", props: { text: "Spotlight.", attribution: "", source: "", tone: "rule", blkStyle: { bg: "band", color: "band-ink", padX: 28, padY: 28, shadow: "strong", radius: 4 } } },
          { type: "quote", props: { text: "Ribbon.", attribution: "", source: "", tone: "rule", blkStyle: { padX: 24, padY: 20, borderWidth: 6, borderSides: "left", borderColor: "accent", bg: "soft" } } },
          { type: "quote", props: { text: "Glass.", attribution: "", source: "", tone: "rule", blkStyle: { bg: "soft", bgOpacity: 55, padX: 24, padY: 24, borderWidth: 1, borderColor: "line", radius: 16, shadow: "soft" } } },
          { type: "quote", props: { text: "Lifted.", attribution: "", source: "", tone: "rule", blkStyle: { bg: "soft", padX: 24, padY: 24, radius: "theme", shadow: "medium", hover: "lift" } } },
          { type: "quote", props: { text: "Glow.", attribution: "", source: "", tone: "rule", blkStyle: { bg: "ground", padX: 24, padY: 24, radius: 12, shadow: "glow", hover: "glow" } } },
        ],
      },
    },
  ],
};

export const BLANK_TEMPLATE: PageTemplate = {
  id: "plain",
  name: "Plain page",
  description: "A heading band and some words.",
  swatch,
  cards: "None",
  content: [
    { type: "hero-banner", props: { title: "Page title", subtitle: "", imageUrl: "", imageAlt: "", align: "center", height: 0 } },
    { type: "prose", props: { body: "<p>Write here.</p>" } },
  ],
};

export function allTemplates(): PageTemplate[] {
  return [FEATURED_TEMPLATE, AUCTION_TEMPLATE, ARTICLE_DETAIL_TEMPLATE, CARD_KIT_TEMPLATE, BLANK_TEMPLATE];
}

/** The document a page opens with when nothing is stored for it yet. */
export function startingTemplate(slug: string, start?: string): PageTemplate {
  if (slug === "article-detail") return ARTICLE_DETAIL_TEMPLATE;
  const pick = start || slug;
  if (pick === "featured") return FEATURED_TEMPLATE;
  if (pick === "auction" || pick === "silent-auction") return AUCTION_TEMPLATE;
  return BLANK_TEMPLATE;
}
