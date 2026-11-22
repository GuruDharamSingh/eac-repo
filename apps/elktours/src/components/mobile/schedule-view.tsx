"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import "@/blocks/mobile/flow.css";
import "./board.css";
import { Chip, ChipRow } from "@/components/mobile";
import type { BoardSlot } from "@/lib/tour-slots";
import { BoardTabBar } from "./board-nav";
import { BoardWho, DecideBanner, SlotCard, dayKey, dayLong } from "./board-ui";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface ScheduleGuide {
  id: string;
  name: string;
  short: string;
}

export interface ScheduleViewProps {
  name: string;
  sub: string;
  monday: string;
  /** Seven Paris dates, Monday to Sunday. */
  days: string[];
  today: string;
  weekLabel: string;
  prevWeek: string;
  nextWeek: string;
  slots: BoardSlot[];
  /** Owner only: filter chips and a guide initial on each card. */
  guides: ScheduleGuide[] | null;
  below: number;
}

/** Screen 31, Schedule: week strip, day filter, guide filter (office), slot cards grouped by day. */
export function ScheduleView({ name, sub, days, today, weekLabel, prevWeek, nextWeek, slots, guides, below }: ScheduleViewProps) {
  const [day, setDay] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);

  const sorted = useMemo(() => [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [slots]);
  const byGuide = useMemo(() => sorted.filter((s) => !guide || s.guide?.id === guide), [sorted, guide]);
  const dots = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of byGuide) if (s.status === "scheduled") m.set(dayKey(s.startsAt), (m.get(dayKey(s.startsAt)) ?? 0) + 1);
    return m;
  }, [byGuide]);
  const shown = day ? byGuide.filter((s) => dayKey(s.startsAt) === day) : byGuide;
  const groups = useMemo(() => {
    const m = new Map<string, BoardSlot[]>();
    for (const s of shown) m.set(dayKey(s.startsAt), [...(m.get(dayKey(s.startsAt)) ?? []), s]);
    return [...m.entries()];
  }, [shown]);

  return (
    <>
      <div className="b-page">
        <BoardWho name={name} sub={sub} />
        <div className="b-week-head">
          <div className="b-head" style={{ margin: 0 }}>
            <span className="m-kicker">{weekLabel}</span>
            <h1 className="b-title">Schedule</h1>
          </div>
          <div className="b-week-nav">
            <Link href={`/manage/schedule?week=${prevWeek}`} aria-label="Previous week">‹</Link>
            <Link href={`/manage/schedule?week=${nextWeek}`} aria-label="Next week">›</Link>
          </div>
        </div>

        <div className="b-strip" role="group" aria-label="Days of the week">
          {days.map((d, i) => {
            const n = dots.get(d) ?? 0;
            const picked = day === d;
            return (
              <button
                key={d}
                type="button"
                className={`b-day${picked ? " is-picked" : ""}${d === today ? " is-today" : ""}`}
                aria-pressed={picked}
                onClick={() => setDay(picked ? null : d)}
              >
                <span className="b-day-wd">{WD[i]}</span>
                <span className="b-day-num">{Number(d.slice(8))}</span>
                <span className="b-day-dots" aria-label={n ? `${n} slot${n === 1 ? "" : "s"}` : undefined}>{n ? "•".repeat(Math.min(n, 3)) : ""}</span>
              </button>
            );
          })}
        </div>

        {guides && guides.length > 0 ? (
          <div style={{ paddingTop: 14 }}>
            <ChipRow>
              <Chip selected={guide === null} onClick={() => setGuide(null)}>Everyone</Chip>
              {guides.map((g) => (
                <Chip key={g.id} selected={guide === g.id} onClick={() => setGuide(guide === g.id ? null : g.id)}>
                  {g.short}
                </Chip>
              ))}
            </ChipRow>
          </div>
        ) : null}

        <DecideBanner count={below} />

        <div className="b-list">
          {groups.map(([key, items]) => (
            <section key={key}>
              <div className="b-group">
                <span className="b-group-label">{dayLong(key)}</span>
                <span className="b-group-rule" />
                <span className="b-group-count">{items.length}</span>
              </div>
              <div className="b-cards">
                {items.map((s) => (
                  <SlotCard key={s.slotId} slot={s} showGuide={Boolean(guides)} />
                ))}
              </div>
            </section>
          ))}
          {groups.length === 0 ? (
            <p className="b-empty">
              {day || guide ? "Nothing scheduled for that choice." : "Nothing scheduled this week yet."} Tap the brass + to add slots, or{" "}
              <Link href="/manage/schedule/new">open New slots</Link>.
            </p>
          ) : null}
        </div>
      </div>
      <BoardTabBar count={below} />
    </>
  );
}
