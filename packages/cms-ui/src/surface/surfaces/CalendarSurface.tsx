"use client";

import * as React from "react";
import {
  addMonths,
  dayKey,
  monthGrid,
  occurrencesByDay,
  startOfMonth,
  type Occurrence,
} from "@elkdonis/utils";
import type { SurfaceAction, SurfaceDescriptor, SurfaceEvent } from "../types";
import { useLayer, useSurface } from "../context";
import { kindMeta } from "../kinds";
import { SurfaceFrame } from "../SurfaceShell";
import { fmtDate, fmtDuration, fmtFormat, fmtMonth, fmtShortDate, fmtTime, type FormatOptions } from "../format";

// ============================================================================
// The org's month, expanded.
//
// Grid on the left, one day on the right. A day with something on it lists
// it; each entry opens its thread ON TOP of the calendar, so ‹ back returns
// to the same month with the same day selected. An empty day, for someone who
// can compose, offers "+ Add" — which opens the quick form already dated.
// That is the whole reason this surface exists: the calendar is where you
// find out you need an event, so it should be where you make one.
//
// Occurrence expansion and the grid cells come from @elkdonis/utils, shared
// with every app's own calendar. Only the markup lives here.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "calendar" }>;

function monthOf(key: string | undefined): Date | null {
  if (!key) return null;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CalendarSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, push } = useSurface();
  const layer = useLayer();
  const fmt: FormatOptions = { timeZone: connectors.timeZone, locale: connectors.locale };
  const today = React.useMemo(() => new Date(), []);

  const [cursor, setCursor] = React.useState<Date>(
    () => monthOf(descriptor.month ?? descriptor.day?.slice(0, 7)) ?? startOfMonth(today)
  );
  const [events, setEvents] = React.useState<SurfaceEvent[]>(descriptor.events ?? []);
  const loaded = React.useRef<Set<string>>(new Set(descriptor.events ? [monthKey(cursor)] : []));
  const [selected, setSelected] = React.useState<string | null>(descriptor.day ?? null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    layer.setMeta({ title: fmtMonth(cursor, fmt), kind: "calendar", size: "wide" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, layer]);

  // Fetch a month once. Recurring series that started earlier are returned by
  // the host for any month they could still be running in, so merging by id
  // keeps one row per series rather than one per month it was seen in.
  React.useEffect(() => {
    const key = monthKey(cursor);
    if (loaded.current.has(key) || !connectors.listEvents) return;
    let cancelled = false;
    setBusy(true);
    connectors
      .listEvents(cursor, addMonths(cursor, 1))
      .then((rows) => {
        if (cancelled) return;
        loaded.current.add(key);
        setEvents((prev) => {
          const byId = new Map(prev.map((e) => [e.id, e]));
          for (const row of rows) byId.set(row.id, row);
          return [...byId.values()];
        });
      })
      .catch(() => {
        // Keep whatever is on screen. A stale month beats an empty one.
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cursor, connectors]);

  const byDay = React.useMemo(
    () => occurrencesByDay(events, cursor, addMonths(cursor, 1)),
    [events, cursor]
  );

  const selectedOccurrences = selected ? byDay.get(selected) ?? [] : [];

  // The next few things, when no day is chosen: from today forward, this
  // month and the next.
  const upcoming = React.useMemo(() => {
    const from = new Date();
    const to = addMonths(startOfMonth(from), 2);
    return [...occurrencesByDay(events, from, to).values()].flat().slice(0, 6);
  }, [events]);

  // What "add" makes: a meeting where the org holds meetings, otherwise an event.
  const addKind = connectors.compose?.hasMeetings ? "meeting" : "event";
  const canAdd = connectors.viewer.canCompose && Boolean(connectors.saveThread) && connectors.compose?.canPublishContent !== false;

  function openThread(o: Occurrence<SurfaceEvent>) {
    push({
      type: "thread",
      id: o.item.id,
      preview: {
        title: o.item.title,
        kind: o.item.kind,
        scheduledAt: o.at.toISOString(),
        coverImageUrl: o.item.coverImageUrl,
      },
    });
  }

  function addOn(day: string | null) {
    const at = day ? `${day}T10:00` : "";
    push({
      type: "compose",
      kind: addKind,
      tier: "quick",
      prefill: at ? { scheduled_at: at } : undefined,
    });
  }

  const actions: SurfaceAction[] = [
    {
      label: "Today",
      quiet: true,
      onClick: () => {
        setCursor(startOfMonth(today));
        setSelected(dayKey(today));
      },
    },
  ];
  if (canAdd) {
    actions.push({
      label: selected ? `Add on ${fmtShortDate(new Date(`${selected}T12:00`), fmt)}` : "Add something",
      primary: true,
      onClick: () => addOn(selected),
    });
  }

  const rail = (
    <>
      {selected ? (
        <>
          <h3 className="eac-cal-rail-date">{fmtDate(new Date(`${selected}T12:00`), fmt)}</h3>
          {selectedOccurrences.length === 0 ? (
            <p className="eac-surface-muted">Nothing on this day.</p>
          ) : (
            <OccurrenceList items={selectedOccurrences} onOpen={openThread} fmt={fmt} />
          )}
        </>
      ) : (
        <>
          <h3 className="eac-cal-rail-date">Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="eac-surface-muted">Nothing scheduled yet.</p>
          ) : (
            <OccurrenceList items={upcoming} onOpen={openThread} fmt={fmt} showDate />
          )}
        </>
      )}
    </>
  );

  return (
    <SurfaceFrame
      kind="calendar"
      title={fmtMonth(cursor, fmt)}
      kicker={connectors.orgName ? `Calendar · ${connectors.orgName}` : "Calendar"}
      rail={rail}
      actions={actions}
      status={busy ? "Loading…" : selected ? `${selectedOccurrences.length} on this day` : `${byDay.size} days with something on`}
    >
      <MonthGrid
        cursor={cursor}
        byDay={byDay}
        selected={selected}
        today={today}
        busy={busy}
        // The masthead already names the month; the grid keeps only the arrows.
        headless
        onSelect={(key) => setSelected(key === selected ? null : key)}
        onPrev={() => setCursor(addMonths(cursor, -1))}
        onNext={() => setCursor(addMonths(cursor, 1))}
        fmt={fmt}
      />
    </SurfaceFrame>
  );
}

