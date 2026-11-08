"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@elkdonis/cms-ui/manage/client";
import { markShippedWithTrackingAction } from "@/lib/shipping/actions";

/**
 * Quote-only shipping, /manage/orders: the buyer has paid Katie for shipping.
 * Everything she needs to buy the label herself (the server renders the
 * facts; this is the tracking entry), then Mark shipped: the buyer gets the
 * tracking by email.
 */
export interface ShipThisFacts {
  shipmentId: string;
  test: boolean;
  service: string;
  courier: string;
  days: string | null;
  paid: string;
  insured: boolean;
  insuredFor: string | null;
  quotedAt: string | null;
  shipTo: string[];
  phone: string | null;
  email: string | null;
  parcels: Array<{ title: string; box: string; weight: string; customs: string | null }>;
}

export function ShipThis({ f, canAct }: { f: ShipThisFacts; canAct: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [carrier, setCarrier] = useState(f.courier);
  const [tn, setTn] = useState("");

  return (
    <section className="ktp-m-shipthis" aria-label="Ship this order">
      <p className="ktp-m-shipthis-head">
        {f.test ? (
          <b className="ktp-m-badge" data-tone="off">
            Test
          </b>
        ) : null}{" "}
        <b>Ship this:</b> {f.service}
        {f.days ? <> · about {f.days}</> : null} · buyer paid <b>{f.paid}</b>
        {f.insured ? " (insured)" : ""}
      </p>
      <div className="ktp-m-shipthis-grid">
        <div>
          <p className="ktp-m-shipthis-k">Ship to</p>
          <p>
            {f.shipTo.map((l, i) => (
              <span key={i}>
                {l}
                <br />
              </span>
            ))}
            {f.phone ? (
              <>
                {f.phone}
                <br />
              </>
            ) : null}
            {f.email ?? null}
          </p>
        </div>
        <div>
          <p className="ktp-m-shipthis-k">Parcel</p>
          <ul>
            {f.parcels.map((p, i) => (
              <li key={i}>
                {p.title}: box <b>{p.box}</b>, <b>{p.weight}</b> packed
                {p.customs ? <span className="ktp-m-fine"> · {p.customs}</span> : null}
              </li>
            ))}
          </ul>
          {f.insured && f.insuredFor ? <p className="ktp-m-fine">Insure it for {f.insuredFor} when you buy the label.</p> : null}
        </div>
      </div>
      <p className="ktp-m-fine">
        Buy the label with <b>{f.courier}</b> yourself: in your own Easyship account (
        <a href="https://app.easyship.com" target="_blank" rel="noopener noreferrer">
          app.easyship.com
        </a>
        , same courier and service), on the carrier&rsquo;s website or at the counter. The label may cost a little more or less than the quote
        {f.quotedAt ? <> ({f.quotedAt})</> : null}; small differences are yours, the buyer isn&rsquo;t charged again.
      </p>
      {canAct ? (
        <form
          className="ktp-m-shipthis-form"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await markShippedWithTrackingAction(f.shipmentId, { carrier, trackingNumber: tn }).catch(() => null);
              toast(r);
              if (r?.ok) router.refresh();
            });
          }}
        >
          <label className="ktp-m-field">
            <span>Carrier</span>
            <input className="ktp-input" value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={80} disabled={pending} required />
          </label>
          <label className="ktp-m-field">
            <span>Tracking number</span>
            <input className="ktp-input" value={tn} onChange={(e) => setTn(e.target.value)} maxLength={60} disabled={pending} required autoComplete="off" inputMode="text" />
          </label>
          <button type="submit" className="ktp-btn ktp-btn--sm" disabled={pending || !tn.trim() || !carrier.trim()}>
            {pending ? "Saving…" : "Mark shipped"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
