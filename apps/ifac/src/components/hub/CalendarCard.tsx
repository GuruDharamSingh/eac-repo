"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addMonths,
  dayKey,
  monthGrid,
  occurrencesByDay,
  startOfMonth,
} from "@elkdonis/utils";
import type { HubEvent } from "@/lib/hub-data";
import { HubCard } from "./HubCard";
import { formatDateTime, formatDuration, formatLabel } from "./format";

/**
 * A real month calendar, not a list of dates.
 *
 * The occurrence expansion and the grid come from @elkdonis/utils, shared with
 * amrit-canada's calendar card. Only the markup is app-specific: this one is
 * bespoke CSS on a native <dialog>, that one is Tailwind/shadcn, and neither
 * app should take on the other's styling system to share a month grid.
 *
 * Expansion is client-side rather than SQL because a recursive CTE would
 * return occurrence rows that do not exist as records, which then cannot be
 * clicked through to anything. Expanding from the real row keeps every cell
 * pointing back at its own thread.
 */
export function CalendarCard({
  initialEvents,
  canEdit,
}: {
  initialEvents: HubEvent[];
  canEdit: boolean;
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));
  const [events, setEvents] = useState(initialEvents);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMonth = useCallback(async (month: Date) => {
    setLoading(true);
    try {
      const to = addMonths(month, 1);
      const res = await fetch(
        `/api/hub/calendar?from=${month.toISOString()}&to=${to.toISOString()}`
      );
      if (res.ok) setEvents((await res.json()).events ?? []);
    } catch {
      // Leave the previous month's events on screen rather than blanking the
      // grid — a stale month is more useful than an empty one.
    } finally {
      setLoading(false);
    }
  }, []);

  const step = (delta: number) => {
    const next = addMonths(cursor, delta);
    setCursor(next);
    setSelected(null);
    void loadMonth(next);
  };

  const byDay = useMemo(
    () => occurrencesByDay(events, cursor, addMonths(cursor, 1)),
    [events, cursor]
  );

  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => (e.nextOccurrenceAt ?? e.scheduledAt) !== null)
        .sort((a, b) =>
          (a.nextOccurrenceAt ?? a.scheduledAt ?? "") <
          (b.nextOccurrenceAt ?? b.scheduledAt ?? "")
            ? -1
            : 1
        )
        .slice(0, 3),
    [events]
  );

  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <HubCard
      title="Calendar"
      blurb="What's coming up for the group."
      glyph="▣"
      accent="blue"
      preview={
        upcoming.length ? (
          <>
            {upcoming.map((e) => (
              <span key={e.id} className="hub-preview-line">
                <span className="hub-preview-date">
                  {shortDate(e.nextOccurrenceAt ?? e.scheduledAt)}
                </span>
                {e.title}
              </span>
            ))}
          </>
        ) : (
          <span className="hub-preview-empty">Nothing scheduled</span>
        )
      }
    >
      <div className="hub-panel">
        <div className="hub-cal-head">
          <button
            type="button"
            className="hub-btn hub-btn--icon"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            &larr;
          </button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button
            type="button"
            className="hub-btn hub-btn--icon"
            onClick={() => step(1)}
            aria-label="Next month"
          >
            &rarr;
          </button>
        </div>

        <div className="hub-cal-grid" role="grid" aria-busy={loading}>
          {WEEKDAYS.map((day) => (
            <div key={day} className="hub-cal-weekday" role="columnheader">
              {day}
            </div>
          ))}
          {cells.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`pad-${index}`}
                  aria-hidden
                  className="hub-cal-cell hub-cal-cell--pad"
                />
              );
            }
            const key = dayKey(date);
            const dayEvents = byDay.get(key) ?? [];
            const isToday = key === dayKey(today);
            const isSelected = selected === key;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className={[
                  "hub-cal-cell",
                  isToday ? "is-today" : "",
                  isSelected ? "is-selected" : "",
                  dayEvents.length ? "has-events" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelected(isSelected ? null : key)}
                aria-pressed={isSelected}
                aria-label={`${date.getDate()} — ${dayEvents.length} event${
                  dayEvents.length === 1 ? "" : "s"
                }`}
              >
                <span className="hub-cal-num">{date.getDate()}</span>
                {dayEvents.slice(0, 2).map(({ item, at }) => (
                  <span
                    key={`${item.id}-${at.toISOString()}`}
                    className="hub-cal-pip"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="hub-cal-more">+{dayEvents.length - 2}</span>
                )}
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="hub-cal-detail">
            <h4>{longDate(selected)}</h4>
            {selectedEvents.length === 0 && (
              <p className="hub-muted">Nothing on this day.</p>
            )}
            {selectedEvents.map(({ item, at }) => (
              <article
                key={`${item.id}-${at.toISOString()}`}
                className="hub-cal-event"
              >
                <h5>{item.title}</h5>
                <p className="hub-muted">
                  {[
                    formatDateTime(at.toISOString()),
                    formatDuration(item.durationMinutes),
                    formatLabel(item.format),
                    item.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="hub-panel-actions">
                  <a className="hub-btn" href={`/hub/meetings/${item.slug}`}>
                    Details
                  </a>
                  {item.meetingUrl && (
                    <a
                      className="hub-btn"
                      href={item.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="hub-panel-actions">
            <a className="hub-btn hub-btn--primary" href="/hub/compose?kind=event">
              Add an event
            </a>
          </div>
        )}
      </div>
    </HubCard>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function shortDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

