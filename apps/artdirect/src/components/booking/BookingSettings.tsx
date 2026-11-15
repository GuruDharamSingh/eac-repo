"use client";

import * as React from "react";
import {
  BookingSection,
  BookingSectionRoot,
  validateOfferInput,
  type BookingOfferInput,
} from "@elkdonis/studio-forms/booking";

// ============================================================================
// The owner's booking settings on their own service page (booking module
// phase 1): the shared Booking section from @elkdonis/studio-forms, mounted
// without FormShell, with one Save. Validation runs here for an early
// sentence and again on the server, which decides.
// ============================================================================

export function BookingSettings({
  initial,
  saved: savedBefore,
  save,
}: {
  initial: BookingOfferInput;
  /** Whether an offer is already stored (otherwise these are suggestions). */
  saved: boolean;
  save: (input: BookingOfferInput) => Promise<{ ok: true; offer: BookingOfferInput } | { ok: false; error: string }>;
}) {
  const [value, setValue] = React.useState<BookingOfferInput>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(savedBefore ? null : "Not saved yet: these are suggested hours.");
  const [pending, setPending] = React.useState(false);

  async function onSave() {
    setError(null);
    const checked = validateOfferInput(value);
    if (checked.ok === false) {
      setError(checked.error);
      return;
    }
    setPending(true);
    const r = await save(checked.value).catch(() => ({ ok: false as const, error: "Could not save. Try again." }));
    setPending(false);
    if (r.ok === false) {
      setError(r.error);
      return;
    }
    setValue(r.offer);
    setStatus("Saved. Visitors now see these times.");
  }

  return (
    <BookingSectionRoot className="oad-booking-settings">
      <BookingSection
        value={value}
        onChange={(v) => {
          setValue(v);
          setStatus(null);
        }}
        error={error}
        idPrefix="oad-bk"
        disabled={pending}
      />
      <div className="oad-booking-save">
        <button type="button" className="frm-btn frm-btn--primary" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save booking settings"}
        </button>
        {status ? (
          <span className="frm-hint" role="status">
            {status}
          </span>
        ) : null}
      </div>
    </BookingSectionRoot>
  );
}
