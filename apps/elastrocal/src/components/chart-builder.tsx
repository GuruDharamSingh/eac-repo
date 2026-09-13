"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { chartForDate, moonPhase, type ChartResult, type ChartSpan } from "@elkdonis/astro";
import { MoonPhase } from "@elkdonis/cms-ui/pens";
import "@elkdonis/cms-ui/moon-phase.css";
import { ChartWheel } from "@/components/sky";
import { ChartForm, EMPTY_FORM, type ChartFormValues } from "@/components/chart-form";
import { OrbitDial, parseISO, toISO } from "@/components/orbit-dial";
import { ChartSummary, PositionsTable } from "@/components/chart/tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBase } from "@/lib/base-path";

/**
 * The home page: turn the dial, watch the chart.
 *
 * The orbit sits open beside the wheel and the chart is recast as the date
 * moves, so the year is something you scrub rather than something you fill
 * in. Underneath, the rest of what a chart needs — where, what time, whose —
 * and a way to keep it.
 *
 * Recalculating: the engine takes a few milliseconds but the round trip does
 * not, and a drag changes the date many times a second. So requests are
 * debounced, only one is ever in flight, and a reply that arrives out of
 * order is dropped. The wheel keeps showing the last good chart while the
 * next is on its way, which reads as the chart lagging slightly behind the
 * dial rather than as flicker.
 */

/*
  How often the chart may be recast while the dial is moving.

  This was a debounce, and a debounce was the wrong shape: its timer restarts
  on every change, so a continuous drag recalculated NOTHING until the hand
  stopped, and then the wheel jumped a season in one frame. Throttling instead
  gives a steady stream of updates during the movement and a final exact one
  when it settles.

  120ms is about eight updates a second. Measured on this machine a round trip
  is ~4ms and swapping the wheel's markup ~2ms, so the cadence is set by what
  reads as motion rather than by what the machine can stand.
*/
const THROTTLE_MS = 120;

/*
  The span: a table of days, so a drag needs no network at all.

  Asking the server per date is the wrong shape for scrubbing — a round trip
  per day, and the wheel arrives behind the hand. Instead one request brings
  back every day in a window as the bare numbers, and the browser assembles
  each chart from it with the same code the engine uses. Dragging inside the
  window is then a synchronous array lookup: no fetch, no wait, nothing to
  fall behind.

  A year is about 180KB of JSON (much less over the wire, and cached), which
  buys roughly 180 days of scrubbing in either direction before the window has
  to move. The per-date endpoint stays as the fallback for anything outside
  it, and for the moment the window is still loading.
*/
const SPAN_DAYS = 365;
/** How far before the centre the window starts. */
const SPAN_BACK = 182;
/** Refill when the date comes this close to an edge. */
const SPAN_MARGIN = 45;

