"use client";

import * as React from "react";
import { groupSlotsByDay, type IntakeQuestion, type OpenSlot } from "@elkdonis/booking/core";
import { ProposeTimes, browserTimeZone, type ProposedTimesValue } from "./ProposeTimes";

// ============================================================================
// Book an offering of the booking module (migration 265): pick a time from
// open hours, or suggest times, then who is booking. Free or paid; the host
// passes a server action that books for free or opens the card checkout and
// returns where to send the browser (the booking page, or Stripe).
//
// Plain CSS (`@elkdonis/checkout/booking.css`, `.eac-booking*`). Times are
// computed on the server; this component only groups and shows them, in the
// viewer's zone once mounted (the offer's zone on the server render).
// ============================================================================

export interface BookingPanelInput {
  /** open_hours: the chosen start (ISO). */
  startsAt: string | null;
  /** request_time: suggested starts (ISO). */
  proposedTimes: string[];
  timeZone: string;
  name: string;
  email: string;
  notes: string;
  /** Major units as typed; empty for the list price. */
  amount: string;
  answers: Record<string, string>;
}

export type BookingPanelResult = { ok: true; url: string } | { ok: false; error: string };

export interface BookingPanelProps {
  mode: "open_hours" | "request_time";
  slots: OpenSlot[];
  /** The offer's zone (server render and fallback). */
  timeZone: string;
  durationMinutes: number | null;
  questions?: IntakeQuestion[];
  /** The cancellation policy in a sentence, or null. */
  policy?: string | null;
  /** Null = free. Major units. */
  price?: { list: number; floor: number | null; note?: string | null; currency: string } | null;
  defaultName?: string | null;
  defaultEmail?: string | null;
  action: (input: BookingPanelInput) => Promise<BookingPanelResult>;
  /** When set, shown instead of the button. */
  unavailable?: string | null;
  notesLabel?: string;
}

function useViewerZone(fallback: string): string {
  const [zone, setZone] = React.useState(fallback);
  React.useEffect(() => setZone(browserTimeZone()), []);
  return zone;
}

function dayLabel(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-CA", { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }).format(d),
  };
}

function timeLabel(iso: string, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: zone }).format(new Date(iso));
}

