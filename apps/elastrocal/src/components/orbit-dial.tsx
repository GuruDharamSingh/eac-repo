"use client";

import { useCallback, useEffect, useRef } from "react";
import { SIGNS, moonLongitude, sunLongitude } from "@elkdonis/astro";
import "./orbit-date-picker.css";

/**
 * The date as a place in the Earth's orbit — the dial on its own, controlled.
 *
 * Split out of OrbitDatePicker so the same instrument can be a popover on the
 * calculator and sit open on the home page beside a live chart. Everything
 * about how it feels lives here: the drag, the glide, the fine controls.
 *
 * The drawing is true rather than decorative. Earth sits at its real
 * heliocentric longitude for the date (the Sun's apparent longitude plus
 * 180°), the Moon at its real geocentric longitude around Earth — so at new
 * moon it lies between Earth and the Sun and at full moon behind it — and the
 * twelve marks are the signs. Positions come from @elkdonis/astro's
 * drawing-grade series; a chart is still cast by Swiss Ephemeris server-side.
 */

const MS_DAY = 86_400_000;
/** Mean degrees of orbit per day. Only used to convert a drag into days. */
const DEG_PER_DAY = 360 / 365.2422;
/** How far back the throw looks when measuring how fast the hand was moving. */
const VEL_WINDOW_MS = 70;

/** "YYYY-MM-DD" → an instant at noon UTC, which no time zone can shift off the day. */
export function parseISO(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d, 12));
  // Rejects 2025-02-31 and friends, which Date would silently roll over.
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null;
  return at;
}

export function toISO(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + Math.round(days) * MS_DAY);
}

