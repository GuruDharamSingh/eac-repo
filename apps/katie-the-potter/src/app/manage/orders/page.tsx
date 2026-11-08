import Link from "next/link";
import type { Metadata } from "next";
import { listOrdersForStore } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Currency } from "@elkdonis/commerce/types";

const fm = (minor: number, currency: string) => formatMoney(minor, currency as Currency);
import type { Order } from "@elkdonis/commerce/types";
import { loadManageCtx } from "@/lib/manage";
import { orderPieceLabels } from "@/lib/manage-data";
import { OrderActions } from "@/components/manage/order-actions";
import { formatAddress } from "@/lib/address";
import { EmptyState, Notice, PageHeader, Toolbar } from "@elkdonis/cms-ui/manage";
import { advance, isQuoteFlow, LABEL_STATES, shipmentsForOrders, type ShipmentRow } from "@/lib/shipping/shipments";
import { daysLabel } from "@/lib/shipping/rates";
import { ShipThis, type ShipThisFacts } from "@/components/manage/ship-this";

/** Quote-only rows (Katie buys the label). */
const QUOTE_WORDS: Partial<Record<ShipmentRow["status"], string>> = {
  awaiting_payment: "Buyer chose shipping and is paying for it",
  in_transit: "Shipped",
  delivered: "Delivered",
};

function shipThisFacts(s: ShipmentRow, email: string | null, buyerName: string | null): ShipThisFacts | null {
  const c = s.chosenRate;
  if (!c) return null;
  const a = s.shipTo;
  const us = (a?.country ?? "").toUpperCase() === "US";
  const declared = s.parcels.reduce((t, p) => t + p.declared, 0);
  return {
    shipmentId: s.id,
    test: s.mode === "test",
    service: c.service,
    courier: c.courier,
    days: c.minDays == null && c.maxDays == null ? null : daysLabel(c),
    paid: fm(s.paidMinor ?? s.amountMinor ?? c.amountMinor, s.currency ?? c.currency),
    insured: s.insured,
    insuredFor: s.insured && declared > 0 ? fm(Math.round(declared * 100), s.parcels[0]?.currency ?? s.currency ?? "CAD") : null,
    quotedAt: c.quotedAt ? `quoted ${new Date(c.quotedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })}` : null,
    shipTo: [a?.recipientName || buyerName, a?.line1, a?.line2, [a?.city, a?.region, a?.postalCode].filter(Boolean).join(" "), us ? "United States" : a?.country === "CA" ? "Canada" : a?.country]
      .filter((x): x is string => Boolean(x && String(x).trim())),
    phone: a?.phone ?? null,
    email,
    parcels: s.parcels.map((p) => ({
      title: p.title,
      box: `${p.lengthCm} × ${p.widthCm} × ${p.heightCm} cm`,
      weight: `${p.weightKg} kg`,
      customs: us ? `customs: HS ${p.hsCode}, declared ${fm(Math.round(p.declared * 100), p.currency)}, made in Canada` : null,
    })),
  };
}

const SHIP_WORDS: Partial<Record<ShipmentRow["status"], string>> = {
  awaiting_payment: "Buyer chose shipping and is paying for the label",
  paid: "Shipping paid, buying the label",
  buying: "Buying the label",
  label_pending: "Label bought, document on its way",
  label_bought: "Label bought",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Label failed: arrange shipping by email",
  refunded: "Label failed, shipping refunded: arrange by email",
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

const FILTERS: Array<{ key: string; label: string; status?: Order["status"][] }> = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "Awaiting payment", status: ["awaiting_etransfer", "payment_received", "pending_payment"] },
  { key: "paid", label: "Paid, to ship", status: ["paid"] },
  { key: "shipped", label: "Shipped", status: ["fulfilled", "completed"] },
  { key: "closed", label: "Cancelled / refunded", status: ["cancelled", "refunded"] },
];

