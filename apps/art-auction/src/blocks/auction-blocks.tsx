import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { CountdownView, HeroView, LotsView, StatsView, TickerView, TimelineView } from "./auction.client";
import {
  SAMPLE_BIDS,
  SAMPLE_LOTS,
  SAMPLE_NOW,
  SAMPLE_STATS,
  type WireBid,
  type WireLot,
  type WireStats,
} from "./auction-types";

// ============================================================================
// The live auction blocks.
//
// Declarations stay here, server-safe; the views are in auction.client.tsx.
// Every one is `interactive` (it polls) and `dataDriven` (the resolver fills
// `lots`, `bids` or `stats`, which the save action strips). `event` is the tag
// a lot carries in `auction_lot.metadata.event`; empty means every lot.
// ============================================================================

const base = { memberSafe: true, interactive: true, dataDriven: true, styling: "tailwind" as const, category: "listings" as const };

const EVENT = {
  name: "event",
  kind: "string",
  label: "Auction (tag)",
  description: "Only lots tagged with this auction name. Empty shows every lot.",
  default: "",
} as const;
const REFRESH = (def: number) =>
  ({ name: "refresh", kind: "number", label: "Refresh every", default: def, min: 4, max: 60, step: 1, unit: "s" }) as const;

type WithLots = { lots?: WireLot[]; now?: string };

// ── lots ────────────────────────────────────────────────────────────────────

const lotsProps = [
  { name: "heading", kind: "string", label: "Heading", default: "" },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  EVENT,
  {
    name: "scope",
    kind: "select",
    label: "Which lots",
    default: "open",
    options: [
      { value: "open", label: "Open for bidding, closing soonest first" },
      { value: "closing", label: "Closing within the hour" },
      { value: "closed", label: "Closed, newest first" },
      { value: "all", label: "All" },
    ],
  },
  { name: "limit", kind: "number", label: "How many", default: 8, min: 1, max: 48, step: 1 },
  {
    name: "layout",
    kind: "select",
    label: "Look",
    default: "grid",
    options: [
      { value: "grid", label: "Cards with pictures" },
      { value: "rows", label: "Rows" },
      { value: "compact", label: "Compact list" },
    ],
  },
  {
    name: "columns",
    kind: "select",
    label: "Cards per row",
    default: "4",
    options: [
      { value: "2", label: "Two" },
      { value: "3", label: "Three" },
      { value: "4", label: "Four" },
    ],
  },
  { name: "showImages", kind: "boolean", label: "Pictures", default: true },
  REFRESH(8),
  { name: "emptyMessage", kind: "string", label: "When there are none", default: "Nothing is open for bidding right now." },
] as const;

export const lots = defineBlock(
  {
    ...base,
    id: "au-lots",
    label: "Lots (live)",
    description:
      "Auction lots as cards or rows, each with its countdown, current bid and bid count, refreshed while the page is open.",
    props: lotsProps,
  },
  LotsView as unknown as React.ComponentType<PropsOf<typeof lotsProps> & WithLots>,
  () => ({ layout: "grid" as const, scope: "open" as const, limit: 8, columns: "4" as const, lots: SAMPLE_LOTS, now: SAMPLE_NOW })
);

// ── timeline ────────────────────────────────────────────────────────────────

const timelineProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Closing order" },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  EVENT,
  {
    name: "scope",
    kind: "select",
    label: "Which lots",
    default: "open",
    options: [
      { value: "open", label: "Open for bidding" },
      { value: "all", label: "Open and closed" },
    ],
  },
  {
    name: "group",
    kind: "select",
    label: "Group by",
    default: "hour",
    options: [
      { value: "hour", label: "The hour they close" },
      { value: "day", label: "The day they close" },
      { value: "none", label: "One by one" },
    ],
  },
  { name: "limit", kind: "number", label: "How many lots", default: 24, min: 1, max: 60, step: 1 },
  { name: "showImages", kind: "boolean", label: "Pictures", default: true },
  REFRESH(8),
  { name: "emptyMessage", kind: "string", label: "When there are none", default: "No lots are scheduled yet." },
] as const;

export const timeline = defineBlock(
  {
    ...base,
    id: "au-timeline",
    label: "Closing timeline (live)",
    description:
      "The auction as a timeline: lots grouped by when they close, each group counting down, closed lots greyed. For a silent auction where many lots end through the evening.",
    props: timelineProps,
  },
  TimelineView as unknown as React.ComponentType<PropsOf<typeof timelineProps> & WithLots>,
  () => ({ heading: "Closing order", group: "hour" as const, scope: "open" as const, limit: 24, lots: SAMPLE_LOTS, now: SAMPLE_NOW })
);

