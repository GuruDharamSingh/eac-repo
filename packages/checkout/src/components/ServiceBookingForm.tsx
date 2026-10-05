"use client";

import * as React from "react";
import { ProposeTimes, type ProposedTimesValue } from "./ProposeTimes";

// ============================================================================
// Book a service and pay by card — the one booking form every site uses.
//
// Plain CSS (`@elkdonis/checkout/booking.css`, `.eac-booking*`), not Tailwind:
// hosts do not compile Tailwind over this package, and hidden-enneagram,
// elastrocal and ArtDirect each style their own shell around it.
//
// The host supplies `action`, a server action that calls startThreadCheckout
// with the thread it looked up on its own site and returns Stripe's URL. The
// form only collects who is booking, an amount on a sliding scale, and a note.
// ============================================================================

export type ServiceBookingResult = { ok: true; url: string } | { ok: false; error: string };

export interface ServiceBookingInput {
  name: string;
  email: string;
  notes: string;
  /** Major units as typed; empty for the list price. */
  amount: string;
  /** Proposed start times as ISO instants; empty when the service is not scheduled. */
  proposedTimes: string[];
  /** The buyer's IANA time zone. */
  timeZone: string;
}

export interface ServiceBookingFormProps {
  action: (input: ServiceBookingInput) => Promise<ServiceBookingResult>;
  /** Major units. */
  listPrice: number;
  /** Major units, or null when there is no sliding scale. */
  slidingFloor: number | null;
  slidingNote?: string | null;
  currency: string;
  defaultName?: string | null;
  defaultEmail?: string | null;
  /** The label over the note field. */
  notesLabel?: string;
  /** When set, the form is shown disabled with this sentence instead of a button. */
  unavailable?: string | null;
  /**
   * Ask for up to three start times (one-to-one services). The seller
   * confirms one after payment, or suggests others.
   */
  schedule?: boolean;
}

export function ServiceBookingForm({
  action,
  listPrice,
  slidingFloor,
  slidingNote,
  currency,
  defaultName,
  defaultEmail,
  notesLabel = "Anything they should know before you meet? (optional)",
  unavailable,
  schedule = false,
}: ServiceBookingFormProps) {
  const [name, setName] = React.useState(defaultName ?? "");
  const [email, setEmail] = React.useState(defaultEmail ?? "");
  const [notes, setNotes] = React.useState("");
  const sliding = slidingFloor != null && slidingFloor < listPrice;
  const [amount, setAmount] = React.useState(sliding ? String(listPrice) : "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<ProposedTimesValue>({ times: [], timeZone: "America/Toronto" });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(n);
  const due = sliding && amount !== "" && Number.isFinite(Number(amount)) ? Number(amount) : listPrice;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || unavailable) return;
    setError(null);
    if (schedule && proposal.times.length === 0) {
      setError("Suggest at least one time that suits you.");
      return;
    }
    setPending(true);
    const result = await action({
      name,
      email,
      notes,
      amount: sliding ? amount : "",
      proposedTimes: schedule ? proposal.times : [],
      timeZone: proposal.timeZone,
    }).catch(
      (): ServiceBookingResult => ({ ok: false, error: "Could not start the payment. Try again." })
    );
    // `=== false` rather than `!result.ok`: the apps compile without
    // strictNullChecks, where truthiness does not narrow the union.
    if (result.ok === false) {
      setError(result.error);
      setPending(false);
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <form className="eac-booking" onSubmit={submit} noValidate={false}>
      <label className="eac-booking-field">
        <span className="eac-booking-label">Your name</span>
        <input
          className="eac-booking-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
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

      {sliding && (
        <label className="eac-booking-field">
          <span className="eac-booking-label">
            What you will pay ({fmt(slidingFloor!)} to {fmt(listPrice)})
          </span>
          <input
            className="eac-booking-input"
            type="number"
            step="any"
            min={slidingFloor!}
            max={listPrice}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          {slidingNote ? <span className="eac-booking-hint">{slidingNote}</span> : null}
        </label>
      )}

      {schedule && (
        <ProposeTimes
          onChange={setProposal}
          hint="They will confirm one of these after you pay, or suggest others. Times are in your time zone"
        />
      )}

      <label className="eac-booking-field">
        <span className="eac-booking-label">{notesLabel}</span>
        <textarea
          className="eac-booking-input"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && (
        <p className="eac-booking-error" role="alert">
          {error}
        </p>
      )}

      {unavailable ? (
        <p className="eac-booking-hint">{unavailable}</p>
      ) : (
        <button type="submit" className="eac-booking-submit" disabled={pending}>
          {pending ? "Opening payment…" : `Book and pay ${fmt(due)}`}
        </button>
      )}
      <p className="eac-booking-hint">Payment is by card on Stripe's page. You will come back here afterwards.</p>
    </form>
  );
}
