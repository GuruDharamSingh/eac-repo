"use client";

import * as React from "react";

// ============================================================================
// Cancel a booking, for either side: a button that opens a short note and a
// confirm. The host passes a server action bound to the session (host) or
// the private token (booker). The policy sentence, if any, is shown first.
// ============================================================================

export type BookingCancelResult = { ok: true } | { ok: false; error: string };

export function BookingCancel({
  action,
  policy,
  label = "Cancel this booking",
  noteLabel = "A note to send with the cancellation (optional)",
}: {
  action: (reason: string) => Promise<BookingCancelResult>;
  policy?: string | null;
  label?: string;
  noteLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="eac-booking-secondary" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  async function confirm() {
    setPending(true);
    setError(null);
    const r = await action(reason).catch((): BookingCancelResult => ({ ok: false, error: "Could not cancel. Try again." }));
    if (r.ok === false) {
      setError(r.error);
      setPending(false);
      return;
    }
    window.location.reload();
  }
  return (
    <div className="eac-booking eac-booking-cancel">
      {policy ? <p className="eac-booking-hint">Cancellation: {policy}</p> : null}
      <label className="eac-booking-field">
        <span className="eac-booking-label">{noteLabel}</span>
        <textarea className="eac-booking-input" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error ? (
        <p className="eac-booking-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="eac-booking-row">
        <button type="button" className="eac-booking-submit" disabled={pending} onClick={confirm}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button type="button" className="eac-booking-secondary" disabled={pending} onClick={() => setOpen(false)}>
          Keep it
        </button>
      </div>
    </div>
  );
}