const shiftISO = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function ChartBuilder({
  initialChart,
  initialValues,
  children,
}: {
  initialChart: ChartResult;
  initialValues: ChartFormValues;
  /**
   * Rendered between the form and the Moon. The page's standing sections go
   * here so the Moon stays last, while still being drawn from the live chart
   * this component holds.
   */
  children?: React.ReactNode;
}) {
  const [date, setDate] = useState<Date>(() => parseISO(initialValues.date) ?? new Date());
  const [form, setForm] = useState<ChartFormValues>(initialValues);
  const [chart, setChart] = useState<ChartResult>(initialChart);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The loaded window, and the key of the inputs it was cast for. Held in
  // refs: a drag reads them every few milliseconds and none of it should
  // cause a render of its own.
  const span = useRef<ChartSpan | null>(null);
  const spanKey = useRef<string>("");
  const spanLoading = useRef<string | null>(null);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // Only the newest request may write to the chart.
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRun = useRef(0);
  const pending = useRef<{ values: ChartFormValues; on: Date } | null>(null);

  const run = useCallback(
    async (values: ChartFormValues, on: Date) => {
      lastRun.current = performance.now();
      const mine = ++seq.current;
      setBusy(true);
      try {
        const res = await fetch(withBase("/api/charts/calculate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            date: toISO(on),
            time: values.timeKnown ? values.time : "12:00",
            latitude: Number(values.latitude),
            longitude: Number(values.longitude),
          }),
        });
        const body = await res.json();
        if (mine !== seq.current) return; // a newer turn of the dial won
        if (!res.ok) {
          setError(body.error ?? "The chart could not be calculated");
          return;
        }
        setError(null);
        setChart(body.chart);
      } catch {
        if (mine === seq.current) setError("The chart could not be calculated just now.");
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    },
    [],
  );

  /** Leading edge, then at most one call per THROTTLE_MS, then a trailing one. */
  const recalculate = useCallback(
    (values: ChartFormValues, on: Date) => {
      pending.current = { values, on };
      if (timer.current) return;
      const wait = Math.max(0, THROTTLE_MS - (performance.now() - lastRun.current));
      timer.current = setTimeout(() => {
        timer.current = null;
        const next = pending.current;
        pending.current = null;
        if (next) void run(next.values, next.on);
      }, wait);
    },
    [run],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  /** Everything a span is cast for, apart from the date. */
  const keyOf = (v: ChartFormValues) =>
    [v.time, v.timeKnown, v.timezone, v.latitude, v.longitude, v.houseSystem].join("|");

  /** Fetch the window around a date, unless that window is already here or on its way. */
  const loadSpan = useCallback(async (values: ChartFormValues, centre: string) => {
    const key = keyOf(values);
    const from = shiftISO(centre, -SPAN_BACK);
    const token = `${key}@${from}`;
    if (spanLoading.current === token) return;
    if (span.current && spanKey.current === key && chartForDate(span.current, centre)) return;
    spanLoading.current = token;
    try {
      const res = await fetch(withBase("/api/charts/span"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          date: from,
          days: SPAN_DAYS,
          time: values.timeKnown ? values.time : "12:00",
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
        }),
      });
      if (!res.ok) return; // the per-date path still works; no need to shout
      const body = await res.json();
      span.current = body.span as ChartSpan;
      spanKey.current = key;
    } catch {
      // Same: a missing span costs speed, not correctness.
    } finally {
      if (spanLoading.current === token) spanLoading.current = null;
    }
  }, []);

  // The first window, for the date the page opened on.
  useEffect(() => {
    void loadSpan(initialValues, initialValues.date);
  }, [loadSpan, initialValues]);

  // The form's callbacks must keep their identity or memo() never bites, so
  // the moving parts they need are read from refs rather than closed over.
  const formRef = useRef(form);
  formRef.current = form;
  const dateRef = useRef(date);
  dateRef.current = date;
  const noop = useCallback(() => {}, []);

  const onDial = (next: Date) => {
    setDate(next);
    const iso = toISO(next);

    // The fast path: the day is in the window, so the chart is arithmetic.
    if (span.current && spanKey.current === keyOf(formRef.current)) {
      const ready = chartForDate(span.current, iso);
      if (ready) {
        setChart(ready);
        setError(null);
        // Top up before running out, so the edge is never felt.
        const first = span.current.from;
        const last = shiftISO(first, span.current.days.length - 1);
        if (iso < shiftISO(first, SPAN_MARGIN) || iso > shiftISO(last, -SPAN_MARGIN)) {
          void loadSpan(formRef.current, iso);
        }
        return;
      }
    }

    // Outside the window (or none yet): ask for this one date, and start
    // fetching the window it belongs to.
    recalculate(formRef.current, next);
    void loadSpan(formRef.current, iso);
  };

  const onForm = useCallback((values: ChartFormValues) => {
    setForm(values);
    // A different time or place is a different table.
    if (keyOf(values) !== spanKey.current) {
      span.current = null;
      void loadSpan(values, toISO(dateRef.current));
    }
    recalculate(values, dateRef.current);
  }, [loadSpan, recalculate]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/charts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          date: toISO(date),
          time: form.timeKnown ? form.time : "12:00",
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          name: name.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "The chart could not be saved");
        return;
      }
      setSaved(body.id);
    } catch {
      setError("The chart could not be saved just now.");
    } finally {
      setSaving(false);
    }
  }

  const phase = moonPhase(chart);

  return (
    <div className="space-y-10">
      {/* The dial and the chart it is casting. */}
      {/* The dial and the chart are a pair, so they are sized as one: the
          wheel is capped to the height of the screen and the dial is given
          enough of the row not to read as an afterthought beside it. */}
      <section className="grid items-center gap-6 lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-10">
        <div className="mx-auto w-full max-w-[24rem] lg:mx-0">
          <OrbitDial value={date} onChange={onDial} className="odp-roomy" />
        </div>
        <div className="relative mx-auto w-full" style={{ maxWidth: "min(100%, calc(100vh - 11rem))" }}>
          <ChartWheel chart={chart} />
          {busy && (
            <span className="absolute right-3 top-3 text-muted-foreground" aria-hidden>
              <Loader2 className="size-4 animate-spin" />
            </span>
          )}
          <p className="sr-only" aria-live="polite">
            Chart for {toISO(date)}
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm">{error}</p>
      )}

      {/* Where, when, and whose. */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-display text-xl">Make it your chart</h2>
          <ChartForm
            initial={initialValues}
            busy={false}
            showDate={false}
            showSubmit={false}
            onChange={onForm}
            onSubmit={noop}
          />
          <div className="mt-5 space-y-1.5 border-t border-border pt-5">
            <Label htmlFor="chart-name">Name this chart</Label>
            <div className="flex gap-2">
              <Input
                id="chart-name"
                placeholder="Whose chart is this?"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(null);
                }}
              />
              <Button onClick={save} disabled={saving || !name.trim() || !form.latitude}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {saved ? (
                <a className="text-primary underline underline-offset-4" href={withBase(`/charts/${saved}`)}>
                  Saved — open it
                </a>
              ) : (
                "No account needed. Sign in later and your charts come with you."
              )}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <ChartSummary chart={chart} />
          <PositionsTable chart={chart} />
        </div>
      </section>

      {children}

      {/* The Moon of this moment — the same pen the network uses. */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <MoonPhase phase={phase} size={88} glow />
          <div>
            <h2 className="font-display text-xl">{phase.label} moon</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {Math.round(phase.illumination * 100)}% lit on {toISO(date)} — {phase.waxing ? "waxing" : "waning"},{" "}
              {Math.round(phase.age * 29.53)} days into the cycle.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
