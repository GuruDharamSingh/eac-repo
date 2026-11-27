import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { listGuides } from "@/lib/tours";
import { bookingTablesOn, listExistingSlots } from "@/lib/tour-slots";
import { overlappingPairs, pairOf } from "@/lib/overlap-pairs";

export { overlappingPairs, pairOf };

/**
 * Overlap notices (2026-11-24). Two scheduled slots of the same guide that overlap in time are allowed (the schedulers
 * warn and do not refuse); each such pair is listed here as a notice until someone dismisses it. Overlaps are computed
 * from the slots, not stored, so cancelling or moving a slot clears its notice; only the dismissal is stored
 * (booking_clash_dismissals, migration 291). A dismissal hides the notice; the schedule keeps flagging the overlap.
 * Booking tables only (BOOKING_TABLES=1): the legacy departures have no ids to key a dismissal on.
 */

const ORG = siteConfig.orgId;
/** How far ahead notices look: the longest standing listing (six months) and a little more. */
const AHEAD_DAYS = 200;

export interface OverlapSide {
  slotId: string;
  tourId: string;
  tourTitle: string;
  startsAt: string;
  endsAt: string;
}

export interface Overlap {
  /** "<smaller slot id>:<larger slot id>". */
  key: string;
  a: OverlapSide;
  b: OverlapSide;
  guideId: string;
  guideName: string | null;
  dismissed: boolean;
}

async function dismissedKeys(): Promise<Set<string>> {
  try {
    const rows = await db<{ slot_a: string; slot_b: string }[]>`SELECT slot_a, slot_b FROM booking_clash_dismissals WHERE org_id = ${ORG}`;
    return new Set(rows.map((r) => `${r.slot_a}:${r.slot_b}`));
  } catch (err) {
    // Migration 291 not applied yet: nothing can have been dismissed.
    if ((err as { code?: string }).code === "42P01") return new Set();
    throw err;
  }
}

/**
 * The overlaps ahead, soonest first. `guideUserId` limits them to that guide's own (a guide sees theirs; owners pass
 * nothing). Dismissed ones are left out unless `includeDismissed`.
 */
export async function listOverlaps(opts: { guideUserId?: string; includeDismissed?: boolean } = {}): Promise<Overlap[]> {
  if (!bookingTablesOn()) return [];
  const from = new Date();
  const to = new Date(from.getTime() + AHEAD_DAYS * 24 * 3600_000);
  const [slots, dismissed, guides] = await Promise.all([listExistingSlots(from, to), dismissedKeys(), listGuides().catch(() => [] as Awaited<ReturnType<typeof listGuides>>)]);
  const names = new Map(guides.map((g) => [g.id, g.name]));
  const out: Overlap[] = [];
  for (const [x, y] of overlappingPairs(slots)) {
    if (opts.guideUserId && x.guideUserId !== opts.guideUserId) continue;
    const [first, second] = pairOf(x.id!, y.id!);
    const [a, b] = first === x.id ? [x, y] : [y, x];
    const key = `${first}:${second}`;
    const isDismissed = dismissed.has(key);
    if (isDismissed && !opts.includeDismissed) continue;
    const side = (s: typeof x): OverlapSide => ({ slotId: s.id!, tourId: s.tourId, tourTitle: s.tourTitle, startsAt: new Date(s.startsAt).toISOString(), endsAt: new Date(s.endsAt).toISOString() });
    out.push({ key, a: side(a), b: side(b), guideId: x.guideUserId!, guideName: names.get(x.guideUserId!) ?? null, dismissed: isDismissed });
  }
  return out.sort((p, q) => Math.min(+new Date(p.a.startsAt), +new Date(p.b.startsAt)) - Math.min(+new Date(q.a.startsAt), +new Date(q.b.startsAt)));
}

/** How many undismissed overlap notices a viewer has. Zero on any failure: a count must not break the page. */
export async function countOverlaps(opts: { guideUserId?: string } = {}): Promise<number> {
  try {
    return (await listOverlaps(opts)).length;
  } catch (err) {
    console.error("[elktours] countOverlaps:", err);
    return 0;
  }
}

/** Every overlap a slot is in (dismissed or not), for the flag on the slot's card and page. */
export async function overlapsOfSlot(slotId: string, window: { startsAt: string; endsAt: string }): Promise<Array<{ slotId: string; tourTitle: string; startsAt: string }>> {
  if (!bookingTablesOn()) return [];
  const lo = new Date(new Date(window.startsAt).getTime() - 36 * 3600_000);
  const hi = new Date(new Date(window.endsAt).getTime() + 36 * 3600_000);
  const slots = await listExistingSlots(lo, hi);
  const out: Array<{ slotId: string; tourTitle: string; startsAt: string }> = [];
  for (const [x, y] of overlappingPairs(slots)) {
    const other = x.id === slotId ? y : y.id === slotId ? x : null;
    if (other) out.push({ slotId: other.id!, tourTitle: other.tourTitle, startsAt: new Date(other.startsAt).toISOString() });
  }
  return out;
}
