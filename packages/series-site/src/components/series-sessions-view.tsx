"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Every series' coming sessions on /series, as a list (the default, larger
 * type) or a month calendar (2026-10-18; developer: "the option to go
 * between the calendar view and the by-row view"). Phones always get the
 * list: series-index.css hides the calendar and the switch below 760px.
 * The choice is remembered in this browser only.
 */
export interface CalendarItem {
  key: string;
  /** "YYYY-MM-DD" in the series' own zone. */
  day: string;
  title: string;
  time: string;
  href: string;
  seriesName: string;
  accent: { mark: string; text: string };
  hostName: string | null;
}

type View = "list" | "calendar";
const STORE = "eac:series-view";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SeriesSessionsView({ list, items, today }: { list: ReactNode; items: CalendarItem[]; today: string }) {
  const [view, setView] = useState<View>("list");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORE) === "calendar") setView("calendar");
    } catch {
      /* storage unavailable: the list stays */
    }
  }, []);
  function choose(v: View) {
    setView(v);
    try {
      window.localStorage.setItem(STORE, v);
    } catch {
      /* not remembered */
    }
  }

  return (
    <>
      <div className="isx-switch" role="group" aria-label="Show sessions as">
        <button type="button" className={`ifs-btn ifs-btn--small${view === "list" ? " is-on" : ""}`} aria-pressed={view === "list"} onClick={() => choose("list")}>
          List
        </button>
        <button type="button" className={`ifs-btn ifs-btn--small${view === "calendar" ? " is-on" : ""}`} aria-pressed={view === "calendar"} onClick={() => choose("calendar")}>
          Calendar
        </button>
      </div>
      <div className={`isx-view isx-view--${view}`}>
        <div className="isx-view__list">{list}</div>
        {view === "calendar" && <Calendar items={items} today={today} />}
      </div>
    </>
  );
}

/** Weeks from this week to the last session's week, Sunday first. */
function Calendar({ items, today }: { items: CalendarItem[]; today: string }) {
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  const first = parse(today);
  const lastKey = items.reduce((m, it) => (it.day > m ? it.day : m), today);
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const lastDay = parse(lastKey);
  const end = new Date(lastDay.getTime() + (6 - lastDay.getUTCDay()) * 86_400_000);
  const weeks: Date[][] = [];
  for (let d = start; d <= end && weeks.length < 16; ) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(d);
      d = new Date(d.getTime() + 86_400_000);
    }
    weeks.push(week);
  }
  const months = Array.from(new Set(weeks.flat().map((d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`)));
  const legend = Array.from(new Map(items.map((i) => [i.seriesName, i.accent])).entries());

  return (
    <div className="isx-cal" aria-label="Calendar of sessions">
      <div className="isx-cal__head">
        <h3>{months.length > 1 ? `${months[0]} – ${months[months.length - 1]}` : months[0]}</h3>
        <p className="isx-cal__legend">
          {legend.map(([name, a]) => (
            <span key={name}>
              <i style={{ background: a.mark }} aria-hidden="true" />
              {name}
            </span>
          ))}
        </p>
      </div>
      <div className="isx-cal__dow" aria-hidden="true">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div className="isx-cal__week" key={keyOf(week[0])}>
          {week.map((d) => {
            const k = keyOf(d);
            const evs = byDay.get(k) ?? [];
            const label = d.getUTCDate() === 1 || k === keyOf(weeks[0][0]) ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}` : String(d.getUTCDate());
            return (
              <div key={k} className={`isx-cal__day${k === today ? " is-today" : ""}${k < today ? " is-past" : ""}`}>
                <span className="isx-cal__n">{label}</span>
                {evs.map((e) => (
                  <a
                    key={e.key}
                    className="isx-cal__ev"
                    href={e.href}
                    style={{ "--acc": e.accent.mark } as CSSProperties}
                    aria-label={`${e.seriesName}: ${e.title}, ${e.time}`}
                  >
                    <b>{e.title}</b>
                    <span>
                      {e.time}
                      {e.hostName ? ` · ${e.hostName}` : ""}
                    </span>
                  </a>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