const STATUS: Record<string, { label: string; tone: "pending" | "ok" | "off" }> = {
  pending_payment: { label: "Card payment not completed", tone: "pending" },
  awaiting_etransfer: { label: "Awaiting eTransfer", tone: "pending" },
  payment_received: { label: "Payment received", tone: "pending" },
  paid: { label: "Paid", tone: "ok" },
  fulfilled: { label: "Shipped", tone: "ok" },
  completed: { label: "Completed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "off" },
  refunded: { label: "Refunded", tone: "off" },
};

export default async function ManageOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { store, canAct } = await loadManageCtx("/manage/orders");
  if (!store) {
    return (
      <section className="ktp-m-card">
        <h2>No store yet</h2>
        <p>Orders appear here once the store is open and someone buys. See Overview.</p>
      </section>
    );
  }

  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0]!;
  const orders = await listOrdersForStore(store.id, { limit: 100, status: filter.status });
  const labels = await orderPieceLabels(orders.map((o) => o.id));
  const shipments = await shipmentsForOrders(orders.map((o) => o.id)).catch(() => new Map<string, ShipmentRow>());
  // Catch up anything the buyer paid for but nobody came back to (the webhook
  // records the payment; buying the label happens here or on the return hop).
  for (const [orderId, s] of shipments) {
    if (s.status === "paid" || s.status === "awaiting_payment" || s.status === "label_pending") {
      shipments.set(orderId, await advance(s).catch(() => s));
    }
  }

  return (
    <>
      <PageHeader title="Orders" description="Confirm eTransfers when they arrive, mark orders shipped, cancel or refund." />
      <Toolbar>
      <nav className="ktp-m-filters" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/manage/orders" : `/manage/orders?status=${f.key}`} aria-current={f.key === filter.key ? "true" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      </Toolbar>

      {!canAct ? (
        <Notice>You can look, but only the store&rsquo;s owner or a manager can settle orders.</Notice>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState title={filter.key === "all" ? "No orders yet" : "Nothing here"} body={filter.key === "all" ? "When someone buys a piece, the order appears here." : "No orders match this filter."} />
      ) : (
        <ul className="ktp-m-list">
          {orders.map((o) => {
            const st = STATUS[o.status] ?? { label: o.status.replace(/_/g, " "), tone: "off" as const };
            return (
              <li key={o.id} className="ktp-m-order">
                <div className="ktp-m-order-main">
                  <p className="ktp-m-order-top">
                    <Link className="ktp-m-row-title" href={`/orders/${o.id}`}>
                      {o.number}
                    </Link>
                    <span className="ktp-m-badge" data-tone={st.tone}>
                      {st.label}
                    </span>
                  </p>
                  <p className="ktp-m-row-meta">
                    <span>{labels.get(o.id) ?? ""}</span>
                  </p>
                  <p className="ktp-m-row-meta">
                    <span>
                      {o.customerName ? `${o.customerName} · ` : ""}
                      {o.customerEmail?.trim() || "Email not given yet (Buy now: Stripe asks for it)"}
                    </span>
                    <span>{new Date(o.createdAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}</span>
                    <span>{o.paymentMethod === "stripe" ? "Card" : "eTransfer"}</span>
                  </p>
                  {formatAddress(o.shippingAddress) ? (
                    <p className="ktp-m-row-meta ktp-m-ship">
                      <span>Ship to: {formatAddress(o.shippingAddress)}</span>
                      {o.shippingAddress?.phone ? <span>{o.shippingAddress.phone}</span> : null}
                    </p>
                  ) : null}
                  {(() => {
                    const s = shipments.get(o.id);
                    if (!s) return null;
                    if (isQuoteFlow(s) && s.status === "paid") {
                      const f = shipThisFacts(s, o.customerEmail?.trim() || null, o.customerName ?? null);
                      return f ? <ShipThis f={f} canAct={canAct} /> : null;
                    }
                    return <ShipLine s={s} />;
                  })()}
                </div>
                <div className="ktp-m-order-side">
                  <p className="ktp-m-price">{fm(o.totalMinor, o.currency)}</p>
                  {canAct ? (
                    <OrderActions
                      id={o.id}
                      status={o.status}
                      payment={o.paymentMethod}
                      tracking={(() => {
                        const s = shipments.get(o.id);
                        return s && (LABEL_STATES as string[]).includes(s.status) && s.trackingNumber ? `${s.courierName ?? "Tracking"} ${s.trackingNumber}` : null;
                      })()}
                      hideShip={(() => {
                        const s = shipments.get(o.id);
                        return Boolean(s && isQuoteFlow(s) && s.status === "paid");
                      })()}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ShipLine({ s }: { s: ShipmentRow }) {
  if (isQuoteFlow(s)) {
    const word = QUOTE_WORDS[s.status];
    if (!word) return null;
    return (
      <div className="ktp-m-shipline" data-tone={s.status === "awaiting_payment" ? "pending" : "ok"}>
        <p className="ktp-m-row-meta">
          <span>
            {s.mode === "test" ? <b className="ktp-m-badge" data-tone="off">Test</b> : null} {word}: {s.status === "awaiting_payment" ? s.chosenRate?.service : s.courierName}
            {s.trackingNumber ? <>, tracking <span className="ktp-m-mono">{s.trackingNumber}</span></> : null}
          </span>
          {s.paidMinor && s.currency ? <span>Buyer paid {fm(s.paidMinor, s.currency)} for shipping</span> : null}
        </p>
        {s.trackingUrl ? (
          <p className="ktp-m-row-links">
            <a className="ktp-m-linkbtn" href={s.trackingUrl} target="_blank" rel="noopener noreferrer">
              Tracking page
            </a>
          </p>
        ) : null}
      </div>
    );
  }
  const hasLabel = (LABEL_STATES as string[]).includes(s.status);
  const word = SHIP_WORDS[s.status];
  if (!word) return null;
  return (
    <div className="ktp-m-shipline" data-tone={s.status === "failed" || s.status === "refunded" ? "warn" : hasLabel ? "ok" : "pending"}>
      <p className="ktp-m-row-meta">
        <span>
          {s.mode === "test" ? <b className="ktp-m-badge" data-tone="off">Test</b> : null} {word}
          {hasLabel ? <>: {s.courierName ?? s.chosenRate?.service}</> : null}
          {s.trackingNumber ? <>, tracking <span className="ktp-m-mono">{s.trackingNumber}</span></> : null}
          {s.trackingStatus ? <> ({s.trackingStatus})</> : null}
        </span>
        {s.paidMinor && s.currency ? <span>Buyer paid {fm(s.paidMinor, s.currency)}{s.insured ? " insured" : ""}</span> : null}
        {s.labelCostMinor != null && s.labelCurrency ? <span>Label cost {fm(s.labelCostMinor, s.labelCurrency)}</span> : null}
      </p>
      {hasLabel ? (
        <p className="ktp-m-row-links">
          {s.labelUrl ? (
            <a className="ktp-btn ktp-btn--sm" href={`/api/shipping/label/${s.id}`} target="_blank" rel="noopener">
              Download label (PDF)
            </a>
          ) : null}
          {s.trackingUrl ? (
            <a className="ktp-m-linkbtn" href={s.trackingUrl} target="_blank" rel="noopener noreferrer">
              Tracking page
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
