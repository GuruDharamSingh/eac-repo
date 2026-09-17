import Link from "next/link";
import type { Metadata } from "next";
import { listOrders } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Order } from "@elkdonis/commerce/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { OrderActions } from "@/app/studio/_components/order-actions";
import {
  adminCancelOrder,
  adminConfirmOrder,
  adminFulfilOrder,
  adminRefundOrder,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders · Admin" };

const ORDER_STATUS_TONE: Record<Order["status"], BadgeProps["tone"]> = {
  draft: "neutral",
  pending_payment: "pending",
  awaiting_etransfer: "pending",
  payment_received: "success",
  paid: "success",
  fulfilled: "success",
  completed: "success",
  cancelled: "neutral",
  refunded: "neutral",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminOrdersPage() {
  const orders = await listOrders({ limit: 25 });
  const orderActions = {
    confirm: adminConfirmOrder,
    cancel: adminCancelOrder,
    fulfil: adminFulfilOrder,
    refund: adminRefundOrder,
  };

  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">
        Recent orders
        <span className="ml-2 text-base text-muted-foreground">({orders.length})</span>
      </h2>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No orders yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {o.paymentMethod === "stripe" ? "card" : o.paymentMethod}
                      {typeof o.metadata?.kind === "string" ? ` · ${o.metadata.kind}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {o.customerName?.trim() || o.customerEmail}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{o.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(o.totalMinor, o.currency)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <OrderActions order={o} actions={orderActions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
