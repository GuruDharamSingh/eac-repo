import type { ReactNode } from "react";
import { cx } from "./cx";
import { roman } from "./roman";

export interface TimelineStop {
  name: string;
  /** Small kicker under an open stop, e.g. "10:15 · 20 min". */
  when?: string;
  note?: ReactNode;
  /** The stop the map is showing now. */
  here?: boolean;
  /** Extra content shown when open (a still, a link). */
  extra?: ReactNode;
  /** A small picture (76 x 56) beside the name while the stop is closed. */
  thumb?: ReactNode;
}

export interface StopTimelineProps {
  stops: TimelineStop[];
  /** Index of the open stop, or null. */
  openIndex: number | null;
  onToggle: (index: number) => void;
  hereLabel?: string;
}

/** Stops with Roman numerals on a brass thread. Tap a name to expand inline. */
export function StopTimeline({ stops, openIndex, onToggle, hereLabel = "On the map above" }: StopTimelineProps) {
  return (
    <ol className="m-stops">
      {stops.map((s, i) => {
        const open = openIndex === i;
        return (
          <li key={i} className="m-stop">
            <div className="m-stop-rail">
              <span className="m-stop-num">{roman(i + 1)}</span>
              {i < stops.length - 1 ? <span className="m-stop-line" aria-hidden="true" /> : null}
            </div>
            <div className="m-stop-main">
            <div className="m-stop-body">
              <button type="button" className="m-stop-name" aria-expanded={open} onClick={() => onToggle(i)}>
                {s.name}
              </button>
              {s.here ? <span className="m-kicker m-stop-here">{hereLabel}</span> : null}
              {open ? (
                <div className={cx("m-stop-open", "m-fade")}>
                  {s.when ? <span className="m-kicker m-stop-when">{s.when}</span> : null}
                  {s.note ? <p className="m-stop-note">{s.note}</p> : null}
                  {s.extra}
                </div>
              ) : null}
            </div>
            {s.thumb && !open ? (
              <span className="m-stop-thumb" onClick={() => onToggle(i)}>{s.thumb}</span>
            ) : null}
            <button type="button" className="m-stop-ring" tabIndex={-1} aria-hidden="true" onClick={() => onToggle(i)}>{open ? "−" : "+"}</button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
