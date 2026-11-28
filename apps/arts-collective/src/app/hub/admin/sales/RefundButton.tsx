"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { refundSaleAction } from "./actions";

/** Refund control with a confirm step: first click opens the reason box, second click performs it. */
export function RefundButton({
  orderId,
  number,
  amount,
  card,
}: {
  orderId: string;
  number: string;
  amount: string;
  card: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        Refund…
      </button>
    );
  }
  return (
    <div className="w-64 space-y-2 rounded-md border border-border bg-card p-3 text-left text-xs">
      <p className="font-medium">
        Refund {number} in full ({amount})?
      </p>
      <p className="text-muted-foreground">
        {card
          ? "The card is refunded through Stripe and the sale is reversed in the ledger. This cannot be undone."
          : "Not a card order: the refund is recorded only. The money moves by hand."}
      </p>
      <label className="block">
        <span className="text-muted-foreground">Reason (kept on the order)</span>
        <input
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          className="rounded-md border border-destructive/50 px-2 py-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await refundSaleAction(orderId, reason);
              if (r.ok === false) setError(r.error);
              else router.refresh();
            } catch {
              setError("Failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Refunding…" : "Confirm refund"}
        </button>
        <button type="button" disabled={busy} className="rounded-md border border-border px-2 py-1" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
