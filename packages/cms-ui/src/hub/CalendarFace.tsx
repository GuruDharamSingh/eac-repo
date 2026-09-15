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

  return (
    <SurfaceCard
      kind="calendar"
      title="Calendar"
      blurb={`${byDay.size} ${byDay.size === 1 ? "day" : "days"} with something on this month.`}
      ariaLabel="Open the full calendar"
      onClick={(origin) => open(undefined, origin)}
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
