"use client";

import { useState } from "react";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import { PrimaryButton } from "@/components/mobile";
import { cancelSlot, closeSlotNow, reopenSlot, runSlot, type RefundDue } from "@/lib/slot-actions";
import type { BoardSlot } from "@/lib/tour-slots";
import { clock, dayShort, dayKey, money } from "./board-ui";
import "./board.css";

type Key = "run" | "reopen" | "close" | "cancel";

/**
 * The slot's decisions, shared by the Slot page and the Decisions list (screens 33 and 34).
 * Below the minimum: Run it / Reopen booking for 24 hours / Cancel and refund. Open: Close booking now.
 * Any live slot can be cancelled; the confirm step is drawn here (never a browser confirm()).
 * Every action's returned error is shown inline and as a toast; success is a toast plus a short result line.
 * Cancelling does not refund by itself: the action returns what is due and this shows it (refund is an owner tap).
 * The waitlist is off, so there is no Offer button.
 */
export function SlotActions({ slot, onChanged }: { slot: BoardSlot; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ message: string; refunds: RefundDue[] } | null>(null);

  const scheduled = slot.status === "scheduled";
  const live = scheduled && slot.stateKey !== "past";
  const below = live && slot.stateKey === "below";
  const open = live && slot.state === "open";
  const guests = slot.seatsTaken;
  const guestWord = guests === 1 ? "guest" : "guests";

  async function go(key: Key, run: () => Promise<{ ok: boolean; error?: string; closesAt?: string }>, text: string | ((r: { closesAt?: string }) => string)) {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      const r = await run();
      if (!r.ok) {
        const msg = r.error ?? "That did not work.";
        setError(msg);
        failToast(msg);
        return;
      }
      const message = typeof text === "function" ? text(r) : text;
      toast.success(message);
      setDone({ message, refunds: [] });
      await onChanged();
    } catch {
      setError("Something went wrong. Try again.");
      toast.error("Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    setDone(null);
    try {
      const r = await cancelSlot(slot.slotId, reason.trim() || undefined);
      if (!r.ok) {
        setError(r.error);
        failToast(r.error);
        return;
      }
      const n = r.notified;
      const message = `Slot cancelled. ${n === 0 ? "No guests to tell." : `${n} ${n === 1 ? "booking" : "bookings"} cancelled and emailed.`}`;
      toast.success(message);
      setAsking(false);
      setDone({ message, refunds: r.refundsDue });
      await onChanged();
    } catch {
      setError("Something went wrong. Try again.");
      toast.error("Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  // The action returns the real new close time (24 h from now, or the start when that is nearer).
  const reopenMessage = (r: { closesAt?: string }) =>
    r.closesAt ? `Booking is open again until ${dayShort(dayKey(r.closesAt))}, ${clock(r.closesAt)}.` : "Booking is open again.";

  const disabled = busy !== null;
  return (
    <div className="b-acts">
      {below ? (
        <>
          <PrimaryButton disabled={disabled} onClick={() => go("run", () => runSlot(slot.slotId), `Running with ${guests} ${guestWord}. They have been told.`)}>
            {busy === "run" ? "Working..." : `Run it with ${guests} ${guestWord}`}
          </PrimaryButton>
          <button type="button" className="b-act" disabled={disabled} onClick={() => go("reopen", () => reopenSlot(slot.slotId, { hours: 24 }), reopenMessage)}>
            {busy === "reopen" ? "Working..." : "Reopen booking for 24 hours"}
          </button>
        </>
      ) : null}
      {open && !closing ? (
        <button type="button" className="b-act" disabled={disabled} onClick={() => setClosing(true)}>
          Close booking now
        </button>
      ) : null}
      {open && closing ? (
        <div className="b-confirm" role="alertdialog" aria-label="Confirm close booking">
          <p>Close booking now? Nobody else can book, and the guest list is fixed at {guests} {guestWord}. You cannot undo this here.</p>
          <div className="b-confirm-row">
            <button
              type="button"
              className="b-act b-act-solid-danger"
              disabled={disabled}
              onClick={async () => {
                await go("close", () => closeSlotNow(slot.slotId), "Booking is closed. The guest list is fixed.");
                setClosing(false);
              }}
            >
              {busy === "close" ? "Closing..." : "Yes, close it"}
            </button>
            <button type="button" className="b-act" disabled={disabled} onClick={() => setClosing(false)}>
              Keep it open
            </button>
          </div>
        </div>
      ) : null}

      {live && !asking ? (
        <button type="button" className={below ? "b-act b-act-danger" : "b-act b-act-quiet"} disabled={disabled} onClick={() => setAsking(true)}>
          {below && guests > 0 ? `Cancel and refund ${guests} ${guestWord}` : "Cancel this slot"}
        </button>
      ) : null}
      {live && asking ? (
        <div className="b-confirm" role="alertdialog" aria-label="Confirm cancel">
          <p>
            {guests > 0
              ? `Cancel this slot? ${guests} ${guestWord} will be emailed. Payments are not refunded by this button: you will see exactly what is due, to refund from each order.`
              : "Cancel this slot? Nobody has booked it."}
          </p>
          <input className="b-reason" placeholder="A note for the guests (optional)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} aria-label="Note for the guests" />
          <div className="b-confirm-row">
            <button type="button" className="b-act b-act-solid-danger" disabled={disabled} onClick={cancel}>
              {busy === "cancel" ? "Cancelling..." : "Yes, cancel the slot"}
            </button>
            <button type="button" className="b-act" disabled={disabled} onClick={() => setAsking(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="b-err" role="alert">{error}</p> : null}
      {done ? (
        <div className="b-ok" role="status">
          {done.message}
          {done.refunds.length > 0 ? (
            <>
              <p style={{ margin: "8px 0 0" }}>Refund these yourself (nothing was sent to Stripe):</p>
              <ul className="b-refunds">
                {done.refunds.map((x) => (
                  <li key={x.bookingId}>
                    {x.name ?? x.email} · {money(x.totalMinor, x.currency)}
                    {x.orderNumber ? ` · order ${x.orderNumber}` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : done.message.startsWith("Slot cancelled") ? (
            <p style={{ margin: "8px 0 0" }}>No payments to refund.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
