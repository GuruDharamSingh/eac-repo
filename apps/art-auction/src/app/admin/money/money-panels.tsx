"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  adminRecordPayout,
  adminReleaseHold,
  adminSaveMarketplaceSettings,
  adminApprovePayee,
} from "../actions";

const inputCls =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type OwedRow = {
  partyKind: "user" | "org" | "payee" | "platform";
  partyId: string;
  partyName: string;
  payableMajor: number;
  heldMajor: number;
  currency: string;
  owedSince: string | null;
  payoutMethod: string | null;
  payoutEmail: string | null;
};

/** The settle-up queue: who is owed, and a form to record that they were paid. */
export function OwedTable({ rows }: { rows: OwedRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(r: OwedRow, form: FormData) {
    setBusy(true);
    setError(null);
    const res = await adminRecordPayout({
      partyKind: r.partyKind === "platform" ? "org" : r.partyKind,
      partyId: r.partyId,
      amountMajor: Number(form.get("amount") ?? 0),
      method: String(form.get("method") ?? "etransfer"),
      reference: String(form.get("reference") ?? ""),
      note: String(form.get("note") ?? ""),
    });
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed.");
    else {
      setOpen(null);
      router.refresh();
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nobody is owed anything payable right now.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Party</th>
            <th className="px-4 py-2 font-medium">Pay by</th>
            <th className="px-4 py-2 font-medium">Owed since</th>
            <th className="px-4 py-2 text-right font-medium">Payable</th>
            <th className="px-4 py-2 text-right font-medium">Held</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const key = `${r.partyKind}:${r.partyId}`;
            return (
              <React.Fragment key={key}>
                <tr>
                  <td className="px-4 py-2">
                    {r.partyName}
                    <span className="ml-1 text-xs text-muted-foreground">({r.partyKind})</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.payoutMethod ?? (r.partyKind === "user" ? "—" : "transfer")}
                    {r.payoutEmail ? ` · ${r.payoutEmail}` : ""}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.owedSince ? new Date(r.owedSince).toLocaleDateString("en-CA") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.payableMajor.toFixed(2)} {r.currency}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {r.heldMajor > 0 ? `${r.heldMajor.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs underline underline-offset-4"
                      onClick={() => setOpen(open === key ? null : key)}
                    >
                      {open === key ? "Close" : "Record payout"}
                    </button>
                  </td>
                </tr>
                {open === key && (
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="px-4 py-3">
                      <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submit(r, new FormData(e.currentTarget));
                        }}
                      >
                        <label className="flex flex-col text-xs">
                          Amount ({r.currency})
                          <input name="amount" type="number" step="0.01" min="0.01" defaultValue={r.payableMajor.toFixed(2)} className={inputCls} required />
                        </label>
                        <label className="flex flex-col text-xs">
                          Method
                          <select name="method" defaultValue={r.payoutMethod ?? "etransfer"} className={inputCls}>
                            <option value="etransfer">eTransfer</option>
                            <option value="cheque">Cheque</option>
                            <option value="wire">Wire</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className="flex flex-col text-xs">
                          Reference
                          <input name="reference" className={inputCls} placeholder="confirmation no." />
                        </label>
                        <label className="flex flex-col text-xs">
                          Note
                          <input name="note" className={inputCls} />
                        </label>
                        <Button type="submit" size="sm" disabled={busy}>
                          {busy ? "Saving…" : "Save payout"}
                        </Button>
                        {error && <p className="w-full text-xs text-destructive">{error}</p>}
                      </form>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReleaseButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      className="text-xs underline underline-offset-4"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Release this hold? The amount becomes payable.")) return;
        setBusy(true);
        const r = await adminReleaseHold(entryId);
        setBusy(false);
        if (!r.ok) window.alert(r.error ?? "Failed.");
        else router.refresh();
      }}
    >
      {busy ? "…" : "Release"}
    </button>
  );
}

export function SettingsForm({
  defaultCommissionRate,
  softCloseMinutes,
  paymentWindowHours,
}: {
  defaultCommissionRate: number;
  softCloseMinutes: number;
  paymentWindowHours: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setMsg(null);
        const r = await adminSaveMarketplaceSettings({
          defaultCommissionRate: Number(f.get("commission")),
          softCloseMinutes: Number(f.get("softClose")),
          paymentWindowHours: Number(f.get("paymentWindow")),
          applyToStores: f.get("applyToStores") === "on",
        });
        setBusy(false);
        setMsg(r.ok ? "Saved." : r.error ?? "Failed.");
        if (r.ok) router.refresh();
      }}
    >
      <label className="flex flex-col text-xs">
        Commission %
        <input name="commission" type="number" step="0.5" min="0" max="100" defaultValue={defaultCommissionRate} className={inputCls} />
      </label>
      <label className="flex flex-col text-xs">
        Soft close (min)
        <input name="softClose" type="number" min="0" defaultValue={softCloseMinutes} className={inputCls} />
      </label>
      <label className="flex flex-col text-xs">
        Payment window (h)
        <input name="paymentWindow" type="number" min="1" defaultValue={paymentWindowHours} className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input name="applyToStores" type="checkbox" /> Apply the commission to personal stores still on the old default
      </label>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      {msg && <p className="w-full text-xs text-muted-foreground">{msg}</p>}
    </form>
  );
}

export function ApprovePayeeButton({ payeeId }: { payeeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      className="text-xs underline underline-offset-4"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await adminApprovePayee(payeeId);
        setBusy(false);
        if (!r.ok) window.alert(r.error ?? "Failed.");
        else router.refresh();
      }}
    >
      {busy ? "…" : "Approve"}
    </button>
  );
}
