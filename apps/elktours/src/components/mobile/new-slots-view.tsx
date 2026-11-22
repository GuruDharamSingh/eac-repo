"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import "@/blocks/mobile/flow.css";
import "./board.css";
import { Chip, PrimaryButton } from "@/components/mobile";
import { createSlots, previewSlots, type NewSlotsInput, type SlotPreview } from "@/lib/slot-actions";
import { BoardTabBar } from "./board-nav";
import { CUTOFFS, dayShort, minutesLabel, money } from "./board-ui";

export interface NewSlotsTour {
  id: string;
  title: string;
  published: boolean;
  durationMinutes: number;
  minToRun: number | null;
  closeBeforeMinutes: number;
  priceMinor: number | null;
  currency: string;
  /** The tour author, so a guide is offered only their own tours (the booking actions refuse the rest). */
  authorId?: string | null;
}

export interface NewSlotsGuide {
  id: string;
  name: string;
  short: string;
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const NOT_STORED: Record<string, string> = {
  duration: "length",
  minToRun: "minimum",
  closeBeforeMinutes: "booking cutoff",
  waitlist: "waitlist",
  price: "price",
};

const hhmm = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** A stored minimum of 1 means None. */
const realMin = (m: number | null | undefined) => (m != null && m > 1 ? m : 0);

function Stepper({ label, value, onMinus, onPlus, minusOff, plusOff }: { label?: string; value: string; onMinus: () => void; onPlus: () => void; minusOff?: boolean; plusOff?: boolean }) {
  return (
    <div className="b-stepper">
      {label ? <span className="b-stepper-label">{label}</span> : <span />}
      <span className="b-stepper-ctl">
        <button type="button" className="b-mini" aria-label={`Less${label ? ` ${label}` : ""}`} disabled={minusOff} onClick={onMinus}>−</button>
        <span className="b-stepper-val">{value}</span>
        <button type="button" className="b-mini" aria-label={`More${label ? ` ${label}` : ""}`} disabled={plusOff} onClick={onPlus}>+</button>
      </span>
    </div>
  );
}

function Head({ n, label, aside }: { n: string; label: string; aside?: string }) {
  return (
    <div className="b-sec-head">
      <span className="b-sec-num">{n}</span>
      <span className="b-sec-label">{label}</span>
      {aside ? <span className="b-sec-aside">{aside}</span> : null}
    </div>
  );
}

/**
 * Screen 32, New slots. Picks a tour (its defaults load), dates, up to four start times, length, minimum and
 * maximum places, booking cutoff and (office) the guide; previewSlots lists every date x time as ready or blocked;
 * createSlots creates the ready ones. The waitlist is off (not shown, not sent). A different price for one slot is
 * refused by the backend, so the price is shown, not edited.
 */
export function NewSlotsView({
  tours: allTours,
  existing,
  guides,
  selfGuideId,
  today,
  rule,
  below,
  who,
}: {
  tours: NewSlotsTour[];
  existing: Array<{ tourId: string; day: string }>;
  guides: NewSlotsGuide[] | null;
  selfGuideId: string | null;
  today: string;
  rule: "guide_decides" | "auto_cancel";
  below: number;
  who: string;
}) {
  const router = useRouter();
  const tours = useMemo(() => (selfGuideId ? allTours.filter((t) => t.authorId == null || t.authorId === selfGuideId) : allTours), [allTours, selfGuideId]);
  const first = tours.find((t) => t.published) ?? tours[0] ?? null;
  const [tourId, setTourId] = useState<string | null>(first?.id ?? null);
  const tour = tours.find((t) => t.id === tourId) ?? null;
  const [dates, setDates] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>(["10:00"]);
  const [duration, setDuration] = useState(first?.durationMinutes ?? 120);
  const [min, setMin] = useState(realMin(first?.minToRun));
  const [max, setMax] = useState(Math.max(8, realMin(first?.minToRun)));
  const [cut, setCut] = useState(first?.closeBeforeMinutes ?? 1440);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [preview, setPreview] = useState<SlotPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function pickTour(t: NewSlotsTour) {
    setTourId(t.id);
    setDuration(t.durationMinutes);
    const m = realMin(t.minToRun);
    setMin(m);
    setMax((x) => Math.max(x, m));
    setCut(t.closeBeforeMinutes);
  }

  const cutChips = useMemo(() => [...new Set([...CUTOFFS, cut])].sort((a, b) => a - b), [cut]);
  const taken = useMemo(() => new Set(existing.filter((e) => e.tourId === tourId).map((e) => e.day)), [existing, tourId]);

  const input: NewSlotsInput | null = useMemo(() => {
    if (!tourId || dates.length === 0 || times.length === 0) return null;
    return {
      tourId,
      dates,
      times,
      durationMinutes: duration,
      minToRun: min > 0 ? min : null,
      maxPlaces: max,
      closeBeforeMinutes: cut,
      guideUserId: guides ? guideId : selfGuideId,
    };
  }, [tourId, dates, times, duration, min, max, cut, guideId, guides, selfGuideId]);

  // Preview whenever the form changes (debounced); a late answer for an older form is dropped.
  const seq = useRef(0);
  useEffect(() => {
    setCreateError(null);
    if (!input) {
      setPreview(null);
      setPreviewError(null);
      setChecking(false);
      return;
    }
    const mine = ++seq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await previewSlots(input);
        if (mine !== seq.current) return;
        if (r.ok) {
          setPreview(r.preview);
          setPreviewError(null);
        } else {
          setPreview(null);
          setPreviewError(r.error);
        }
      } catch {
        if (mine === seq.current) setPreviewError("Could not work out the slots.");
      } finally {
        if (mine === seq.current) setChecking(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [input]);

  async function create() {
    if (!input) return;
    setCreating(true);
    setCreateError(null);
    try {
      const r = await createSlots(input);
      if (!r.ok) {
        setCreateError(r.error);
        failToast(r.error);
        return;
      }
      toast.success(r.created === 1 ? "1 slot created." : `${r.created} slots created.`);
      if (r.notStored.length > 0) toast.message(`Not stored per slot: ${r.notStored.map((k) => NOT_STORED[k] ?? k).join(", ")}. The tour's own settings apply.`);
      router.push(`/manage/schedule${r.firstDay ? `?week=${r.firstDay}` : ""}`);
    } catch {
      setCreateError("Could not create the slots.");
    } finally {
      setCreating(false);
    }
  }

  // month grid
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const firstOfMonth = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (firstOfMonth.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(firstOfMonth);
  const shiftMonth = (n: number) => setMonth(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7));
  const toggleDay = (key: string) => setDates((d) => (d.includes(key) ? d.filter((x) => x !== key) : [...d, key].sort()));

  const ready = preview?.ready ?? 0;
  const items = preview?.items ?? [];
  const blocked = items.length - ready;

  if (tours.length === 0) {
    return (
      <>
        <div className="b-page">
          <Top who={who} />
          <h1 className="b-title" style={{ margin: "18px 20px 0" }}>New slots</h1>
          <p className="b-empty">There are no tours yet. <Link href="/manage/tours">Add a tour</Link> first, then come back to schedule it.</p>
        </div>
        <BoardTabBar count={below} />
      </>
    );
  }

  return (
    <>
      <div className="b-page">
        <Top who={who} />
        <h1 className="b-title" style={{ margin: "18px 20px 0" }}>New slots</h1>
        <p className="b-intro">Each date and start time becomes one bookable slot.</p>

        <div className="b-form">
          <section className="b-sec">
            <Head n="I" label="Experience" />
            <div className="b-chips">
              {tours.map((t) => (
                <Chip key={t.id} selected={t.id === tourId} onClick={() => pickTour(t)}>
                  {t.title}
                  {t.published ? "" : " (draft)"}
                </Chip>
              ))}
            </div>
            {tour ? (
              <p className="b-note">
                {tour.minToRun ? `Runs with ${tour.minToRun} or more` : "No minimum"} · booking closes {minutesLabel(tour.closeBeforeMinutes).toLowerCase()} before · {tour.priceMinor != null ? `${money(tour.priceMinor, tour.currency)} per person` : "no price set"}. These load as the defaults.
              </p>
            ) : null}
          </section>

          <section className="b-sec">
            <Head n="II" label="Dates" aside={dates.length === 0 ? "None picked" : dates.length === 1 ? "1 day" : `${dates.length} days`} />
            <div className="b-cal">
              <div className="m-cal-head">
                <div>
                  <span className="m-cal-month">{monthName}</span> <span className="m-cal-year">{y}</span>
                </div>
                <div className="m-cal-nav">
                  <button type="button" aria-label="Earlier month" disabled={month <= today.slice(0, 7)} onClick={() => shiftMonth(-1)}>‹</button>
                  <button type="button" aria-label="Later month" onClick={() => shiftMonth(1)}>›</button>
                </div>
              </div>
              <div className="m-cal-grid">
                {WEEK.map((w, i) => <span key={i} className="m-cal-wd">{w}</span>)}
                {cells.map((d, i) => {
                  if (d == null) return <span key={i} />;
                  const key = `${month}-${String(d).padStart(2, "0")}`;
                  const past = key < today;
                  const picked = dates.includes(key);
                  return (
                    <div key={i} className="m-cal-cell b-cal-cell">
                      <button
                        type="button"
                        disabled={past}
                        aria-pressed={picked}
                        className={`m-cal-day${picked ? " is-picked" : ""}${past ? " b-cal-day-off" : ""}`}
                        style={!picked && !past ? { color: "hsl(var(--foreground))", cursor: "pointer" } : undefined}
                        onClick={() => toggleDay(key)}
                      >
                        {d}
                      </button>
                      {taken.has(key) ? <span className="b-cal-dot" aria-label="Already has a slot of this experience" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="b-legend"><i />Already has a slot of this experience</p>
          </section>

          <section className="b-sec">
            <Head n="III" label="Start times" aside="Paris time" />
            {times.map((t, i) => (
              <div key={i} className="b-time">
                <span className="b-time-start">{t}</span>
                <span className="b-time-end">to {hhmm(toMins(t) + duration)}</span>
                <button type="button" className="b-mini" aria-label="15 minutes earlier" onClick={() => setTimes(times.map((x, j) => (j === i ? hhmm(toMins(x) - 15) : x)))}>‹</button>
                <button type="button" className="b-mini" aria-label="15 minutes later" onClick={() => setTimes(times.map((x, j) => (j === i ? hhmm(toMins(x) + 15) : x)))}>›</button>
                <button type="button" className="b-mini" aria-label="Remove this time" disabled={times.length <= 1} onClick={() => setTimes(times.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button
              type="button"
              className="b-dashed"
              disabled={times.length >= 4}
              onClick={() => setTimes([...times, hhmm(toMins(times[times.length - 1] ?? "10:00") + 240)])}
            >
              + Add a start time
            </button>
          </section>

          <section className="b-sec">
            <Head n="IV" label="Length" />
            <Stepper value={minutesLabel(duration).replace("hours", "h").replace("hour", "h")} minusOff={duration <= 15} plusOff={duration >= 1440} onMinus={() => setDuration(Math.max(15, duration - 15))} onPlus={() => setDuration(Math.min(1440, duration + 15))} />
          </section>

          <section className="b-sec">
            <Head n="V" label="Places" />
            <Stepper label="Minimum to run" value={min > 0 ? String(min) : "None"} minusOff={min <= 0} plusOff={min >= max} onMinus={() => setMin(Math.max(0, min - 1))} onPlus={() => setMin(Math.min(max, min + 1))} />
            <Stepper label="Maximum" value={String(max)} minusOff={max <= Math.max(1, min)} plusOff={max >= 500} onMinus={() => setMax(Math.max(Math.max(1, min), max - 1))} onPlus={() => setMax(Math.min(500, max + 1))} />
            <div className="b-dots" aria-hidden="true">
              {Array.from({ length: Math.min(max, 40) }, (_, i) => (
                <span key={i} className={`b-dot${min > 0 && i < min ? " is-min" : ""}`} />
              ))}
            </div>
            <p className="b-note">
              {min > 0
                ? `Runs with ${min} or more. If fewer have booked when booking closes, ${rule === "auto_cancel" ? "the slot is cancelled automatically." : "you decide whether it runs."}`
                : "No minimum: every slot runs, however many book."}
            </p>
          </section>

          <section className="b-sec">
            <Head n="VI" label="Booking closes" />
            <div className="b-chips">
              {cutChips.map((c) => (
                <Chip key={c} selected={c === cut} onClick={() => setCut(c)}>{minutesLabel(c)}</Chip>
              ))}
            </div>
            <p className="b-note">Booking closes {minutesLabel(cut).toLowerCase()} before each start.</p>
          </section>

          {tour ? (
            <section className="b-sec">
              <Head n="VII" label="Price per person" aside={tour.priceMinor != null ? money(tour.priceMinor, tour.currency) : "Not set"} />
              <p className="b-note">The price is set on the tour. A different price for one slot is not available yet.</p>
            </section>
          ) : null}

          {guides && guides.length > 0 ? (
            <section className="b-sec">
              <Head n="VIII" label="Guide" />
              <div className="b-chips">
                <Chip selected={guideId === null} onClick={() => setGuideId(null)}>Tour author</Chip>
                {guides.map((g) => (
                  <Chip key={g.id} selected={guideId === g.id} onClick={() => setGuideId(g.id)}>{g.short}</Chip>
                ))}
              </div>
            </section>
          ) : null}

          <section className="b-sec">
            <Head n={guides && guides.length > 0 ? "IX" : "VIII"} label="To be created" aside={!input ? "" : checking ? "Checking..." : items.length === 0 ? "" : blocked > 0 ? `${ready} ready · ${blocked} blocked` : `${ready} ready`} />
            {!input ? <p className="b-note">Pick a date and a start time to see the slots.</p> : null}
            {previewError ? <p className="b-err" style={{ marginTop: 12 }} role="alert">{previewError}</p> : null}
            <div className={`b-items${checking ? " b-fade" : ""}`}>
              {items.map((it) => (
                <div key={it.startsAt} className={`b-item${it.ok ? "" : " is-blocked"}`}>
                  <span className="b-item-mark" aria-hidden="true">{it.ok ? "✓" : "✕"}</span>
                  <span className="b-item-text">
                    <span>{dayShort(it.day)} · {it.time}</span>
                    <span className="b-item-sub">{it.ok ? `to ${hhmm(toMins(it.time) + duration)}` : it.message ?? "Blocked."}</span>
                  </span>
                </div>
              ))}
            </div>
            {preview && preview.notStored.length > 0 ? (
              <p className="b-note is-warn">Not stored per slot: {preview.notStored.map((k) => NOT_STORED[k] ?? k).join(", ")}. The tour's own settings apply.</p>
            ) : null}
          </section>
        </div>

        <div className="b-form-actions">
          {createError ? <p className="b-err" role="alert">{createError}</p> : null}
          <PrimaryButton disabled={!input || ready === 0 || creating || checking} onClick={create}>
            {creating ? "Creating..." : ready === 0 ? "Create slots" : ready === 1 ? "Create 1 slot" : `Create ${ready} slots`}
          </PrimaryButton>
        </div>
      </div>
      <BoardTabBar count={below} />
    </>
  );
}

function Top({ who }: { who: string }) {
  return (
    <div className="b-top" style={{ gap: 14, padding: "0 16px" }}>
      <Link href="/manage/schedule" className="m-back" aria-label="Back to the schedule">✕</Link>
      <span className="m-kicker" style={{ color: "hsl(var(--muted-foreground))" }}>{who}</span>
    </div>
  );
}
