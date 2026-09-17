import Link from "next/link";
import type { Metadata } from "next";
import { listOrdersForStore } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Order } from "@elkdonis/commerce/types";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { OrderActions } from "../_components/order-actions";
import {
  cancelOrderAction,
  confirmOrderPaidAction,
  fulfilOrderAction,
  refundOrderAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales · Studio" };

const ORDER_STATUS: Record<Order["status"], { label: string; tone: BadgeProps["tone"] }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_payment: { label: "Card — not paid yet", tone: "pending" },
  awaiting_etransfer: { label: "Awaiting eTransfer", tone: "pending" },
  payment_received: { label: "Payment received", tone: "success" },
  paid: { label: "Paid — ship it", tone: "success" },
  fulfilled: { label: "Shipped", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  refunded: { label: "Refunded", tone: "neutral" },
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function StudioSalesPage() {
  const { store } = await requireStudioStore();
  const isOwn = store.ownerKind === "user";
  const canManageSales = isOwn || store.myRole === "owner" || store.myRole === "manager";
  const orderActions = {
    confirm: confirmOrderPaidAction,
    cancel: cancelOrderAction,
    fulfil: fulfilOrderAction,
    refund: refundOrderAction,
  };

  const orders = await listOrdersForStore(store.id, { limit: 50 });

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-tight">
          Sales
          <span className="ml-2 text-base text-muted-foreground">({orders.length})</span>
        </h2>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No orders yet. When someone buys a piece — or wins one at auction —
          it shows up here for you to confirm payment and ship.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Buyer</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => {
                const st = ORDER_STATUS[o.status];
                return (
                  <tr key={o.id} className="align-middle hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link href={`/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                        {o.number}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(o.createdAt)} · {o.paymentMethod === "stripe" ? "card" : o.paymentMethod}
                        {o.metadata?.kind === "auction" ? " · auction" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {o.customerName?.trim() || o.customerEmail}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(o.totalMinor, o.currency)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canManageSales && <OrderActions order={o} actions={orderActions} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
