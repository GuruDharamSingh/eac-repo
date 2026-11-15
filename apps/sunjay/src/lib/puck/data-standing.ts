import { getStandingMeeting, listOrgEventsInRange, type StandingMeeting } from "@elkdonis/services";
import { addMonths, expandOccurrences, startOfMonth } from "@elkdonis/utils";
import type { Viewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// Which gathering "Next gathering" shows (2026-11-14, editing landscape round 2).
//
// A block's `which` (pt-standing, home-standing):
//   "standing" (also "" or missing)  the standing meeting, as before: the flagged one, else a weekly series, else the
//                                    soonest (getStandingMeeting);
//   "next"                           the next upcoming gathering, whatever it is;
//   "thread:<id>"                    that gathering's next occurrence; nothing once it has none.
//
// Every choice follows the calendar: only a reference is stored, and the occurrence is read per request for the
// viewer (the join link only for whom getStandingMeeting would give it). Series are never shown, as in
// getStandingMeeting: rows on a series thread are subscriptions, not attendance.
// ============================================================================

const ORG = siteConfig.orgId;
const SERIES = "series";

export type WhichGathering = "standing" | "next" | `thread:${string}`;

/** The stored value read safely: anything else is the standing meeting. */
export function whichOf(v: unknown): WhichGathering {
  if (v === "next") return "next";
  if (typeof v === "string" && /^thread:[A-Za-z0-9_-]{1,120}$/.test(v)) return v as WhichGathering;
  return "standing";
}

/** The occurrences this block can show, soonest first: three months, as getStandingMeeting reads. */
export async function upcomingGatherings(viewer: Viewer | null) {
  const now = new Date();
  const horizon = addMonths(startOfMonth(now), 3);
  const events = (await listOrgEventsInRange(ORG, now, horizon, 200, viewer).catch(() => [])).filter((e) => e.kind !== SERIES);
  return expandOccurrences(events, now, horizon);
}

export async function pickStanding(which: unknown, viewer: Viewer | null): Promise<StandingMeeting | null> {
  const w = whichOf(which);
  if (w === "standing") return getStandingMeeting(ORG, viewer);
  const upcoming = await upcomingGatherings(viewer);
  if (w === "next") {
    const o = upcoming[0];
    return o ? { event: o.item, at: o.at, source: "next" } : null;
  }
  const id = w.slice("thread:".length);
  const o = upcoming.find((x) => x.item.id === id);
  // An editor chose it: `flagged` is the honest source ("Only the first two may honestly be called the weekly meeting").
  return o ? { event: o.item, at: o.at, source: "flagged" } : null;
}
