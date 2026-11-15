/**
 * Open-hours slots, computed (decision 6): weekly rules minus what is taken.
 *
 * A slot row exists only once someone books it, so this is the read path for
 * every visitor and the check the server repeats under its lock before it
 * creates a slot row. Pure: callers pass the rules, the host's busy
 * intervals and the seats already taken on this offer's slot rows.
 */

import type { BookingOffer, OpenSlot } from "./types";
import { addDays, parseClock, weekdayOf, zonedParts, zonedToInstant } from "./time";

export interface BusyInterval {
  startMs: number;
  endMs: number;
  /** `${offerId}:${startMs}` when the interval is a booking on a slot of this offer. */
  slotKey?: string | null;
}

export interface OpenHoursInput {
  offer: Pick<
    BookingOffer,
    | "id"
    | "durationMinutes"
    | "slotStepMinutes"
    | "bufferMinutes"
    | "timeZone"
    | "capacityPerSlot"
    | "leadTimeMinutes"
    | "closeBeforeMinutes"
    | "maxAheadDays"
    | "minParty"
    | "hours"
    | "validFrom"
  >;
  /** Other bookings of the same host (any offer), each widened by its buffer. */
  busy: BusyInterval[];
  /** Seats taken on this offer's slot rows, keyed by start (ms). */
  taken: Map<number, number>;
  /** Slot rows of this offer the host cancelled, keyed by start (ms). */
  cancelled?: Set<number>;
  now?: Date;
  /** First local day to list ("YYYY-MM-DD"); default today in the offer's zone. */
  fromDate?: string;
  /** How many local days to list; capped by `maxAheadDays`. */
  days?: number;
  /** Party size wanted; default the offer's minimum. */
  partySize?: number;
}

export function slotKey(offerId: string, startMs: number): string {
  return `${offerId}:${startMs}`;
}

export function computeOpenSlots(input: OpenHoursInput): OpenSlot[] {
  const { offer } = input;
  const duration = offer.durationMinutes ?? 0;
  if (duration <= 0 || offer.hours.length === 0) return [];
  const now = input.now ?? new Date();
  const step = offer.slotStepMinutes && offer.slotStepMinutes > 0 ? offer.slotStepMinutes : duration;
  const buffer = offer.bufferMinutes ?? 0;
  const capacity = offer.capacityPerSlot ?? 1;
  const party = Math.max(1, input.partySize ?? offer.minParty ?? 1);
  const earliestMs = now.getTime() + Math.max(offer.leadTimeMinutes, offer.closeBeforeMinutes) * 60000;
  const latestMs = now.getTime() + offer.maxAheadDays * 86400000;

  const today = zonedParts(now, offer.timeZone).date;
  let from = input.fromDate && /^\d{4}-\d{2}-\d{2}$/.test(input.fromDate) ? input.fromDate : today;
  if (from < today) from = today;
  if (offer.validFrom && from < offer.validFrom) from = offer.validFrom;
  const days = Math.min(Math.max(1, input.days ?? offer.maxAheadDays), offer.maxAheadDays + 1);

  const seen = new Set<number>();
  const out: OpenSlot[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const weekday = weekdayOf(date);
    for (const range of offer.hours) {
      if (range.weekday !== weekday) continue;
      const open = parseClock(range.from);
      const close = parseClock(range.to);
      if (open == null || close == null || close <= open) continue;
      for (let start = open; start + duration <= close; start += step) {
        const startsAt = zonedToInstant(date, start, offer.timeZone);
        const startMs = startsAt.getTime();
        if (seen.has(startMs)) continue;
        seen.add(startMs);
        if (startMs < earliestMs || startMs > latestMs) continue;
        if (input.cancelled?.has(startMs)) continue;
        const endMs = startMs + duration * 60000;
        const key = slotKey(offer.id, startMs);
        // Another booking of this host overlapping this time (its own buffer
        // already added by the caller, ours added here) blocks it. Bookings on
        // this very slot are counted as seats instead.
        const blocked = input.busy.some(
          (b) => b.slotKey !== key && b.startMs < endMs + buffer * 60000 && b.endMs > startMs
        );
        if (blocked) continue;
        const seatsLeft = capacity - (input.taken.get(startMs) ?? 0);
        if (seatsLeft < party) continue;
        out.push({
          startsAt: startsAt.toISOString(),
          endsAt: new Date(endMs).toISOString(),
          capacity,
          seatsLeft,
        });
      }
    }
  }
  return out.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0));
}

/** Slots grouped by local day in `timeZone`, for a picker. */
export function groupSlotsByDay(slots: OpenSlot[], timeZone: string): Array<{ date: string; slots: OpenSlot[] }> {
  const map = new Map<string, OpenSlot[]>();
  for (const s of slots) {
    const date = zonedParts(new Date(s.startsAt), timeZone).date;
    const list = map.get(date) ?? [];
    list.push(s);
    map.set(date, list);
  }
  return [...map.entries()].map(([date, list]) => ({ date, slots: list }));
}
