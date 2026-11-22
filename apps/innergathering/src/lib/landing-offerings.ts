import { getViewer } from "@/lib/auth";
import {
  getAttendanceCount,
  getCycleStatus,
  getThreadRsvpForUser,
  getThreadsForFeed,
} from "@/lib/data";
import { formatRecurrence, formatShortDate, formatTime } from "@/lib/format";
import type { OfferingItem, OfferingRow } from "@/components/landing/OfferingsBand";
import type { Thread } from "@/lib/types";

// ============================================================================
// What the "Current offerings" block (offerings-band) reads, one place for the page, the block's server resolver and
// the editor's endpoint (api/blocks/offerings). With no settings it returns exactly what app/page.tsx's own loader
// returned before (2026-11-21): the soonest upcoming public gathering as the lead, then the next three as rows.
//
// Only threads of the "offerings" feed can be shown, chosen or not: getThreadsForFeed keeps to published, public
// threads, so a typed thread id can never reach a draft or a private post.
// ============================================================================

export interface OfferingsSettings {
  /** A thread id from the Offerings feed. Empty: the soonest upcoming gathering. */
  featured?: string;
  /** What the row beneath shows: the next gatherings, the latest posts, or nothing. */
  more?: string;
  /** How many rows beneath. */
  moreCount?: number;
}

export interface OfferingsData {
  /** The lead gathering, with its count and the viewer's own answer. Empty when there is nothing to show. */
  items: OfferingItem[];
  /** The rows beneath the lead. */
  rows: OfferingRow[];
  signedIn: boolean;
  nextcloudUrl: string | null;
}

const GATHERINGS = ["meeting", "event", "workshop"];

const rowOf = (t: Thread, meta: string): OfferingRow => ({
  id: t.id,
  href: `/${t.feedSlug}/${t.slug}`,
  title: t.title,
  meta,
});

const gatheringMeta = (t: Thread) =>
  [
    t.nextOccurrenceAt && `${formatShortDate(t.nextOccurrenceAt)} · ${formatTime(t.nextOccurrenceAt)}`,
    formatRecurrence(t.recurrencePattern),
  ]
    .filter(Boolean)
    .join(" · ");

/** The lead's own numbers: this cycle's status, the RSVP count and whether the viewer has said yes. */
async function leadItem(thread: Thread, viewerId: string | null): Promise<OfferingItem> {
  const recurring = Boolean(thread.recurrencePattern && thread.recurrencePattern !== "NONE");
  const [cycleStatus, attendanceCount, attending] = await Promise.all([
    recurring ? getCycleStatus(thread) : Promise.resolve(null),
    thread.isRsvpEnabled ? getAttendanceCount(thread) : Promise.resolve(0),
    viewerId ? getThreadRsvpForUser(thread, viewerId) : Promise.resolve(false),
  ]);
  return { thread, cycleStatus, attendanceCount, attending };
}

/**
 * Upcoming gatherings, soonest first (a meeting stays listed six hours past its start): the same filter the
 * landing page always used. Posts and past one-offs are left out.
 */
function upcomingOf(threads: Thread[]): Thread[] {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  return threads
    .filter((t) => GATHERINGS.includes(t.kind))
    .filter((t) => t.nextOccurrenceAt && new Date(t.nextOccurrenceAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.nextOccurrenceAt!).getTime() - new Date(b.nextOccurrenceAt!).getTime());
}

export async function loadOfferingsData(settings: OfferingsSettings = {}, viewerId?: string | null): Promise<OfferingsData> {
  const viewer = viewerId === undefined ? await getViewer().catch(() => null) : null;
  const who = viewerId === undefined ? viewer?.userId ?? null : viewerId;
  const threads = await getThreadsForFeed("offerings");
  const upcoming = upcomingOf(threads);
  const count = Math.min(Math.max(Math.trunc(Number(settings.moreCount ?? 3)) || 0, 0), 12);

  const chosen = settings.featured?.trim() ? threads.find((t) => t.id === settings.featured!.trim()) ?? null : null;
  const lead = chosen ?? upcoming[0] ?? null;
  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? null;
  if (!lead) return { items: [], rows: [], signedIn: Boolean(who), nextcloudUrl };

  const mode = settings.more === "posts" || settings.more === "none" ? settings.more : "upcoming";
  let rows: OfferingRow[] = [];
  if (mode === "upcoming") {
    rows = upcoming.filter((t) => t.id !== lead.id).slice(0, count).map((t) => rowOf(t, gatheringMeta(t)));
  } else if (mode === "posts") {
    rows = threads
      .filter((t) => !GATHERINGS.includes(t.kind) && t.id !== lead.id)
      .sort((a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime())
      .slice(0, count)
      .map((t) => rowOf(t, t.publishedAt ? formatShortDate(t.publishedAt) : ""));
  }
  return { items: [await leadItem(lead, who)], rows, signedIn: Boolean(who), nextcloudUrl };
}
