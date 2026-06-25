// ============================================================================
// Feed tab configuration. Tabs filter the feed by content kind:
//   meetings     — threads with kind 'meeting' (recurring AND one-off)
//   workshops    — threads with kind 'workshop' or 'event'
//   publications — posts + forum threads + Substack RSS
//   all          — everything, with the featured strip at the head
//
// Order is admin-configurable, stored in site_config under FEED_TAB_ORDER_KEY.
// DEFAULT_TAB_ORDER is the fallback when nothing is saved.
// ============================================================================

export type FeedTabKey = "meetings" | "all" | "publications" | "workshops";

export const FEED_TAB_ORDER_KEY = "feed_tab_order";

export const DEFAULT_TAB_ORDER: FeedTabKey[] = [
  "meetings",
  "all",
  "publications",
  "workshops",
];

export const TAB_LABELS: Record<FeedTabKey, string> = {
  all: "All",
  meetings: "Meetings",
  workshops: "Workshops",
  publications: "Publications",
};

const VALID = new Set<FeedTabKey>(DEFAULT_TAB_ORDER);

/** Sanitize a stored/incoming order: keep known keys, dedupe, append any missing. */
export function normalizeTabOrder(raw: unknown): FeedTabKey[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<FeedTabKey>();
  const out: FeedTabKey[] = [];
  for (const k of arr) {
    if (typeof k === "string" && VALID.has(k as FeedTabKey) && !seen.has(k as FeedTabKey)) {
      seen.add(k as FeedTabKey);
      out.push(k as FeedTabKey);
    }
  }
  for (const k of DEFAULT_TAB_ORDER) if (!seen.has(k)) out.push(k);
  return out;
}
