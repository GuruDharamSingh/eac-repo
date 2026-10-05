"use client";

import * as React from "react";

// ============================================================================
// Up to three start times, typed in the proposer's own time zone.
//
// `<input type="datetime-local">` has no zone; the browser's zone is the one
// the person means, so values are converted to ISO instants here, before they
// reach a server whose zone is UTC. `onChange` gives the ISO list (empty slots
// dropped) and the zone name, which the booking keeps so emails can show the
// buyer's wall-clock.
// ============================================================================

export interface ProposedTimesValue {
  /** ISO instants, empty slots dropped. */
  times: string[];
  /** The proposer's IANA zone, e.g. "America/Toronto". */
  timeZone: string;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  } catch {
    return "America/Toronto";
  }
}

/** "YYYY-MM-DDTHH:mm" for the local wall-clock of a Date, as datetime-local wants. */
function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ProposeTimes({
  onChange,
  slots = 3,
  label = "When suits you?",
  hint,
  idPrefix = "eac-propose",
}: {
  onChange: (value: ProposedTimesValue) => void;
  slots?: number;
  label?: string;
  hint?: string;
  idPrefix?: string;
}) {
  const [values, setValues] = React.useState<string[]>(() => Array.from({ length: slots }, () => ""));
  const [zone, setZone] = React.useState("America/Toronto");
  // The zone is read after mount: the server render has no browser to ask.
  React.useEffect(() => setZone(browserTimeZone()), []);
  const min = React.useMemo(() => localInput(new Date(Date.now() + 60 * 60 * 1000)), []);

  React.useEffect(() => {
    const times = values
      .filter(Boolean)
      .map((v) => new Date(v))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => d.toISOString());
    onChange({ times, timeZone: zone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, zone]);

  return (
    <fieldset className="eac-booking-times">
      <legend className="eac-booking-label">{label}</legend>
      {values.map((v, i) => (
        <label key={i} className="eac-booking-time" htmlFor={`${idPrefix}-${i}`}>
          <span className="eac-booking-time-n">{i === 0 ? "First choice" : "Or"}</span>
          <input
            id={`${idPrefix}-${i}`}
            className="eac-booking-input"
            type="datetime-local"
            min={min}
            step={900}
            value={v}
            required={i === 0}
            onChange={(e) => setValues((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
      <span className="eac-booking-hint">
        {hint ?? "Times are in your time zone"} ({zone}).
      </span>
    </fieldset>
  );
}
