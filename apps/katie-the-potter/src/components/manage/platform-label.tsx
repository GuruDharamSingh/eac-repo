"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@elkdonis/cms-ui/manage/client";
import { buyLabelAction } from "@/lib/manage-actions";

/**
 * The label for an order whose buyer paid for a courier at checkout
 * (2026-11-17; the store is in platform mode, so the collective's Easyship
 * account buys it right after payment). Shows the PDF to print and the
 * tracking; when the automatic purchase did not go through there is a
 * "Buy label" button. The server decides again who may buy (orderAccess).
 */
export interface PlatformLabelFacts {
  orderId: string;
  service: string;
  buyerPaid: string;
  labelUrl: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelCost: string | null;
  /** "none": paid, courier chosen, no label yet. */
  state: "ready" | "none" | "pending";
  sandbox: boolean;
}

export function PlatformLabel({ f, canAct }: { f: PlatformLabelFacts; canAct: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const buy = () =>
    start(async () => {
      const r = await buyLabelAction(f.orderId).catch(() => null);
      toast(r);
      if (r?.ok) router.refresh();
    });

  return (
    <div className="ktp-m-shipline" data-tone={f.state === "ready" ? "ok" : "pending"}>
      <p className="ktp-m-row-meta">
        <span>
          {f.sandbox ? (
            <b className="ktp-m-badge" data-tone="off">
              Test
            </b>
          ) : null}{" "}
          <b>Shipping:</b> {f.service}, buyer paid {f.buyerPaid}
          {f.trackingNumber ? (
            <>
              , tracking <span className="ktp-m-mono">{f.trackingNumber}</span>
            </>
          ) : null}
        </span>
        {f.labelCost ? <span>Label cost {f.labelCost}</span> : null}
        {f.state === "none" ? <span>Label not bought yet</span> : null}
      </p>
      <p className="ktp-m-row-links">
        {f.labelUrl ? (
          <a className="ktp-btn ktp-btn--sm" href={f.labelUrl} target="_blank" rel="noopener noreferrer">
            Print label (PDF)
          </a>
        ) : null}
        {f.trackingUrl ? (
          <a className="ktp-m-linkbtn" href={f.trackingUrl} target="_blank" rel="noopener noreferrer">
            Tracking page
          </a>
        ) : null}
        {f.state === "none" && canAct ? (
          <button type="button" className="ktp-btn ktp-btn--sm" onClick={buy} disabled={pending}>
            {pending ? "Buying…" : "Buy label"}
          </button>
        ) : null}
      </p>
    </div>
  );
}