function fullLabel(iso: string, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function BookingPanel({
  mode,
  slots,
  timeZone,
  durationMinutes,
  questions = [],
  policy,
  price,
  defaultName,
  defaultEmail,
  action,
  unavailable,
  notesLabel = "Anything they should know before you meet? (optional)",
}: BookingPanelProps) {
  const zone = useViewerZone(timeZone);
  const days = React.useMemo(() => groupSlotsByDay(slots, zone), [slots, zone]);
  const [day, setDay] = React.useState<string | null>(null);
  const [startsAt, setStartsAt] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<ProposedTimesValue>({ times: [], timeZone });
  const [name, setName] = React.useState(defaultName ?? "");
  const [email, setEmail] = React.useState(defaultEmail ?? "");
  const [notes, setNotes] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const sliding = price != null && price.floor != null && price.floor < price.list;
  const [amount, setAmount] = React.useState(sliding ? String(price!.list) : "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const shownDay = day && days.some((d) => d.date === day) ? day : days[0]?.date ?? null;
  const daySlots = days.find((d) => d.date === shownDay)?.slots ?? [];
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: price?.currency || "CAD" }).format(n);
  const due = price ? (sliding && amount !== "" && Number.isFinite(Number(amount)) ? Number(amount) : price.list) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || unavailable) return;
    setError(null);
    if (mode === "open_hours" && !startsAt) {
      setError("Choose a time first.");
      return;
    }
    if (mode === "request_time" && proposal.times.length === 0) {
      setError("Suggest at least one time that suits you.");
      return;
    }
    setPending(true);
    const result = await action({
      startsAt: mode === "open_hours" ? startsAt : null,
      proposedTimes: mode === "request_time" ? proposal.times : [],
      timeZone: mode === "request_time" ? proposal.timeZone : zone,
      name,
      email,
      notes,
      amount: sliding ? amount : "",
      answers,
    }).catch((): BookingPanelResult => ({ ok: false, error: "Could not make the booking. Try again." }));
    // `=== false`: apps compiled without strictNullChecks do not narrow on `!ok`.
    if (result.ok === false) {
      setError(result.error);
      setPending(false);
      return;
    }
    window.location.assign(result.url);
  }

  const length = durationMinutes ? (durationMinutes % 60 === 0 ? `${durationMinutes / 60} h` : `${durationMinutes} min`) : null;
  const submitLabel = pending
    ? price
      ? "Opening payment…"
      : "Booking…"
    : price
      ? `Book and pay ${fmtMoney(due)}`
      : mode === "request_time"
        ? "Send my times"
        : "Book this time";

  return (
    <form className="eac-booking eac-booking-panel" onSubmit={submit}>
      {mode === "open_hours" ? (
        <fieldset className="eac-booking-times">
          <legend className="eac-booking-label">Choose a time{length ? ` (${length})` : ""}</legend>
          {days.length === 0 ? (
            <p className="eac-booking-hint">No times are open at the moment.</p>
          ) : (
            <>
              <div className="eac-booking-days" role="group" aria-label="Day">
                {days.map((d) => {
                  const l = dayLabel(d.date);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      className="eac-booking-day"
                      aria-pressed={d.date === shownDay}
                      onClick={() => {
                        setDay(d.date);
                        setStartsAt(null);
                      }}
                    >
                      <span className="eac-booking-day-w">{l.weekday}</span>
                      <span className="eac-booking-day-d">{l.day}</span>
                    </button>
                  );
                })}
              </div>
              <div className="eac-booking-slots" role="group" aria-label="Time">
                {daySlots.map((s) => (
                  <button
                    key={s.startsAt}
                    type="button"
                    className="eac-booking-slot"
                    aria-pressed={s.startsAt === startsAt}
                    onClick={() => setStartsAt(s.startsAt)}
                    suppressHydrationWarning
                  >
                    {timeLabel(s.startsAt, zone)}
                  </button>
                ))}
              </div>
              <p className="eac-booking-hint" suppressHydrationWarning>
                Times are in your time zone ({zone}).
              </p>
            </>
          )}
        </fieldset>
      ) : (
        <ProposeTimes
          onChange={setProposal}
          hint="They will confirm one of these or suggest others. Times are in your time zone"
        />
      )}

      {mode === "open_hours" && startsAt ? (
        <p className="eac-booking-status" role="status" suppressHydrationWarning>
          <strong>{fullLabel(startsAt, zone)}</strong>
        </p>
      ) : null}

      <label className="eac-booking-field">
        <span className="eac-booking-label">Your name</span>
        <input className="eac-booking-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label className="eac-booking-field">
        <span className="eac-booking-label">Email</span>
        <input
          className="eac-booking-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      {questions.map((q) => (
        <label key={q.key} className="eac-booking-field">
          <span className="eac-booking-label">
            {q.label}
            {q.required ? "" : " (optional)"}
          </span>
          <input
            className="eac-booking-input"
            value={answers[q.key] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
            required={q.required}
          />
        </label>
      ))}

      {sliding && (
        <label className="eac-booking-field">
          <span className="eac-booking-label">
            What you will pay ({fmtMoney(price!.floor!)} to {fmtMoney(price!.list)})
          </span>
          <input
            className="eac-booking-input"
            type="number"
            step="any"
            min={price!.floor!}
            max={price!.list}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          {price!.note ? <span className="eac-booking-hint">{price!.note}</span> : null}
        </label>
      )}

      <label className="eac-booking-field">
        <span className="eac-booking-label">{notesLabel}</span>
        <textarea className="eac-booking-input" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {policy ? <p className="eac-booking-hint">Cancellation: {policy}</p> : null}

      {error && (
        <p className="eac-booking-error" role="alert">
          {error}
        </p>
      )}

      {unavailable ? (
        <p className="eac-booking-hint">{unavailable}</p>
      ) : (
        <button type="submit" className="eac-booking-submit" disabled={pending || (mode === "open_hours" && days.length === 0)}>
          {submitLabel}
        </button>
      )}
      {price ? <p className="eac-booking-hint">Payment is by card on Stripe&apos;s page. Your time is held while you pay.</p> : null}
    </form>
  );
}
