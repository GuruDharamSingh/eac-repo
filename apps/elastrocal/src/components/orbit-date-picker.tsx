"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SIGNS, moonLongitude, sunLongitude } from "@elkdonis/astro";
import { cn } from "@/lib/utils";
import "./orbit-date-picker.css";

/**
 * The date, chosen by moving the Earth around the Sun.
 *
 * The dial is not decoration. Earth sits at its real heliocentric longitude
 * for the date (the Sun's apparent longitude plus 180°), the Moon sits at its
 * real geocentric longitude around Earth — so the phase you see is the phase
 * that night — and the twelve marks are the signs, which is what the Sun's
 * position through the year actually means on this site. Positions come from
 * @elkdonis/astro's drawing-grade series, accurate to a hundredth of a degree
 * for the Sun; the chart itself is still cast by Swiss Ephemeris server-side.
 *
 * Departures from the design this was modelled on, all deliberate:
 *
 *  · No GSAP. Draggable's inertia is a paid Club GreenSock plugin, and the
 *    whole interaction is a few dozen lines of Pointer Events — which also
 *    covers touch, pen and mouse with one code path.
 *  · Rotation means the position in the ORBIT, not an offset from today. The
 *    original mapped one turn onto "days from now", which cannot reach a
 *    birth date: you would spin fifty times to get to 1975. Here a turn is a
 *    year, dragging past New Year rolls into the next one, and the year has
 *    its own stepper for the long journey.
 *  · The field stays typeable, in ISO order. A dial is a lovely way to browse
 *    and a terrible way to enter a date you already know.
 *  · Keyboard and screen readers are first-class: the dial is a slider, with
 *    arrows for days, Page keys for months, Home/End for the year's ends.
 */

const MS_DAY = 86_400_000;
/** How far back the throw looks when measuring how fast the hand was moving. */
const VEL_WINDOW_MS = 70;
/** Mean degrees of orbit per day. Only used to convert a drag into days. */
const DEG_PER_DAY = 360 / 365.2422;

/** "YYYY-MM-DD" → an instant at noon UTC, which no time zone can shift off the day. */
function parseISO(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d, 12));
  // Rejects 2025-02-31 and friends, which Date would silently roll over.
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null;
  return at;
}

function toISO(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + Math.round(days) * MS_DAY);
}

