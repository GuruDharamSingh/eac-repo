"use client";

import * as React from "react";
import { ProposeTimes, type ProposedTimesValue } from "./ProposeTimes";

// ============================================================================
// Agreeing a time for a booked service — one panel for both sides.
//
// The seller sees it on the network hub (/hub/bookings), the buyer on their
// private link (/bookings/<token>). Whoever is asked picks one of the other
// side's times or suggests others; a confirmed time can be reopened the same
// way. The host passes server actions (commerce's sellerConfirmTime /
// buyerConfirmTime and friends, bound to the session or the token); this
// component only collects the choice.
//
// Times render in the viewer's own zone once mounted; the server render uses
// the buyer's zone, so the text may change on hydration (suppressed below).
// ============================================================================

export type BookingActionResult = { ok: true } | { ok: false; error: string };

export interface BookingSchedulerProps {
  role: "buyer" | "seller";
  booking: {
    status: "awaiting_payment" | "awaiting_seller" | "awaiting_buyer" | "confirmed" | "cancelled";
    proposedBy: "buyer" | "seller" | null;
    proposedTimes: string[];
    scheduledAt: string | null;
    lastMessage: string | null;
    lastMessageBy: "buyer" | "seller" | null;
    buyerTimeZone: string;
    durationMinutes: number | null;
  };
  /** The other person, as named in sentences ("Ana", "the buyer"). */
  otherName: string;
  confirm: (at: string) => Promise<BookingActionResult>;
  propose: (times: string[], message: string) => Promise<BookingActionResult>;
  /** Seller only. */
  cancel?: (message: string) => Promise<BookingActionResult>;
  /** Link to the .ics file once confirmed. */
  calendarHref?: string | null;
  /** After a successful action. Default: reload the page. */
  onDone?: () => void;
}

function useViewerZone(fallback: string): string {
  const [zone, setZone] = React.useState(fallback);
  React.useEffect(() => {
    try {
      setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || fallback);
    } catch {
      /* keep the fallback */
    }
  }, [fallback]);
  return zone;
}

function fmt(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(isoString));
}

export function BookingScheduler({
  role,
  booking: b,
  otherName,
  confirm,
  propose,
  cancel,
  calendarHref,
  onDone,
}: BookingSchedulerProps) {
  const zone = useViewerZone(b.buyerTimeZone);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<ProposedTimesValue>({ times: [], timeZone: zone });
  const [note, setNote] = React.useState("");
  const [cancelNote, setCancelNote] = React.useState("");

  const myTurn = (role === "seller" && b.status === "awaiting_seller") || (role === "buyer" && b.status === "awaiting_buyer");
  const open = b.status === "awaiting_seller" || b.status === "awaiting_buyer" || b.status === "confirmed";
  const theirNote = b.lastMessage && b.lastMessageBy && b.lastMessageBy !== role ? b.lastMessage : null;
  const upcoming = b.proposedTimes.filter((t) => new Date(t).getTime() > Date.now());

  async function run(key: string, fn: () => Promise<BookingActionResult>) {
    setBusy(key);
    setError(null);
    const result = await fn().catch((): BookingActionResult => ({ ok: false, error: "That did not go through. Try again." }));
    setBusy(null);
    // `=== false`: hosts compile without strictNullChecks.
    if (result.ok === false) return setError(result.error);
    if (onDone) onDone();
    else window.location.reload();
  }

  return (
    <div className="eac-booking eac-booking-scheduler">
      {b.status === "confirmed" && b.scheduledAt && (
        <p className="eac-booking-status">
          <strong>Confirmed:</strong> <span suppressHydrationWarning>{fmt(b.scheduledAt, zone)}</span>
          {b.durationMinutes ? ` · ${b.durationMinutes} min` : ""}
          {calendarHref ? (
            <>
              {" · "}
              <a href={calendarHref}>Add to calendar</a>
            </>
          ) : null}
        </p>
      )}
      {b.status === "cancelled" && <p className="eac-booking-status">This booking was cancelled.</p>}

      {theirNote && (
        <p className="eac-booking-note">
          {otherName} wrote: “{theirNote}”
        </p>
      )}

      {myTurn && (
        <div className="eac-booking-field">
          <span className="eac-booking-label">
            {otherName} suggested {upcoming.length === 1 ? "this time" : "these times"}. Pick one to confirm:
          </span>
          {upcoming.length === 0 ? (
            <p className="eac-booking-hint">All of them have passed. Suggest other times below.</p>
          ) : (
            <ul className="eac-booking-choices">
              {upcoming.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    className="eac-booking-choice"
                    disabled={busy !== null}
                    onClick={() => run(`confirm:${t}`, () => confirm(t))}
                  >
                    <span suppressHydrationWarning>{fmt(t, zone)}</span>
                    <span className="eac-booking-choice-cue">{busy === `confirm:${t}` ? "Confirming…" : "Confirm"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!myTurn && (b.status === "awaiting_seller" || b.status === "awaiting_buyer") && (
        <div className="eac-booking-field">
          <span className="eac-booking-label">You suggested:</span>
          <ul className="eac-booking-list">
            {b.proposedTimes.map((t) => (
              <li key={t} suppressHydrationWarning>
                {fmt(t, zone)}
              </li>
            ))}
          </ul>
          <span className="eac-booking-hint">Waiting for {otherName} to confirm one or suggest others.</span>
        </div>
      )}

      {open && (
        <details className="eac-booking-more" open={myTurn && upcoming.length === 0}>
          <summary>{b.status === "confirmed" ? "Need to move it? Suggest other times" : "Suggest other times"}</summary>
          <div className="eac-booking">
            <ProposeTimes onChange={setProposal} idPrefix={`eac-counter-${role}`} label="Times that suit you" />
            <label className="eac-booking-field">
              <span className="eac-booking-label">A note for {otherName} (optional)</span>
              <textarea className="eac-booking-input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button
              type="button"
              className="eac-booking-submit"
              disabled={busy !== null || proposal.times.length === 0}
              onClick={() => run("propose", () => propose(proposal.times, note))}
            >
              {busy === "propose" ? "Sending…" : "Send these times"}
            </button>
          </div>
        </details>
      )}

      {open && cancel && (
        <details className="eac-booking-more">
          <summary>Cancel this booking</summary>
          <div className="eac-booking">
            <label className="eac-booking-field">
              <span className="eac-booking-label">Why, for {otherName} (optional)</span>
              <textarea className="eac-booking-input" rows={2} maxLength={1000} value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
            </label>
            <span className="eac-booking-hint">They are told by email. A refund is not issued automatically.</span>
            <button
              type="button"
              className="eac-booking-submit"
              disabled={busy !== null}
              onClick={() => run("cancel", () => cancel(cancelNote))}
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        </details>
      )}

      {error && (
        <p className="eac-booking-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
