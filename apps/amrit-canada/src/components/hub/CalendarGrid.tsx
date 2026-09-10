"use client";

import * as React from "react";
import type { OrgCalendarEvent } from "@elkdonis/services";
import {
  addMonths,
  dayKey,
  monthGrid,
  occurrencesByDay,
  startOfMonth,
  type Occurrence,
} from "@elkdonis/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A live month grid, shared by the hub tile and the full calendar page.
 *
 * The two densities are genuinely different renderings, not one scaled:
 *
 * - `compact` (the tile) draws a date and up to three dots. A truncated title
 *   in a 32px cell is unreadable and still costs the row its height, while a
 *   dot answers the only question a tile can answer — is anything on that day?
 * - `full` (the page) has room for titles, so it shows them.
 *
 * Cells are rendered by the caller through `renderDay`, because the tile wants
 * links (a day goes straight to its thread) and the page wants buttons (a day
 * selects, and the detail appears beside the grid). Baking either in would
 * force the other consumer to fight it.
 *
 * The first month is server-rendered and passed in, so the grid is populated
 * before any JS runs. Paging fetches through `endpoint`.
 */
export function CalendarGrid({
  initialEvents,
  density = "full",
  initialMonth,
  endpoint = "/api/hub/calendar",
  className,
  renderDay,
}: {
  initialEvents: OrgCalendarEvent[];
  density?: "compact" | "full";
  /** Month to open on. Defaults to the current one. */
  initialMonth?: Date;
  endpoint?: string;
  className?: string;
  renderDay: (day: {
    date: Date;
    key: string;
    occurrences: Array<Occurrence<OrgCalendarEvent>>;
    isToday: boolean;
    /** The cell's own classes — layout, sizing and the today/empty states. */
    className: string;
    children: React.ReactNode;
  }) => React.ReactNode;
}) {
  const compact = density === "compact";
  const today = React.useMemo(() => new Date(), []);
  const [cursor, setCursor] = React.useState(() =>
    startOfMonth(initialMonth ?? today)
  );
  const [events, setEvents] = React.useState(initialEvents);
  const [loading, setLoading] = React.useState(false);

  const byDay = React.useMemo(
    () => occurrencesByDay(events, cursor, addMonths(cursor, 1)),
    [events, cursor]
  );
  const cells = React.useMemo(() => monthGrid(cursor), [cursor]);

  async function goTo(month: Date) {
    setCursor(month);
    setLoading(true);
    try {
      const to = addMonths(month, 1);
      const res = await fetch(
        `${endpoint}?from=${month.toISOString()}&to=${to.toISOString()}`
      );
      if (res.ok) setEvents((await res.json()).events ?? []);
    } catch {
      // Keep the previous month's events on screen. A stale grid under a
      // correct month label is more useful than an empty one.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex shrink-0 flex-col gap-1", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("p-0", compact ? "size-6" : "size-8")}
          onClick={() => goTo(addMonths(cursor, -1))}
          aria-label="Previous month"
        >
          &larr;
        </Button>
        <h4
          aria-live="polite"
          className={cn(
            "font-medium tabular-nums",
            compact ? "text-xs" : "font-serif text-lg"
          )}
        >
          {cursor.toLocaleDateString(undefined, {
            month: compact ? "short" : "long",
            year: "numeric",
          })}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className={cn("p-0", compact ? "size-6" : "size-8")}
          onClick={() => goTo(addMonths(cursor, 1))}
          aria-label="Next month"
        >
          &rarr;
        </Button>
      </div>

      {/* Sized by its rows rather than stretched: stretching would make cell
          height depend on whether a month spans five weeks or six, so a tile
          would visibly change shape as you page through the year. */}
      <div
        role="grid"
        aria-busy={loading}
        aria-label="Month"
        className={cn("grid grid-cols-7", compact ? "gap-px" : "gap-1")}
      >
        {WEEKDAYS.map((day, index) => (
          <div
            key={index}
            role="columnheader"
            aria-label={day}
            className={cn(
              "text-center uppercase tracking-wider text-muted-foreground",
              compact ? "text-[0.55rem]" : "py-1 text-[0.68rem]"
            )}
          >
            {compact ? day.charAt(0) : day.slice(0, 2)}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={`pad-${index}`} aria-hidden />;

          const key = dayKey(date);
          const occurrences = byDay.get(key) ?? [];
          const isToday = key === dayKey(today);
          const empty = occurrences.length === 0;

          const className = cn(
            "flex flex-col rounded transition",
            compact
              ? "h-6 items-center justify-center gap-0.5"
              : "min-h-[64px] items-stretch gap-0.5 border border-border p-1.5 text-left",
            !empty && "hover:bg-accent",
            !compact && !empty && "bg-card",
            !compact && empty && "bg-muted/30",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          );

          const children = (
            <>
              <span
                className={cn(
                  "tabular-nums",
                  compact ? "text-[0.65rem] leading-none" : "text-xs",
                  isToday
                    ? cn(
                        "grid place-items-center rounded-full bg-primary text-primary-foreground",
                        compact ? "size-4" : "size-5"
                      )
                    : "text-muted-foreground",
                  !empty && !isToday && "font-semibold text-foreground"
                )}
              >
                {date.getDate()}
              </span>

              {compact ? (
                // Reserved whether or not there are dots, so rows never jog as
                // you page between months.
                <span className="flex h-1 items-center gap-0.5">
                  {occurrences.slice(0, 3).map((occurrence) => (
                    <span
                      key={`${occurrence.item.id}-${occurrence.at.toISOString()}`}
                      className="size-1 rounded-full bg-primary"
                    />
                  ))}
                </span>
              ) : (
                <>
                  {occurrences.slice(0, 2).map(({ item, at }) => (
                    <span
                      key={`${item.id}-${at.toISOString()}`}
                      title={item.title}
                      className="truncate rounded bg-primary/15 px-1 text-[0.62rem] leading-tight text-foreground"
                    >
                      {item.title}
                    </span>
                  ))}
                  {occurrences.length > 2 && (
                    <span className="text-[0.6rem] text-muted-foreground">
                      +{occurrences.length - 2}
                    </span>
                  )}
                </>
              )}
            </>
          );

          return (
            <React.Fragment key={key}>
              {renderDay({ date, key, occurrences, isToday, className, children })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The one-line summary under a day's event. Shared by the tile and the page. */
export function occurrenceSummary(item: OrgCalendarEvent, at: Date): string {
  return [
    at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    item.durationMinutes ? `${item.durationMinutes} min` : null,
    FORMAT_LABELS[item.format ?? ""] ?? null,
    item.location,
  ]
    .filter(Boolean)
    .join(" · ");
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};
