import Link from "next/link";
import type { Metadata } from "next";
import { listOrdersForStore } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Order } from "@elkdonis/commerce/types";
import { loadManageCtx } from "@/lib/manage";
import { orderPieceLabels } from "@/lib/manage-data";
import { OrderActions } from "@/components/manage/order-actions";
import { formatAddress } from "@/lib/address";
import { EmptyState, Notice, PageHeader, Toolbar } from "@elkdonis/cms-ui/manage";

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
                </div>
                <div className="ktp-m-order-side">
                  <p className="ktp-m-price">{formatMoney(o.totalMinor, o.currency)}</p>
                  {canAct ? <OrderActions id={o.id} status={o.status} payment={o.paymentMethod} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
