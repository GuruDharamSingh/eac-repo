"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Order } from "@elkdonis/commerce/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Result = { ok: boolean; error?: string };

export interface OrderActionSet {
  confirm: (orderId: string, reference?: string) => Promise<Result>;
  cancel: (orderId: string, reason?: string) => Promise<Result>;
  fulfil: (orderId: string, note?: string) => Promise<Result>;
  /** Full refund. Omit where the caller cannot issue one (e.g. card orders in the studio). */
  refund?: (orderId: string, reason?: string) => Promise<Result>;
}

type DialogKind = "confirm" | "cancel" | "fulfil" | "refund" | null;

/**
 * The seller's (or admin's) controls on one order. Headless about WHICH
 * server actions it calls so the studio and the admin console — different
 * guards — share one component.
 *
 *   awaiting eTransfer → "Payment received" · Cancel
 *   card, not paid     → Cancel (Stripe confirms card payments itself)
 *   paid               → "Mark shipped"
 */
export function OrderActions({
  order,
  actions,
}: {
  order: Pick<Order, "id" | "status" | "paymentMethod" | "number">;
  actions: OrderActionSet;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [dialog, setDialog] = React.useState<DialogKind>(null);

  async function run(fn: () => Promise<Result>, success: string) {
    setPending(true);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        setDialog(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    } finally {
      setPending(false);
    }
  }

  const unpaid =
    order.status === "awaiting_etransfer" ||
    order.status === "pending_payment" ||
    order.status === "payment_received";

  const refundAvailable =
    actions.refund && (order.status === "paid" || order.status === "fulfilled");

  const refundButton = refundAvailable && (
    <Button type="button" variant="outline" size="sm" onClick={() => setDialog("refund")}>
      Refund
    </Button>
  );

  return (
    <>
      {unpaid && (
        <div className="flex flex-wrap items-center gap-2">
          {order.paymentMethod === "etransfer" && (
            <Button type="button" size="sm" onClick={() => setDialog("confirm")}>
              Payment received
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog("cancel")}>
            Cancel
          </Button>
        </div>
      )}

      {order.status === "paid" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => setDialog("fulfil")}>
            Mark shipped
          </Button>
          {refundButton}
        </div>
      )}

      {order.status === "fulfilled" && refundButton && (
        <div className="flex items-center gap-2">{refundButton}</div>
      )}

      <ConfirmDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => setDialog(open ? "confirm" : null)}
        title="Confirm the eTransfer arrived"
        description={`Mark ${order.number} as paid — the piece is sold.`}
        field={{ label: "Transfer reference (optional)" }}
        confirmLabel="Payment received"
        pending={pending}
        onConfirm={(ref) => void run(() => actions.confirm(order.id, ref), "Marked paid — the piece is sold.")}
      />

      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        title="Cancel this order?"
        description={`${order.number} will be cancelled and the piece put back on sale.`}
        confirmLabel="Cancel order"
        tone="destructive"
        pending={pending}
        onConfirm={() => void run(() => actions.cancel(order.id), "Order cancelled; the piece is available again.")}
      />

      <ConfirmDialog
        open={dialog === "fulfil"}
        onOpenChange={(open) => setDialog(open ? "fulfil" : null)}
        title="Mark as shipped"
        field={{ label: "Carrier / tracking note (optional)" }}
        confirmLabel="Mark shipped"
        pending={pending}
        onConfirm={(note) => void run(() => actions.fulfil(order.id, note), "Marked shipped.")}
      />

      {actions.refund && (
        <ConfirmDialog
          open={dialog === "refund"}
          onOpenChange={(open) => setDialog(open ? "refund" : null)}
          title="Refund this order?"
          description={`${order.number} will be refunded in full and the piece put back on sale.`}
          field={{ label: "Reason (optional)" }}
          confirmLabel="Refund"
          tone="destructive"
          pending={pending}
          onConfirm={(reason) =>
            void run(() => actions.refund!(order.id, reason), "Refunded; the piece is available again.")
          }
        />
      )}
    </>
  );
}
