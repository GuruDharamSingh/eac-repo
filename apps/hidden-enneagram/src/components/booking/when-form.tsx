"use client";

import { useActionState, useState } from "react";
import { ProposeTimes, type ProposedTimesValue } from "@elkdonis/checkout/components";
import type { TimesResult } from "@/lib/booking-actions";

/**
 * "When would suit you?" (round 3): shown once, after payment, on the service
 * page Stripe returns to. The shared ProposeTimes picker (the old booking
 * form's), a note, one button. The action is bound to the order on the server.
 */
export function WhenForm({
  action,
}: {
  action: (prev: TimesResult, formData: FormData) => Promise<TimesResult>;
}) {
  const [value, setValue] = useState<ProposedTimesValue>({ times: [], timeZone: "" });
  const [result, submit, pending] = useActionState(action, null);

  if (result?.ok) {
    return (
      <p role="status" className="he-when-done">
        Thank you. Your times have been sent. You will hear back by email with one of them confirmed, or others offered; that email has a link to follow the booking.
      </p>
    );
  }

  return (
    <form action={submit} className="he-when" data-he-when="">
      <h2 className="he-when-title">When would suit you?</h2>
      <p className="he-when-lede">Suggest up to three times. You will hear back by email with one confirmed, or others offered.</p>
      <ProposeTimes onChange={setValue} label="Times that suit you" idPrefix="he-when" />
      <input type="hidden" name="times" value={JSON.stringify(value.times)} />
      <input type="hidden" name="timeZone" value={value.timeZone} />
      <label className="he-when-label" htmlFor="he-when-notes">
        Anything to share before you meet? (optional)
      </label>
      <textarea id="he-when-notes" name="notes" rows={4} maxLength={2000} className="he-input he-when-notes" />
      {result && result.ok === false ? (
        <p role="alert" className="he-when-error">
          {result.error}
        </p>
      ) : null}
      <button type="submit" className="he-btn he-primary" disabled={pending}>
        {pending ? "Sending…" : "Send my times"}
      </button>
    </form>
  );
}