// ── hero ────────────────────────────────────────────────────────────────────

const heroProps = [
  { name: "kicker", kind: "string", label: "Small label", default: "On the block" },
  EVENT,
  {
    name: "pick",
    kind: "select",
    label: "Which lot",
    default: "soonest",
    options: [
      { value: "soonest", label: "The one closing soonest" },
      { value: "most-bid", label: "The most-bid" },
      { value: "highest", label: "The highest bid" },
    ],
  },
  REFRESH(6),
  { name: "emptyMessage", kind: "string", label: "When nothing is open", default: "The next lots will appear here once bidding opens." },
] as const;

export const hero = defineBlock(
  {
    ...base,
    id: "au-hero",
    category: "headers",
    label: "Featured lot (live)",
    description: "One lot large: picture, current bid and a countdown, with a button to bid. The bid flashes when it changes.",
    props: heroProps,
  },
  HeroView as unknown as React.ComponentType<PropsOf<typeof heroProps> & WithLots>,
  () => ({ kicker: "On the block", pick: "soonest" as const, lots: SAMPLE_LOTS, now: SAMPLE_NOW })
);

// ── ticker ──────────────────────────────────────────────────────────────────

const tickerProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Live bids" },
  EVENT,
  { name: "limit", kind: "number", label: "How many bids", default: 8, min: 1, max: 30, step: 1 },
  REFRESH(6),
  { name: "emptyMessage", kind: "string", label: "When there are none", default: "No bids yet. The first one sets the pace." },
] as const;

export const ticker = defineBlock(
  {
    ...base,
    id: "au-ticker",
    label: "Bid ticker (live)",
    description:
      "The latest bids as they happen: a paddle number, the amount and the lot. New bids flash. Bidders are never named.",
    props: tickerProps,
  },
  TickerView as unknown as React.ComponentType<PropsOf<typeof tickerProps> & { bids?: WireBid[]; now?: string }>,
  () => ({ heading: "Live bids", limit: 8, bids: SAMPLE_BIDS, now: SAMPLE_NOW })
);

// ── stats ───────────────────────────────────────────────────────────────────

const statsProps = [
  EVENT,
  { name: "showLots", kind: "boolean", label: "Lots open", default: true },
  { name: "showBids", kind: "boolean", label: "Bids placed", default: true },
  { name: "showBidders", kind: "boolean", label: "Bidders", default: true },
  { name: "showHigh", kind: "boolean", label: "Highest bid", default: true },
  REFRESH(10),
] as const;

export const stats = defineBlock(
  {
    ...base,
    id: "au-stats",
    category: "content",
    label: "Auction numbers (live)",
    description: "Lots open, bids placed, bidders and the highest bid, as a row of figures that update.",
    props: statsProps,
  },
  StatsView as unknown as React.ComponentType<PropsOf<typeof statsProps> & { stats?: WireStats; now?: string }>,
  () => ({ showLots: true, showBids: true, showBidders: true, showHigh: true, stats: SAMPLE_STATS, now: SAMPLE_NOW })
);

// ── countdown ───────────────────────────────────────────────────────────────

const countdownProps = [
  { name: "label", kind: "string", label: "Words above", default: "The auction closes in" },
  {
    name: "source",
    kind: "select",
    label: "Counts down to",
    default: "fixed",
    options: [
      { value: "fixed", label: "A date and time I set" },
      { value: "next-close", label: "The next lot to close" },
      { value: "last-close", label: "The last lot to close" },
    ],
  },
  {
    name: "until",
    kind: "string",
    label: "Date and time",
    description: "Used for “A date and time I set”. Toronto time, as 2026-10-24 20:00.",
    default: "",
  },
  EVENT,
  { name: "endedText", kind: "string", label: "When it has passed", default: "The auction has closed" },
  REFRESH(12),
] as const;

export const countdown = defineBlock(
  {
    ...base,
    id: "au-countdown",
    category: "headers",
    label: "Countdown (days to seconds)",
    description: "A large countdown to a set time, or to the next or last lot closing, measured against the server's clock.",
    props: countdownProps,
  },
  CountdownView as unknown as React.ComponentType<PropsOf<typeof countdownProps> & { stats?: WireStats; now?: string }>,
  () => ({ label: "The auction closes in", source: "next-close" as const, stats: SAMPLE_STATS, now: SAMPLE_NOW })
);
