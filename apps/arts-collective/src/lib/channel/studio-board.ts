// ============================================================================
// Channel → the Studio's Board sheet (2026-11-11, docs/open/MAKE_INTO_CARRY_2026-11-11.md §8).
// Pure, browser-safe: builds the small view the sheet draws from the same
// ContentDetailModel Channel's piece pop-up renders (content-detail.ts), so the
// sheet and Channel never disagree about a piece.
// ============================================================================

import { panelOf, type ContentDetailModel, type ContentEvent, type ContentLane } from "@elkdonis/content/model";
import { typeLabel } from "@elkdonis/content/registry";
import type { StudioBoardItem, StudioBoardView } from "@elkdonis/studio";

/** Weeks the sheet shows: this one and the next two (canvas R1). */
const WEEKS = 3;

/** Lane order and names in the sheet. Channel's social outlets share one lane here. */
const LANES: Array<{ id: ContentLane; label: string }> = [
  { id: "dates", label: "Dates" },
  { id: "site", label: "Website" },
  { id: "social", label: "Social" },
  { id: "email", label: "Email" },
  { id: "video", label: "Video" },
  { id: "writing", label: "Writing" },
  { id: "live", label: "Live" },
  { id: "market", label: "Market" },
];

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
function dateIn(at: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week a date falls in. */
function mondayOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

function itemOf(e: ContentEvent): StudioBoardItem {
  return { id: e.id, at: e.at, label: e.label, state: e.state, href: e.href ?? null };
}

export interface StudioBoardLinks {
  /** Channel's scoped href (adds `?org=` in an org's channel). */
  href: (path: string, params?: Record<string, string | null | undefined>) => string;
  /** "/channel". */
  base: string;
}

export function studioBoardView(detail: ContentDetailModel, links: StudioBoardLinks): StudioBoardView {
  const tz = detail.timeZone;
  const today = dateIn(detail.now, tz);
  const first = mondayOf(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(first, i * 7));
  const end = addDays(first, WEEKS * 7); // exclusive
  const weekOf = (at: string): number => {
    const d = dateIn(at, tz);
    if (d < first || d >= end) return -1;
    return Math.floor((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / (7 * 86_400_000));
  };

  // The window's events by lane, plus the item's own next date.
  const inWindow: Array<{ lane: ContentLane; week: number; item: StudioBoardItem }> = [];
  for (const e of detail.timeline) {
    const w = weekOf(e.at);
    if (w >= 0) inWindow.push({ lane: e.lane, week: w, item: itemOf(e) });
  }
  if (detail.dates.next) {
    const w = weekOf(detail.dates.next);
    if (w >= 0) {
      const day = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", timeZone: tz }).format(new Date(detail.dates.next));
      inWindow.push({ lane: "dates", week: w, item: { id: `${detail.key}:next`, at: detail.dates.next, label: day, state: "scheduled" } });
    }
  }
  const lanes = LANES.map(({ id, label }) => {
    const cells: StudioBoardItem[][] = weeks.map(() => []);
    for (const x of inWindow) if (x.lane === id) cells[x.week]!.push(x.item);
    for (const c of cells) c.sort((a, b) => a.at.localeCompare(b.at));
    return { id, label, cells };
  }).filter((l) => l.cells.some((c) => c.length > 0));

  const plan = links.href(links.base, { piece: detail.key, tab: "plan" });
  const suggestions = panelOf(detail, "plan")?.suggestions ?? [];
  const next = suggestions.slice(0, 4).map((s) => ({ id: s.id, chip: s.chip, text: s.text, reason: s.reason, href: plan }));

  const nowMs = Date.parse(detail.now);
  const recent = detail.timeline
    .filter((e) => Date.parse(e.at) <= nowMs && e.state !== "suggested")
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3)
    .map(itemOf);

  return {
    title: detail.title,
    typeLabel: typeLabel(detail.type),
    status: detail.status.label,
    timeZone: tz,
    now: detail.now,
    weeks,
    lanes,
    next,
    recent,
    links: {
      board: detail.links.board ?? links.href(links.base),
      plan,
      queue: links.href(`${links.base}/queue`, { week: first }),
      compose: detail.links.compose,
      public: detail.links.public,
    },
    planning: !detail.missing.includes("channel_plans"),
  };
}