function OccurrenceList({
  items,
  onOpen,
  fmt,
  showDate,
}: {
  items: Array<Occurrence<SurfaceEvent>>;
  onOpen: (o: Occurrence<SurfaceEvent>) => void;
  fmt: FormatOptions;
  showDate?: boolean;
}) {
  return (
    <ul className="eac-occ-list">
      {items.map((o) => (
        <li key={`${o.item.id}-${o.at.toISOString()}`}>
          <button type="button" className="eac-occ" data-kind={o.item.kind} onClick={() => onOpen(o)}>
            <span className="eac-occ-glyph" aria-hidden>
              {kindMeta(o.item.kind).glyph}
            </span>
            <span>
              <span className="eac-occ-title">{o.item.title}</span>
              <span className="eac-occ-meta">
                {[
                  showDate && fmtShortDate(o.at, fmt),
                  fmtTime(o.at, fmt),
                  fmtDuration(o.item.durationMinutes),
                  fmtFormat(o.item.format),
                  o.item.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── the grid, on its own ───────────────────────────────────────────────────

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface MonthGridProps {
  cursor: Date;
  byDay: Map<string, Array<Occurrence<SurfaceEvent>>>;
  selected?: string | null;
  today?: Date;
  busy?: boolean;
  /** "compact" draws dots in 26px rows — the face. "full" draws titles. */
  density?: "compact" | "full";
  onSelect?: (key: string, occurrences: Array<Occurrence<SurfaceEvent>>) => void;
  onPrev?: () => void;
  onNext?: () => void;
  fmt?: FormatOptions;
  /** Hide the month name — the masthead or the face already carries it. The
   *  arrows still render when handlers are given. */
  headless?: boolean;
}

/**
 * A month, in plain CSS. Used by the calendar surface at full density and
 * offered to hosts at compact density for a face's preview, so the tile and
 * the popup are visibly the same calendar.
 */
export function MonthGrid({
  cursor,
  byDay,
  selected,
  today = new Date(),
  busy,
  density = "full",
  onSelect,
  onPrev,
  onNext,
  fmt = {},
  headless,
}: MonthGridProps) {
  const compact = density === "compact";
  const cells = React.useMemo(() => monthGrid(cursor), [cursor]);
  const todayKey = dayKey(today);

  return (
    <div className={`eac-cal${compact ? " eac-cal--compact" : ""}`}>
      {(!headless || onPrev || onNext) && (
        <div className="eac-cal-head">
          {headless ? (
            <span />
          ) : (
            <h3 aria-live="polite">
              {compact
                ? cursor.toLocaleDateString(fmt.locale, { month: "short", year: "numeric" })
                : fmtMonth(cursor, fmt)}
            </h3>
          )}
          {(onPrev || onNext) && (
            <div className="eac-cal-nav">
              <button type="button" className="eac-surface-iconbtn" onClick={onPrev} aria-label="Previous month" disabled={!onPrev}>
                ←
              </button>
              <button type="button" className="eac-surface-iconbtn" onClick={onNext} aria-label="Next month" disabled={!onNext}>
                →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="eac-cal-grid" role="grid" aria-busy={busy || undefined} aria-label="Month">
        {WEEKDAYS.map((d) => (
          <div key={d} className="eac-cal-weekday" role="columnheader">
            {compact ? d.charAt(0) : d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="eac-cal-day is-pad" aria-hidden />;
          const key = dayKey(date);
          const occurrences = byDay.get(key) ?? [];
          const cls = [
            "eac-cal-day",
            occurrences.length ? "has-events" : "is-empty",
            key === todayKey && "is-today",
            key === selected && "is-selected",
            date < today && key !== todayKey && "is-past",
          ]
            .filter(Boolean)
            .join(" ");
          const label = `${date.toLocaleDateString(fmt.locale, { month: "long", day: "numeric" })} — ${
            occurrences.length
          } ${occurrences.length === 1 ? "event" : "events"}`;

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={cls}
              aria-label={label}
              aria-pressed={key === selected || undefined}
              onClick={() => onSelect?.(key, occurrences)}
            >
              <span className="eac-cal-num">{date.getDate()}</span>
              {compact ? (
                <span className="eac-cal-dots" aria-hidden>
                  {occurrences.slice(0, 3).map((o) => (
                    <i key={`${o.item.id}-${o.at.toISOString()}`} />
                  ))}
                </span>
              ) : (
                <>
                  {occurrences.slice(0, 2).map((o) => (
                    <span
                      key={`${o.item.id}-${o.at.toISOString()}`}
                      className="eac-cal-pip"
                      data-kind={o.item.kind}
                      title={o.item.title}
                    >
                      {o.item.title}
                    </span>
                  ))}
                  {occurrences.length > 2 && <span className="eac-cal-more">+{occurrences.length - 2}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
