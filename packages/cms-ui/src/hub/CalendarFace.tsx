"use client";

import * as React from "react";
import { addMonths, dayKey, occurrencesByDay, startOfMonth } from "@elkdonis/utils";
import { MonthGrid, SurfaceCard, useSurface, type SurfaceEvent } from "../surface";
import { faceOf } from "./face-origin";

/**
 * The hub's calendar tile, as a face.
 *
 * The month is drawn on the face at compact density by the same MonthGrid the
 * calendar surface uses at full density, so opening the tile visibly enlarges
 * the calendar rather than replacing it with a different one.
 *
 * Three click targets, in decreasing specificity — the same three the old
 * Link-based tile had, now resolving to surfaces instead of routes:
 *   - a day with one thing on it opens that thing
 *   - a day with several opens the month with that day selected
 *   - an empty day, for an editor, opens the quick-add form dated to it;
 *     for anyone else it falls through to the face and opens the month
 *   - the rest of the face opens the month
 *
 * The month is server-rendered from `initialEvents` and handed to the surface
 * on open, so the popup's first month needs no fetch.
 *
 * The top band — the kind's medallion — carries the NEXT thing on instead.
 * A month grid tells you which days have something and nothing whatever about
 * what; the one fact a calendar tile is actually asked for is "what is coming
 * up", and it was the one fact the tile did not state. Clicking it opens that
 * event rather than the month.
 */
export function CalendarFace({
  initialEvents,
  canEdit,
}: {
  initialEvents: SurfaceEvent[];
  canEdit: boolean;
}) {
  const surfaces = useSurface();
  const today = React.useMemo(() => new Date(), []);
  const cursor = React.useMemo(() => startOfMonth(today), [today]);
  const byDay = React.useMemo(
    () => occurrencesByDay(initialEvents, cursor, addMonths(cursor, 1)),
    [initialEvents, cursor]
  );

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  // The day cells open surfaces themselves, and MonthGrid's onSelect carries
  // no event, so the face is found from the live region they sit in.
  const liveRef = React.useRef<HTMLDivElement>(null);
  const face = () => faceOf(liveRef.current);
  const open = (day?: string, origin: HTMLElement | null = face()) =>
    surfaces.open({ type: "calendar", month: monthKey, day, events: initialEvents }, origin);

  // The soonest thing that has not happened yet. `initialEvents` is this
  // month's window, so a quiet end-of-month simply has none — the slot then
  // draws nothing rather than reaching for last week's.
  const next = React.useMemo(() => {
    const now = today.getTime();
    return initialEvents
      .filter((e) => e.scheduledAt && new Date(e.scheduledAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt as string).getTime() -
          new Date(b.scheduledAt as string).getTime()
      )[0];
  }, [initialEvents, today]);

  return (
    <SurfaceCard
      kind="calendar"
      title="Calendar"
      blurb={`${byDay.size} ${byDay.size === 1 ? "day" : "days"} with something on this month.`}
      ariaLabel="Open the full calendar"
      onClick={(origin) => open(undefined, origin)}
      tools={
        next ? (
          // A banner row, not a pill. The first cut put the date and title in
          // a rounded chip, which took the same band as a medallion and gave
          // the month grid the same squeezed remainder. This spans the card:
          // a small NEXT rubric, then the day and time, then what it is —
          // the three facts a calendar tile is actually asked for, in the
          // space the decorative mark was using.
          <button
            type="button"
            className="eac-cal-next"
            data-kind={next.kind ?? "event"}
            onClick={(e) =>
              surfaces.open(
                { type: "thread", id: next.id, preview: { title: next.title, kind: next.kind } },
                faceOf(e.currentTarget)
              )
            }
          >
            <span className="eac-cal-next-rubric">Next</span>
            <span className="eac-cal-next-when">
              {new Date(next.scheduledAt as string).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {" · "}
              {new Date(next.scheduledAt as string).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="eac-cal-next-title">{next.title}</span>
          </button>
        ) : undefined
      }
      preview={
        <div className="eac-face-live" ref={liveRef}>
          <MonthGrid
            cursor={cursor}
            byDay={byDay}
            today={today}
            density="compact"
            headless
            onSelect={(key, occurrences) => {
              if (occurrences.length === 1) {
                const { item, at } = occurrences[0];
                surfaces.open(
                  {
                    type: "thread",
                    id: item.id,
                    preview: {
                      title: item.title,
                      kind: item.kind,
                      scheduledAt: at.toISOString(),
                      coverImageUrl: item.coverImageUrl,
                    },
                  },
                  face()
                );
              } else if (occurrences.length > 1) {
                open(key);
              } else if (canEdit) {
                surfaces.open(
                  {
                    type: "compose",
                    kind: "meeting",
                    tier: "quick",
                    prefill: { scheduled_at: `${key}T10:00` },
                  },
                  face()
                );
              } else {
                open(key === dayKey(today) ? key : undefined);
              }
            }}
          />
        </div>
      }
    />
  );
}
