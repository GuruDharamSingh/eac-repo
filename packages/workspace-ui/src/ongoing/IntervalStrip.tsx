"use client";

import { intervalsAround } from "../store";
import type { Ongoing } from "../types";
import { fmtKey } from "./util";
import "./ongoing.css";

/** The strip along the header: the current interval in the middle. It scrolls sideways on a phone. */
export function IntervalStrip({ ongoing, now, selectedKey, canOpenFuture, onPick }: {
  ongoing: Ongoing; now: string; selectedKey: string; canOpenFuture: boolean; onPick: (key: string | null) => void;
}) {
  const items = intervalsAround(ongoing, now);
  const current = items.find((i) => i.state === "current");
  const unit = ongoing.every === "week" ? "weeks" : "days";
  return (
    <div className="ws-ong-stripwrap">
      <nav className="ws-ong-strip" aria-label={`Intervals: ${items.length} ${unit}`}>
        <ul className="ws-ong-stripl">
          {items.map((it) => {
            const locked = it.state === "future" && !canOpenFuture;
            const on = it.key === selectedKey;
            const planned = (ongoing.plans.find((p) => p.key === it.key)?.materials.length ?? 0) > 0;
            const stateWord = it.state === "current" ? (ongoing.every === "week" ? "this week" : "today") : it.state === "past" ? "past" : locked ? "locked" : "coming up";
            const label = `${fmtKey(it.key, ongoing.every)}, ${stateWord}${on ? ", selected" : ""}${planned && canOpenFuture ? ", material planned" : ""}`;
            return (
              <li key={it.key}>
                <button
                  type="button"
                  className={`ws-ong-iv is-${it.state}${on ? " is-on" : ""}${locked ? " is-locked" : ""}`}
                  aria-current={on ? "true" : undefined}
                  aria-label={label}
                  disabled={locked}
                  onClick={() => onPick(it.state === "current" ? null : it.key)}
                >
                  {fmtKey(it.key, ongoing.every)}
                  {locked ? (
                    <svg className="ws-ong-lock" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><rect x="2" y="5.5" width="8" height="5.5" rx="1" fill="currentColor" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                  ) : null}
                  {planned && canOpenFuture ? <span className="ws-ong-dot" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <button type="button" className="ws-ong-today" disabled={!current || current.key === selectedKey} onClick={() => onPick(null)}>Today</button>
    </div>
  );
}
