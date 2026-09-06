"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { releaseHoldAction } from "@/lib/ledger-actions";

export type HeldRow = {
  id: string;
  partyName: string | null;
  partyKind: string;
  amountMinor: number;
  currency: string;
  holdReason: string | null;
  note: string | null;
  createdAt: string;
  orderId: string | null;
};

const REASON_COPY: Record<string, string> = {
  no_payout_account: "Waiting on the payee to finish payout setup",
  below_threshold: "Under the minimum payout amount",
  org_unowned: "The organisation has no owner yet",
  dispute_window: "Refund window has not elapsed",
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    minor / 100
  );
}

export function HeldFundsTable({ rows }: { rows: HeldRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nothing is being held. Every accrued amount is payable.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Owed to</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Why it is held</th>
              <th className="px-4 py-2 font-medium">Since</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{r.partyName ?? "—"}</span>
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {r.partyKind}
                  </span>
                  {r.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums">
                  {money(r.amountMinor, r.currency)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {REASON_COPY[r.holdReason ?? ""] ?? r.holdReason}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busy === r.id}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
                    onClick={async () => {
                      setBusy(r.id);
                      setError(null);
                      try {
                        const res = await releaseHoldAction(r.id);
                        if (!res.ok) setError(res.error ?? "Failed.");
                        else router.refresh();
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Release
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Releasing does not move money &mdash; it marks the amount payable and
        records who decided that. The original entry keeps saying why it was
        held, because nothing in the ledger is ever edited.
      </p>
    </div>
  );
}
