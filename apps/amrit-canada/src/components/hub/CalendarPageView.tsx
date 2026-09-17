"use client";

import * as React from "react";
import Link from "next/link";
import type { OrgCalendarEvent } from "@elkdonis/services";
import type { Occurrence } from "@elkdonis/utils";
import { cn } from "@/lib/utils";
import { CalendarGrid, occurrenceSummary } from "./CalendarGrid";
import { Button } from "@elkdonis/primitives";

/**
 * The expanded calendar, for /hub/calendar.
 *
 * Same grid as the tile at the fuller density, with the selected day's detail
 * beside it rather than in a dialog — there is room here, and a modal on a
 * page whose entire purpose is the calendar would be a layer over nothing.
 *
 * Days are buttons here, not links: on the tile a day is a shortcut to its
 * thread, but on a page you are browsing, and selecting should show you what
 * is on without navigating away from the month you are reading.
 */
export function CalendarPageView({
  initialEvents,
  initialDay,
  canEdit,
}: {
  initialEvents: OrgCalendarEvent[];
  /** Day key to open focused on — the tile links here with one for busy days. */
  initialDay?: string | null;
  canEdit: boolean;
}) {
  const [selected, setSelected] = React.useState<string | null>(
    initialDay ?? null
  );
  const [dayEvents, setDayEvents] = React.useState<
    Array<Occurrence<OrgCalendarEvent>>
  >([]);

  const initialMonth = React.useMemo(
    () => (initialDay ? monthOf(initialDay) : undefined),
    [initialDay]
  );

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_260px]">
      <CalendarGrid
        initialEvents={initialEvents}
        density="full"
        initialMonth={initialMonth}
        renderDay={({ date, key, occurrences, className, children }) => {
          const isSelected = key === selected;
          return (
            <button
              type="button"
              role="gridcell"
              aria-pressed={isSelected}
              aria-label={`${date.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })} — ${occurrences.length} event${occurrences.length === 1 ? "" : "s"}`}
              onClick={() => {
                setSelected(isSelected ? null : key);
                setDayEvents(isSelected ? [] : occurrences);
              }}
              className={cn(className, isSelected && "ring-1 ring-primary")}
            >
              {children}
            </button>
          );
        }}
      />

      <aside className="min-w-0">
        {selected ? (
          <>
            <h2 className="font-serif text-lg">{longDate(selected)}</h2>
            {dayEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing on this day.
              </p>
            ) : (
              <ul className="mt-3 space-y-4">
                {dayEvents.map(({ item, at }) => (
                  <li
                    key={`${item.id}-${at.toISOString()}`}
                    className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                  >
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {occurrenceSummary(item, at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.section && item.slug && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/${item.section}/${item.slug}`}>Details</Link>
                        </Button>
                      )}
                      {item.meetingUrl && (
                        <Button asChild variant="outline" size="sm">
                          <a href={item.meetingUrl} target="_blank" rel="noreferrer">
                            Join
                          </a>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a day to see what is on.
          </p>
        )}

        {canEdit && (
          <div className="mt-6 border-t border-border pt-4">
            <Button asChild size="sm">
              <Link href="/manage/content/new?kind=meeting">Add a gathering</Link>
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

/** The month a day key belongs to, parsed as local time. */
function monthOf(key: string): Date | undefined {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return undefined;
  return new Date(y, m - 1, 1);
}

function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