function addMonths(at: Date, months: number): Date {
  const d = new Date(at);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp: 31 January plus a month is the end of February, not the 3rd of March.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

function setYear(at: Date, year: number): Date {
  const d = new Date(at);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(year);
  const last = new Date(Date.UTC(year, d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Shortest signed turn from a to b, degrees, in (-180, 180].
 * Going the short way is what stops a drag past 0° from spinning the date a
 * whole year backwards.
 */
function angleDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

export function OrbitDatePicker({
  id,
  value,
  onChange,
  required,
  minYear = 1800,
  maxYear = new Date().getUTCFullYear() + 5,
}: {
  id: string;
  /** ISO "YYYY-MM-DD", or "" while empty. */
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  minYear?: number;
  maxYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const wrap = useRef<HTMLDivElement>(null);
  const dial = useRef<HTMLDivElement>(null);
  const labelId = useId();

  // What the dial is showing. Falls back to today so an empty field still
  // opens onto something rather than a blank ring.
  const selected = useMemo(() => parseISO(value) ?? parseISO(toISO(new Date())) ?? new Date(), [value]);
  const [draft, setDraft] = useState<Date>(selected);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const commit = useCallback(
    (at: Date) => {
      const year = at.getUTCFullYear();
      if (year < minYear || year > maxYear) return;
      setDraft(at);
    },
    [minYear, maxYear],
  );

  // ── the drag ────────────────────────────────────────────────────────────
  // Pointer angle is tracked directly; the date moves by the angular delta
  // converted at the mean orbital rate. Earth is then redrawn from the true
  // solar longitude of the new date, so the mark stays astronomically right
  // even though the conversion is a mean.
  /**
   * The live drag. `trail` is the recent history of cumulative rotation —
   * velocity is measured across it rather than between two consecutive
   * events, because a browser is free to deliver several pointer moves in the
   * same millisecond. Dividing one of those deltas by a ~1ms gap yields a
   * velocity an order of magnitude too high, and a gentle nudge then throws
   * the date most of a year.
   */
  const drag = useRef<{
    last: number;
    moved: boolean;
    total: number;
    trail: Array<{ t: number; a: number }>;
  } | null>(null);
  const spin = useRef<number | null>(null);
  /**
   * Days of movement not yet spent. A date holds whole days, but a drag
   * arrives in fractions of one — rounding each move on its own loses about a
   * day per sixty degrees, so the remainder is carried to the next move.
   */
  const carry = useRef(0);

  /** Advance the draft by a fractional number of days, banking the remainder. */
  const nudge = useCallback(
    (days: number) => {
      const total = days + carry.current;
      const whole = Math.trunc(total);
      carry.current = total - whole;
      if (whole === 0) return;
      setDraft((cur) => {
        const next = addDays(cur, whole);
        const y = next.getUTCFullYear();
        return y < minYear || y > maxYear ? cur : next;
      });
    },
    [minYear, maxYear],
  );

  const angleAt = (e: { clientX: number; clientY: number }): number => {
    const el = dial.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    // Screen y grows downward; negate so the angle runs anticlockwise like
    // the ecliptic.
    return (Math.atan2(-dy, dx) * 180) / Math.PI;
  };

  const stopSpin = () => {
    if (spin.current !== null) cancelAnimationFrame(spin.current);
    spin.current = null;
  };

  useEffect(() => stopSpin, []);

  const onPointerDown = (e: React.PointerEvent) => {
    stopSpin();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    carry.current = 0;
    drag.current = { last: angleAt(e), moved: false, total: 0, trail: [{ t: performance.now(), a: 0 }] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = angleAt(e);
    const delta = angleDelta(d.last, now);
    if (Math.abs(delta) < 0.01) return;
    const t = performance.now();
    d.total += delta;
    d.trail.push({ t, a: d.total });
    // Only the last breath of movement decides the throw.
    while (d.trail.length > 2 && t - d.trail[0].t > VEL_WINDOW_MS) d.trail.shift();
    d.last = now;
    d.moved = true;
    nudge(delta / DEG_PER_DAY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (!d?.moved) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Average speed over the last stretch of movement. A pointer that came to
    // rest before lifting has nothing recent in the trail, so this falls to
    // zero on its own and no throw happens — stopping means stopping.
    const end = performance.now();
    const oldest = d.trail[0];
    const span = end - oldest.t;
    const v = span >= 12 && span <= VEL_WINDOW_MS * 2 ? (d.total - oldest.a) / span : 0;

    if (reduced || Math.abs(v) < 0.012) return;

    /*
      The glide.

      Not a per-frame decay. Multiplying the velocity every frame is the
      obvious model and it feels wrong at both ends: it leaves a long tail of
      sub-pixel movement that reads as the dial refusing to settle, and where
      it comes to rest depends on frame timing, so the same flick lands
      somewhere different each time.

      Instead the resting point is decided at the moment of release — throw
      distance is velocity times a time constant, the way a scroll view
      projects a fling — and the dial eases there. That gives it weight: a
      hard flick travels far and slows visibly, a light one drifts a few days
      and stops, and both settle exactly where they said they would.
    */
    const GLIDE_MS = 420; // time constant: how much "mass" the dial carries
    const MAX_TURN = 300; // no single flick throws more than ten months
    const travel = Math.max(-MAX_TURN, Math.min(MAX_TURN, v * GLIDE_MS));
    // How long it takes to cover that distance. The distance is right; the
    // first pass covered it in half this time and read as a whip rather than
    // something with weight, so the same throw now takes longer to die away.
    const duration = Math.min(2400, Math.max(420, Math.abs(travel) * 13));

    const start = performance.now();
    let done = 0; // degrees already handed to the date
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / duration);
      // easeOutQuint — takes the speed off the finger cleanly, then a long
      // tail where the last few days tick past slowly enough to read.
      const eased = 1 - Math.pow(1 - p, 5);
      const target = travel * eased;
      nudge((target - done) / DEG_PER_DAY);
      done = target;
      if (p < 1) {
        spin.current = requestAnimationFrame(step);
        return;
      }
      spin.current = null;
    };
    spin.current = requestAnimationFrame(step);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = e.shiftKey;
    const map: Record<string, () => Date> = {
      ArrowRight: () => addDays(draft, big ? 7 : 1),
      ArrowUp: () => addDays(draft, big ? 7 : 1),
      ArrowLeft: () => addDays(draft, big ? -7 : -1),
      ArrowDown: () => addDays(draft, big ? -7 : -1),
      PageUp: () => addMonths(draft, 1),
      PageDown: () => addMonths(draft, -1),
      Home: () => new Date(Date.UTC(draft.getUTCFullYear(), 0, 1, 12)),
      End: () => new Date(Date.UTC(draft.getUTCFullYear(), 11, 31, 12)),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    stopSpin();
    carry.current = 0;
    commit(fn());
  };

  // ── geometry ────────────────────────────────────────────────────────────
  const sunLon = sunLongitude(draft);
  const moonLon = moonLongitude(draft);
  const earthLon = (sunLon + 180) % 360; // heliocentric longitude of the Earth
  const sign = SIGNS[Math.floor(sunLon / 30) % 12];

  const C = 100;
  const R_ORBIT = 72;
  const pt = (lon: number, r: number): [number, number] => [
    C + r * Math.cos((lon * Math.PI) / 180),
    C - r * Math.sin((lon * Math.PI) / 180),
  ];
  const [ex, ey] = pt(earthLon, R_ORBIT);
  // The Moon's direction from Earth is its geocentric longitude, so at new
  // moon it sits between Earth and the Sun and at full moon behind Earth —
  // the drawing shows the real phase without being told what the phase is.
  const [mx, my] = [ex + 15 * Math.cos((moonLon * Math.PI) / 180), ey - 15 * Math.sin((moonLon * Math.PI) / 180)];

  const close = (apply: boolean) => {
    if (apply) {
      onChange(toISO(draft));
      setText(toISO(draft));
    }
    setOpen(false);
    stopSpin();
  };

  // Dismiss on outside click and Escape, like every other menu on the site.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="odp" ref={wrap}>
      <div className="odp-field">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="YYYY-MM-DD"
          required={required}
          value={text}
          aria-describedby={`${labelId}-hint`}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseISO(e.target.value);
            if (parsed) onChange(toISO(parsed));
          }}
          onBlur={() => {
            // A half-typed date reverts rather than silently staying wrong.
            if (!parseISO(text)) setText(value);
          }}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-card px-3 pr-10 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            text && !parseISO(text) && "border-destructive",
          )}
        />
        <button
          type="button"
          className="odp-open"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={open ? "Close the orbit picker" : "Pick the date on the orbit"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="10" cy="10" r="3.1" />
            <ellipse cx="10" cy="10" rx="8.6" ry="4.2" transform="rotate(-22 10 10)" />
            <circle cx="17.1" cy="7" r="1.4" className="odp-open-dot" />
          </svg>
        </button>
      </div>
      <p id={`${labelId}-hint`} className="sr-only">
        Type the date as four-digit year, month, day. Or open the orbit picker and drag the Earth around the
        Sun — dragging further from the centre gives finer control, and there are buttons for stepping a
        single day.
      </p>

      {open && (
        <div className="odp-pop" role="dialog" aria-label="Pick a date">
          <div className="odp-year">
            <button type="button" onClick={() => commit(setYear(draft, draft.getUTCFullYear() - 1))} aria-label="Previous year">
              ‹
            </button>
            <input
              type="number"
              className="odp-year-input"
              value={draft.getUTCFullYear()}
              min={minYear}
              max={maxYear}
              aria-label="Year"
              onChange={(e) => {
                const y = Number(e.target.value);
                if (y >= minYear && y <= maxYear) commit(setYear(draft, y));
              }}
            />
            <button type="button" onClick={() => commit(setYear(draft, draft.getUTCFullYear() + 1))} aria-label="Next year">
              ›
            </button>
          </div>

          <div
            className="odp-dial"
            ref={dial}
            role="slider"
            tabIndex={0}
            aria-valuemin={1}
            aria-valuemax={366}
            aria-valuenow={
              Math.floor(
                (draft.getTime() - Date.UTC(draft.getUTCFullYear(), 0, 1, 12)) / MS_DAY,
              ) + 1
            }
            aria-valuetext={LONG_DATE.format(draft)}
            aria-label="Day of the year — drag the Earth, or use the arrow keys"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            <svg viewBox="0 0 200 200" aria-hidden>
              {/* the signs the Sun passes through */}
              <circle className="odp-zodiac" cx={C} cy={C} r={R_ORBIT + 14} />
              {SIGNS.map((s, i) => {
                const [x1, y1] = pt(i * 30, R_ORBIT + 9);
                const [x2, y2] = pt(i * 30, R_ORBIT + 14);
                return <line key={s.key} className="odp-tick" x1={x1} y1={y1} x2={x2} y2={y2} />;
              })}
              <circle className="odp-orbit" cx={C} cy={C} r={R_ORBIT} />

              {/* the Sun */}
              <g className="odp-sun">
                <circle className="odp-flare odp-flare-1" cx={C} cy={C} r={14} />
                <circle className="odp-flare odp-flare-2" cx={C} cy={C} r={14} />
                <circle className="odp-flare odp-flare-3" cx={C} cy={C} r={14} />
                <circle className="odp-sun-disc" cx={C} cy={C} r={13} />
              </g>

              {/* the Earth, with the Moon where it truly is */}
              <g className="odp-earth-group" style={{ transform: `translate(${ex - C}px, ${ey - C}px)` }}>
                <circle className="odp-moon-path" cx={C} cy={C} r={15} />
              </g>
              <circle className="odp-moon" cx={mx} cy={my} r={3.4} />
              <circle className="odp-earth-halo" cx={ex} cy={ey} r={11} />
              <circle className="odp-earth" cx={ex} cy={ey} r={6.5} />
            </svg>
          </div>

          {/* A day is about a degree and a half of this dial — under two
              pixels of arc — so the ring alone cannot reliably land on the
              14th rather than the 15th. These step one day at a time. (The
              other fine control is physical: drag further out from the
              centre and the same movement of the hand turns fewer degrees.) */}
          <div className="odp-readout">
            <div className="odp-day">
              <button
                type="button"
                onClick={() => {
                  stopSpin();
                  carry.current = 0;
                  commit(addDays(draft, -1));
                }}
                aria-label="Previous day"
              >
                ‹
              </button>
              <strong>{LONG_DATE.format(draft)}</strong>
              <button
                type="button"
                onClick={() => {
                  stopSpin();
                  carry.current = 0;
                  commit(addDays(draft, 1));
                }}
                aria-label="Next day"
              >
                ›
              </button>
            </div>
            <span>
              Sun in {sign.name} · {toISO(draft)}
            </span>
          </div>

          <div className="odp-actions">
            <button type="button" className="odp-btn odp-btn-quiet" onClick={() => close(false)}>
              Cancel
            </button>
            <button type="button" className="odp-btn odp-btn-primary" onClick={() => close(true)}>
              Use this date
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
