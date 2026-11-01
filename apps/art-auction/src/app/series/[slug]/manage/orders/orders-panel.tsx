"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SeriesOrderRow, HandoverMethod } from "@elkdonis/commerce/server";
import { setHandoverAction, setReceivedAction, confirmPaidAction, recordArtistPayoutAction } from "./actions";

const money = (n: number | null | undefined, c = "CAD") =>
  n == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100);
const day = (d: string) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

function PaidPill({ row }: { row: SeriesOrderRow }) {
  const o = row.order!;
  if (o.paidAt) {
    const rail = o.paymentMethod === "stripe" ? "Card" : o.paymentMethod === "etransfer" ? "E-transfer" : "Manual";
    return <span className="sw-pill is-ok">{rail} · {day(o.paidAt)}</span>;
  }
  if (o.status === "cancelled") return <span className="sw-pill is-bad">Window lapsed</span>;
  if (o.dueAt) {
    const h = Math.round((new Date(o.dueAt).getTime() - Date.now()) / 3_600_000);
    return h > 0 ? <span className="sw-pill is-warn">Due in {h} h</span> : <span className="sw-pill is-bad">Overdue</span>;
  }
  return <span className="sw-pill is-warn">Awaiting payment</span>;
}

function OrderRow({ row, seriesId, slug, canConfirm, isAdmin }: { row: SeriesOrderRow; seriesId: string; slug: string; canConfirm: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const o = row.order;
  const [busy, setBusy] = React.useState(false);
  const [method, setMethod] = React.useState<HandoverMethod | "">(o?.handover?.method ?? "");
  const [tracking, setTracking] = React.useState(o?.handover?.tracking ?? "");

  async function run(p: Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Failed.");
    if (ok) toast.success(ok);
    router.refresh();
  }

  const paid = Boolean(o?.paidAt);
  const received = Boolean(o?.receivedAt || o?.fulfilledAt);
  const makerNote = row.donated
    ? "donated"
    : row.makerStripe
      ? "Stripe"
      : row.makerHasPayoutMethod
        ? "e-transfer payouts"
        : "no payout method";

  return (
    <tr className={paid && !received ? "is-highlight" : undefined}>
      <td>
        <div className="sw-cell-art">
          {row.imageUrl ? <img src={row.imageUrl} alt="" className="sw-thumb" /> : <span className="sw-thumb" />}
          <div>
            <strong>{row.lotNumber ?? "—"} · <a href={`/lots/${row.lotId}`}>{row.title}</a></strong>
            <div className="sw-muted">{row.artistName ?? "—"} · {makerNote}</div>
          </div>
        </div>
      </td>
      <td>{o ? o.buyerName ?? "—" : <span className="sw-muted">{row.lotStatus === "passed" ? "Passed (no sale)" : row.lotStatus}</span>}</td>
      <td className="is-num">{money(o?.totalMinor ?? row.hammerMinor, row.currency)}</td>
      <td>
        {o ? <PaidPill row={row} /> : <span className="sw-muted">—</span>}
        {o && !paid && o.status !== "cancelled" && canConfirm && (
          <div style={{ marginTop: 6 }}>
            <button
              type="button"
              className="sw-link"
              disabled={busy}
              onClick={() => {
                const ref = window.prompt("Mark paid by e-transfer or cash. Reference (optional):") ;
                if (ref === null) return;
                run(confirmPaidAction(seriesId, slug, o.id, "etransfer", ref), "Marked paid.");
              }}
            >
              Mark paid…
            </button>
          </div>
        )}
      </td>
      <td>
        {o && paid ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 190 }}>
            <select
              aria-label={`Hand-over for lot ${row.lotNumber ?? ""}`}
              className="sw-select"
              style={{ minHeight: 36 }}
              value={method}
              disabled={busy}
              onChange={(e) => {
                const m = e.target.value as HandoverMethod | "";
                setMethod(m);
                if (m && m !== "shipped") run(setHandoverAction(seriesId, slug, o.id, m));
              }}
            >
              <option value="">Choose…</option>
              <option value="pickup">Pickup at the live close</option>
              <option value="shipped">Shipped</option>
              <option value="artist">Delivered by artist</option>
            </select>
            {method === "shipped" && (
              <span style={{ display: "flex", gap: 6 }}>
                <input
                  className="sw-input"
                  style={{ minHeight: 36 }}
                  aria-label="Tracking number"
                  placeholder="Tracking no."
                  value={tracking ?? ""}
                  onChange={(e) => setTracking(e.target.value)}
                />
                <button type="button" className="sw-btn is-small is-outline" disabled={busy} onClick={() => run(setHandoverAction(seriesId, slug, o.id, "shipped", tracking), "Saved.")}>Save</button>
              </span>
            )}
          </div>
        ) : (
          <span className="sw-muted">—</span>
        )}
      </td>
      <td>
        {o && paid ? (
          <label className="sw-check">
            <input type="checkbox" checked={received} disabled={busy} onChange={(e) => run(setReceivedAction(seriesId, slug, o.id, e.target.checked))} />
            <span>{received ? `Received${o.receivedAt ? " " + day(o.receivedAt) : ""}` : "Received"}</span>
          </label>
        ) : (
          <span className="sw-muted">—</span>
        )}
      </td>
      <td>
        {!o || !paid ? (
          <span className="sw-muted">—</span>
        ) : row.donated ? (
          <span className="sw-muted">n/a (donated)</span>
        ) : o.makerPaidAtSource ? (
          <span className="sw-pill is-ok">Paid at sale{o.paymentMethod === "stripe" ? " · Stripe" : ""}</span>
        ) : (
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="sw-pill is-warn">Owed {money(o.makerShareMinor, row.currency)}</span>
            {isAdmin && row.makerUserId && (
              <RecordPayoutButton seriesId={seriesId} slug={slug} artistUserId={row.makerUserId} artistName={row.artistName ?? "the artist"} suggestedMinor={o.makerShareMinor} />
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

export function OrdersTable({ rows, seriesId, slug, confirmable, isAdmin }: { rows: SeriesOrderRow[]; seriesId: string; slug: string; confirmable: string[]; isAdmin: boolean }) {
  const can = new Set(confirmable);
  return (
    <div className="sw-table-wrap">
      <table className="sw-table" style={{ minWidth: 1040 }}>
        <thead>
          <tr>
            <th>Lot</th>
            <th>Buyer</th>
            <th className="is-num">Hammer</th>
            <th>Buyer paid</th>
            <th>Hand-over</th>
            <th>Buyer has it</th>
            <th>Artist paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <OrderRow key={r.lotId} row={r} seriesId={seriesId} slug={slug} canConfirm={Boolean(r.order && can.has(r.order.id))} isAdmin={isAdmin} />
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="sw-muted" style={{ textAlign: "center", padding: 28 }}>No lots in this view. Sold lots appear here once the series closes.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Record money handed to an artist outside Stripe (recordPayout). Network admins only. */
export function RecordPayoutButton({
  seriesId,
  slug,
  artistUserId,
  artistName,
  suggestedMinor,
}: {
  seriesId: string;
  slug: string;
  artistUserId: string;
  artistName: string;
  suggestedMinor: number;
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <>
      <button type="button" className="sw-btn is-small is-outline" onClick={() => ref.current?.showModal()}>Record payout…</button>
      <dialog ref={ref} className="sw-dialog sw" style={{ minHeight: 0 }}>
        <form
          className="sw-dialog-body"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            const r = await recordArtistPayoutAction({
              seriesId,
              slug,
              artistUserId,
              amountMajor: Number(fd.get("amount")),
              method: String(fd.get("method") ?? "etransfer"),
              reference: String(fd.get("reference") ?? ""),
              note: String(fd.get("note") ?? ""),
            });
            setBusy(false);
            if (!r.ok) return toast.error(r.error ?? "Could not record the payout.");
            toast.success("Payout recorded.");
            ref.current?.close();
            router.refresh();
          }}
        >
          <h2 className="sw-h2" style={{ margin: 0 }}>Record a payout to {artistName}</h2>
          <p className="sw-muted" style={{ margin: 0 }}>Records money already sent outside Stripe. It cannot exceed what is payable to them; held amounts are released in Admin → Money first.</p>
          <label className="sw-field"><span className="sw-label">Amount ($)</span><input name="amount" type="number" step="0.01" min="0.01" required className="sw-input" defaultValue={(suggestedMinor / 100).toFixed(2)} /></label>
          <label className="sw-field">
            <span className="sw-label">Method</span>
            <select name="method" className="sw-select" defaultValue="etransfer">
              <option value="etransfer">E-transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="wire">Wire</option>
            </select>
          </label>
          <label className="sw-field"><span className="sw-label">Reference</span><input name="reference" className="sw-input" placeholder="Confirmation number" /></label>
          <label className="sw-field"><span className="sw-label">Note</span><input name="note" className="sw-input" /></label>
          <div className="sw-dialog-foot">
            <button type="button" className="sw-btn is-quiet" onClick={() => ref.current?.close()}>Cancel</button>
            <button type="submit" className="sw-btn" disabled={busy}>{busy ? "Saving…" : "Record payout"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
