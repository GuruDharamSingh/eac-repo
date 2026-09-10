"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Order } from "@elkdonis/commerce/types";

type Result = { ok: boolean; error?: string };

export interface OrderActionSet {
  confirm: (orderId: string, reference?: string) => Promise<Result>;
  cancel: (orderId: string, reason?: string) => Promise<Result>;
  fulfil: (orderId: string, note?: string) => Promise<Result>;
  /** Full refund. Omit where the caller cannot issue one (e.g. card orders in the studio). */
  refund?: (orderId: string, reason?: string) => Promise<Result>;
}

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

  async function run(fn: () => Promise<Result>, success: string) {
    setPending(true);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    } finally {
      setPending(false);
    }
  }

  const btn =
    "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50";
  const primary =
    "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";

  const unpaid =
    order.status === "awaiting_etransfer" ||
    order.status === "pending_payment" ||
    order.status === "payment_received";

  if (unpaid) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {order.paymentMethod === "etransfer" && (
          <button
            type="button"
            disabled={pending}
            className={primary}
            onClick={() => {
              const ref = window.prompt(
                `Confirm the eTransfer for ${order.number} arrived. Optional: the transfer reference.`,
                ""
              );
              if (ref === null) return;
              void run(() => actions.confirm(order.id, ref), "Marked paid — the piece is sold.");
            }}
          >
            {pending ? "…" : "Payment received"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => {
            if (!window.confirm(`Cancel ${order.number} and put the piece back on sale?`)) return;
            void run(() => actions.cancel(order.id), "Order cancelled; the piece is available again.");
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  const refundBtn = actions.refund && (order.status === "paid" || order.status === "fulfilled") && (
    <button
      type="button"
      disabled={pending}
      className={btn}
      onClick={() => {
        const reason = window.prompt(
          `Refund ${order.number} in full and put the piece back on sale? Optional: reason.`,
          ""
        );
        if (reason === null) return;
        void run(() => actions.refund!(order.id, reason), "Refunded; the piece is available again.");
      }}
    >
      Refund
    </button>
  );

  if (order.status === "paid") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          className={primary}
          onClick={() => {
            const note = window.prompt("Mark as shipped. Optional: carrier / tracking note.", "");
            if (note === null) return;
            void run(() => actions.fulfil(order.id, note), "Marked shipped.");
          }}
        >
          {pending ? "…" : "Mark shipped"}
        </button>
        {refundBtn}
      </div>
    );
  }

  if (order.status === "fulfilled" && refundBtn) {
    return <div className="flex items-center gap-2">{refundBtn}</div>;
  }

  return null;
}
