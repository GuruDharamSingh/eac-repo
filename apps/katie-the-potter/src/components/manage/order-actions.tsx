"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@elkdonis/cms-ui/manage/client";
import { cancelOrderAction, confirmEtransferAction, refundOrderAction, shipOrderAction, type ActionResult } from "@/lib/manage-actions";

type Kind = "confirm" | "ship" | "cancel" | "refund";

const CONFIRM_COPY: Record<Kind, string> = {
  confirm: "Mark this order as paid? Do this only once the eTransfer has arrived in your bank.",
  ship: "Mark this order as shipped?",
  cancel: "Cancel this order? The piece goes back on sale and the buyer's reservation is released.",
  refund: "Record this eTransfer order as refunded? Do this only after you have sent the money back.",
};

/**
 * What can be done to one order, from its status and rail. The server decides
 * again (store owner or manager, this store's order, eligible status); the
 * buttons only mirror that so nothing is offered that cannot work.
 */
export function OrderActions({
  id,
  status,
  payment,
  tracking = null,
  hideShip = false,
}: {
  id: string;
  status: string;
  payment: string;
  tracking?: string | null;
  /** Quote-only shipping: the Ship-this card has its own Mark shipped, with the tracking. */
  hideShip?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();

  const unpaid = status === "awaiting_etransfer" || status === "payment_received" || status === "pending_payment";
  const buttons: Array<{ kind: Kind; label: string }> = [];
  if ((status === "awaiting_etransfer" || status === "payment_received") && payment === "etransfer") buttons.push({ kind: "confirm", label: "Confirm eTransfer received" });
  if (status === "paid" && !hideShip) buttons.push({ kind: "ship", label: tracking ? "Mark shipped (tracking filled in)" : "Mark shipped" });
  if (unpaid) buttons.push({ kind: "cancel", label: "Cancel" });
  if ((status === "paid" || status === "fulfilled") && payment === "etransfer") buttons.push({ kind: "refund", label: "Refund" });

  const run = (kind: Kind) => {
    const copy = kind === "ship" && tracking ? `Mark this order as shipped? The note on the order says: Tracking ${tracking}.` : CONFIRM_COPY[kind];
    if (!window.confirm(copy)) return;
    start(async () => {
      const call: Promise<ActionResult> =
        kind === "confirm" ? confirmEtransferAction(id) : kind === "ship" ? shipOrderAction(id, tracking ? `Tracking ${tracking}` : undefined) : kind === "cancel" ? cancelOrderAction(id) : refundOrderAction(id);
      const r = await call.catch(() => null);
      toast(r);
      if (r?.ok) router.refresh();
    });
  };

  return (
    <div className="ktp-m-order-actions">
      {buttons.map((b) => (
        <button key={b.kind} type="button" className={b.kind === "cancel" || b.kind === "refund" ? "ktp-btn ktp-btn--ghost ktp-btn--sm" : "ktp-btn ktp-btn--sm"} disabled={pending} onClick={() => run(b.kind)}>
          {b.label}
        </button>
      ))}
      {(status === "paid" || status === "fulfilled") && payment === "stripe" ? (
        <p className="ktp-m-fine">Paid by card. A refund is made from the Stripe dashboard; ask an admin of the collective.</p>
      ) : null}
    </div>
  );
}
