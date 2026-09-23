"use client";

import * as React from "react";
import { addMonths, occurrencesByDay, startOfMonth } from "@elkdonis/utils";
import { MonthGrid, useSurface, type SurfaceEvent } from "../surface";

// ============================================================================
// Just a calendar — the month, larger, not a card.
//
// The same MonthGrid the calendar surface draws, at full density so titles
// show, with month paging through the host's `listEvents`. A day with one
// thing opens it; a busier day (or an empty one) opens the calendar surface
// on that day, where an editor can add to it.
// ============================================================================

export function HubCalendar({ initialEvents }: { initialEvents: SurfaceEvent[] }) {
  const surfaces = useSurface();
  const today = React.useMemo(() => new Date(), []);
  const [cursor, setCursor] = React.useState(() => startOfMonth(today));
  const [events, setEvents] = React.useState(initialEvents);
  const [busy, setBusy] = React.useState(false);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const list = surfaces.connectors.listEvents;
    if (!list) return;
    let live = true;
    setBusy(true);
    list(cursor, addMonths(cursor, 1))
      .then((e) => live && setEvents(e))
      .catch(() => live && setEvents([]))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [cursor, surfaces.connectors.listEvents]);

  const byDay = React.useMemo(() => occurrencesByDay(events, cursor, addMonths(cursor, 1)), [events, cursor]);
  const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const ref = React.useRef<HTMLElement>(null);

  return (
    <section className="eac-hs-cal" aria-label="Calendar" ref={ref}>
      <div className="eac-hs-cal-head">
        <h2 className="eac-hs-h">Calendar</h2>
        <button
          type="button"
          className="eac-hs-link"
          onClick={() => surfaces.open({ type: "calendar", month, events }, ref.current)}
        >
          Open full calendar
        </button>
      </div>
      <MonthGrid
        cursor={cursor}
        byDay={byDay}
        today={today}
        busy={busy}
        density="full"
        onPrev={() => setCursor((c) => addMonths(c, -1))}
        onNext={() => setCursor((c) => addMonths(c, 1))}
        onSelect={(key, occ) => {
          if (occ.length === 1) {
            const ev = occ[0].item;
            surfaces.open({ type: "thread", id: ev.id, preview: { title: ev.title, kind: ev.kind } }, ref.current);
          } else {
            surfaces.open({ type: "calendar", month, day: key, events }, ref.current);
          }
        }}
      />
    </section>
  );
}