export function addMonths(at: Date, months: number): Date {
  const d = new Date(at);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp: 31 January plus a month is the end of February, not the 3rd of March.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function setYear(at: Date, year: number): Date {
  const d = new Date(at);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(year);
  const last = new Date(Date.UTC(year, d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "Sun 13 September 2026".
 *
 * Spelled out by hand rather than through Intl, because the dial is rendered
 * on the server and hydrated in the browser and the two disagree: Node's ICU
 * gives "Sun, 13 September 2026" and Chrome's gives it without the comma,
 * which React reports as a hydration mismatch and re-renders the whole tree
 * over. Fixed names in UTC say the same thing in both places.
 */
export function formatLongDate(at: Date): string {
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

/**
 * Shortest signed turn from a to b, degrees, in (-180, 180].
 * Going the short way is what stops a drag past 0° from spinning the date a
 * whole year backwards.
 */
function angleDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

export function OrbitDial({
  value,
  onChange,
  minYear = 1800,
  maxYear = new Date().getUTCFullYear() + 5,
  className,
}: {
  value: Date;
  onChange: (next: Date) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
}) {
  /*
    The live value, held in a ref as well as in props.

    A drag produces many deltas per frame and each is relative to the one
    before it. Reading `value` would read whatever React last rendered, which
    during a fast throw is several frames behind, and the date would crawl
    while the finger flew. The ref is updated synchronously as each delta is
    applied, so movement is always measured from where the dial actually is.
  */
  const cur = useRef(value);
  useEffect(() => {
    /*
      Adopt the prop — but never while this dial is the one moving.

      Each delta is measured from where the dial already is, and a parent that
      re-renders slowly (the home page recasts a chart and rebuilds an SVG as
      the date changes) hands back a `value` several commits behind. Writing
      that into `cur` rewinds the position, the next delta is measured from
      the stale date, and the movement is undone about as fast as it
      accumulates.

      So the prop is ignored for the length of a drag or a glide, and is
      authoritative again the moment one ends — which matters, because the
      buttons above the dial move the date without going through it at all.
    */
    if (drag.current || spin.current !== null) return;
    cur.current = value;
  }, [value]);

  const dial = useRef<HTMLDivElement>(null);
  const spin = useRef<number | null>(null);
  /**
   * Days of movement not yet spent. A date holds whole days, but a drag
   * arrives in fractions of one — rounding each move on its own loses about a
   * day per sixty degrees, so the remainder is carried to the next move.
   */
  const carry = useRef(0);

  const apply = useCallback(
    (next: Date) => {
      const y = next.getUTCFullYear();
      if (y < minYear || y > maxYear) return;
      cur.current = next;
      onChange(next);
    },
    [minYear, maxYear, onChange],
  );

  /** Advance by a fractional number of days, banking the remainder. */
  const nudge = useCallback(
    (days: number) => {
      const total = days + carry.current;
      const whole = Math.trunc(total);
      carry.current = total - whole;
      if (whole !== 0) apply(addDays(cur.current, whole));
    },
    [apply],
  );

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

  const stopSpin = useCallback(() => {
    if (spin.current !== null) cancelAnimationFrame(spin.current);
    spin.current = null;
  }, []);

  useEffect(() => stopSpin, [stopSpin]);

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
      projects a fling — and the dial eases there.
    */
    const GLIDE_MS = 420; // time constant: how much "mass" the dial carries
    const MAX_TURN = 300; // no single flick throws more than ten months
    const travel = Math.max(-MAX_TURN, Math.min(MAX_TURN, v * GLIDE_MS));
    const duration = Math.min(2400, Math.max(420, Math.abs(travel) * 13));

    const start = performance.now();
    let done = 0; // degrees already handed to the date
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / duration);
      // easeOutQuint — takes the speed off the hand cleanly, then a long tail
      // where the last few days tick past slowly enough to read.
      const eased = 1 - Math.pow(1 - p, 5);
      const target = travel * eased;
      nudge((target - done) / DEG_PER_DAY);
      done = target;
      spin.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    spin.current = requestAnimationFrame(step);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = e.shiftKey;
    const at = cur.current;
    const map: Record<string, () => Date> = {
      ArrowRight: () => addDays(at, big ? 7 : 1),
      ArrowUp: () => addDays(at, big ? 7 : 1),
      ArrowLeft: () => addDays(at, big ? -7 : -1),
      ArrowDown: () => addDays(at, big ? -7 : -1),
      PageUp: () => addMonths(at, 1),
      PageDown: () => addMonths(at, -1),
      Home: () => new Date(Date.UTC(at.getUTCFullYear(), 0, 1, 12)),
      End: () => new Date(Date.UTC(at.getUTCFullYear(), 11, 31, 12)),
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault();
    stopSpin();
    carry.current = 0;
    apply(fn());
  };

  const stepDay = (by: number) => {
    stopSpin();
    carry.current = 0;
    apply(addDays(cur.current, by));
  };

  // ── geometry ────────────────────────────────────────────────────────────
  const sunLon = sunLongitude(value);
  const moonLon = moonLongitude(value);
  const earthLon = (sunLon + 180) % 360;
  const sign = SIGNS[Math.floor(sunLon / 30) % 12];

  const C = 100;
  const R_ORBIT = 72;
  /*
    Rounded, and that matters beyond tidiness.

    Math.sin and Math.cos are not required to be correctly rounded, and the
    server and the browser can disagree in the last bit — enough for React to
    see "128.3" against "128.30000000000001" and call the whole tree a
    hydration mismatch. Two decimals is far finer than a 200-unit viewBox can
    show and leaves nothing to disagree about.
  */
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pt = (lon: number, r: number): [number, number] => [
    r2(C + r * Math.cos((lon * Math.PI) / 180)),
    r2(C - r * Math.sin((lon * Math.PI) / 180)),
  ];
  const [ex, ey] = pt(earthLon, R_ORBIT);
  const [mx, my] = [
    r2(ex + 15 * Math.cos((moonLon * Math.PI) / 180)),
    r2(ey - 15 * Math.sin((moonLon * Math.PI) / 180)),
  ];

  return (
    <div className={["odp-stack", className].filter(Boolean).join(" ")}>
      <div className="odp-year">
        <button type="button" onClick={() => apply(setYear(value, value.getUTCFullYear() - 1))} aria-label="Previous year">
          ‹
        </button>
        <input
          type="number"
          className="odp-year-input"
          value={value.getUTCFullYear()}
          min={minYear}
          max={maxYear}
          aria-label="Year"
          onChange={(e) => {
            const y = Number(e.target.value);
            if (y >= minYear && y <= maxYear) apply(setYear(value, y));
          }}
        />
        <button type="button" onClick={() => apply(setYear(value, value.getUTCFullYear() + 1))} aria-label="Next year">
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
        aria-valuenow={Math.floor((value.getTime() - Date.UTC(value.getUTCFullYear(), 0, 1, 12)) / MS_DAY) + 1}
        aria-valuetext={formatLongDate(value)}
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

      {/* A day is about a degree and a half of this dial — under two pixels of
          arc — so the ring alone cannot reliably land on the 14th rather than
          the 15th. These step one day at a time. (The other fine control is
          physical: drag further out from the centre and the same movement of
          the hand turns fewer degrees.) */}
      <div className="odp-readout">
        <div className="odp-day">
          <button type="button" onClick={() => stepDay(-1)} aria-label="Previous day">
            ‹
          </button>
          <strong>{formatLongDate(value)}</strong>
          <button type="button" onClick={() => stepDay(1)} aria-label="Next day">
            ›
          </button>
        </div>
        <span>
          Sun in {sign.name} · {toISO(value)}
        </span>
      </div>
    </div>
  );
}
