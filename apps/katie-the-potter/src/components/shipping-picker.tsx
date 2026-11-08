"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ShippingOption } from "@/lib/shipping/rates";

/**
 * The buyer's carrier choice. Works without JavaScript (radio + checkbox +
 * one hidden accepted price per option and insurance choice; the server
 * re-checks every price); with it, the total updates as they choose.
 */

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(minor / 100);

function days(o: ShippingOption) {
  if (o.minDays == null && o.maxDays == null) return "time not given";
  if (o.minDays != null && o.maxDays != null && o.minDays !== o.maxDays) return `${o.minDays} to ${o.maxDays} business days`;
  const n = (o.maxDays ?? o.minDays)!;
  return `${n} business ${n === 1 ? "day" : "days"}`;
}

function Submit({ label, intent, disabled }: { label: string; intent: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="intent" value={intent} className="ktp-btn" disabled={pending || disabled}>
      {pending ? "One moment…" : label}
    </button>
  );
}

export function ShippingPicker({
  action,
  featured,
  rest,
  mode,
  flow = "label",
  insurance = "choice",
  initialOption,
  insuredValue,
}: {
  action: (form: FormData) => void | Promise<void>;
  featured: ShippingOption[];
  rest: ShippingOption[];
  mode: "test" | "live";
  /** quote = the buyer pays Katie, who buys the label (the flow in use). */
  flow?: "quote" | "label";
  /** Katie's setting: insurance folded into every price, a buyer's checkbox, or none. */
  insurance?: "included" | "choice" | "none";
  initialOption?: string | null;
  /** The declared value insured, already formatted. */
  insuredValue: string;
}) {
  const all = [...featured, ...rest];
  const [option, setOption] = useState<string>(initialOption && all.some((o) => o.courierServiceId === initialOption) ? initialOption : featured[0]?.courierServiceId ?? "");
  const [ticked, setInsured] = useState(true);
  const insured = insurance === "included" ? true : insurance === "none" ? false : ticked;
  const [showAll, setShowAll] = useState(Boolean(initialOption && rest.some((o) => o.courierServiceId === initialOption)));
  const chosen = all.find((o) => o.courierServiceId === option) ?? null;
  const total = chosen ? (insured ? chosen.insuredMinor : chosen.uninsuredMinor) : 0;
  const duty = chosen && chosen.dutyMinor + chosen.taxMinor > 0 ? chosen.dutyMinor + chosen.taxMinor : 0;

  const row = (o: ShippingOption) => (
    <li key={o.courierServiceId}>
      <label className="ktp-ship-opt" data-on={o.courierServiceId === option ? "true" : undefined}>
        <input type="radio" name="option" value={o.courierServiceId} checked={o.courierServiceId === option} onChange={() => setOption(o.courierServiceId)} />
        <span className="ktp-ship-opt-main">
          <span className="ktp-ship-opt-name">{o.service}</span>
          <span className="ktp-ship-opt-meta">
            {days(o)}
            {o.tags.length ? (
              <>
                {" · "}
                {o.tags.map((t) => (
                  <b key={t} className="ktp-ship-tag">
                    {t}{" "}
                  </b>
                ))}
              </>
            ) : null}
          </span>
        </span>
        <span className="ktp-ship-opt-price">{money(insured ? o.insuredMinor : o.uninsuredMinor, o.currency)}</span>
      </label>
      <input type="hidden" name={`accept_${o.courierServiceId}_ins`} value={o.insuredMinor} />
      <input type="hidden" name={`accept_${o.courierServiceId}_no`} value={o.uninsuredMinor} />
    </li>
  );

  return (
    <form action={action} className="ktp-ship-form">
      <fieldset className="ktp-ship-fieldset">
        <legend>Choose a carrier</legend>
        <ul className="ktp-ship-opts">{featured.map(row)}</ul>
        {rest.length > 0 ? (
          <>
            <button type="button" className="ktp-linkbtn" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer carriers" : `Show all carriers (${rest.length} more)`}
            </button>
            {showAll ? <ul className="ktp-ship-opts">{rest.map(row)}</ul> : rest.map((o) => (
              <span key={o.courierServiceId} hidden>
                <input type="hidden" name={`accept_${o.courierServiceId}_ins`} value={o.insuredMinor} />
                <input type="hidden" name={`accept_${o.courierServiceId}_no`} value={o.uninsuredMinor} />
              </span>
            ))}
          </>
        ) : null}
      </fieldset>

      {insurance === "choice" ? (
        <label className="ktp-ship-insure">
          <input type="checkbox" name="insured" checked={insured} onChange={(e) => setInsured(e.target.checked)} />
          <span>
            Insure the parcel for {insuredValue}
            {chosen && chosen.insuranceMinor > 0 ? <> (adds {money(chosen.insuranceMinor, chosen.currency)})</> : null}. Recommended for ceramics.
          </span>
        </label>
      ) : insurance === "included" ? (
        <p className="ktp-shop-fine">Insured for {insuredValue}, included in every price.</p>
      ) : null}

      {chosen ? (
        <p className="ktp-ship-total">
          Shipping: <b>{money(total, chosen.currency)}</b> with {chosen.service}
        </p>
      ) : null}
      {duty > 0 && chosen ? (
        <p className="ktp-shop-fine">Import duty and tax are not included: the carrier may collect about {money(duty, chosen.currency)} on delivery.</p>
      ) : null}

      <div className="ktp-shop-actions">
        {mode === "live" ? (
          <Submit label="Pay for shipping" intent="pay" disabled={!chosen} />
        ) : flow === "quote" ? (
          <>
            <Submit label="Choose (test: no payment)" intent="test" disabled={!chosen} />
            <span className="ktp-shop-fine">Test mode: nothing is paid. When shipping is on, this button is &ldquo;Pay for shipping&rdquo; and opens Stripe; the money goes to Katie.</span>
          </>
        ) : (
          <>
            <Submit label="Buy test label" intent="test" disabled={!chosen} />
            <span className="ktp-shop-fine">Test mode: an Easyship sandbox label, no payment. In Live this button is &ldquo;Pay for shipping&rdquo; and opens Stripe.</span>
          </>
        )}
      </div>
    </form>
  );
}
