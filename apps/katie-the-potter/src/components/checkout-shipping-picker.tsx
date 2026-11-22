"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Address, Currency } from "@elkdonis/commerce/types";
import type { ShippingOption } from "@elkdonis/commerce/shipping";
import { formatMoney } from "@elkdonis/commerce/money";
import { chooseShippingAction, quoteShippingAction } from "@/lib/checkout-shipping-actions";

/**
 * Shipping as part of checkout (2026-11-17): address → live courier quotes →
 * one choice, or "arrange it with Katie instead", before the buyer can pay.
 * The server re-quotes on choose, so the price shown is the price charged.
 * Styled with the site's existing .ktp-ship-* rules (app/shop.css).
 */

const FIELDS: Array<{ key: keyof Address; label: string; auto: string; required?: boolean }> = [
  { key: "recipientName", label: "Name", auto: "name", required: true },
  { key: "line1", label: "Street address", auto: "address-line1", required: true },
  { key: "line2", label: "Apartment, suite (optional)", auto: "address-line2" },
  { key: "city", label: "City", auto: "address-level2", required: true },
  { key: "region", label: "Province / state", auto: "address-level1" },
  { key: "postalCode", label: "Postal / ZIP code", auto: "postal-code", required: true },
  { key: "country", label: "Country (CA, US, FR…)", auto: "country", required: true },
  { key: "phone", label: "Phone (for the courier)", auto: "tel" },
];

function days(o: ShippingOption): string {
  if (o.minDays == null && o.maxDays == null) return "";
  if (o.minDays === o.maxDays || o.maxDays == null) return `${o.minDays} business day${o.minDays === 1 ? "" : "s"}`;
  return `${o.minDays} to ${o.maxDays} business days`;
}

export function CheckoutShippingPicker({
  orderId,
  initialAddress,
  originCountry,
  canQuote,
  reason,
  payeeName,
}: {
  orderId: string;
  initialAddress: Address | null;
  originCountry: string | null;
  canQuote: boolean;
  reason: string | null;
  payeeName: string;
}) {
  const router = useRouter();
  const [address, setAddress] = useState<Address>(
    initialAddress ?? { recipientName: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: originCountry ?? "CA", phone: "" }
  );
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress((a) => ({ ...a, [k]: e.target.value }));
    setOptions(null);
    setSelected("");
  };

  const getRates = () =>
    start(async () => {
      setError(null);
      const r = await quoteShippingAction(orderId, address);
      if (!r.ok) {
        setOptions([]);
        setError(r.error ?? "No quote.");
        return;
      }
      setOptions(r.options ?? []);
      setSelected(r.options?.[0]?.id ?? "");
    });

  const choose = (optionId: string) =>
    start(async () => {
      setError(null);
      const r = await chooseShippingAction(orderId, address, optionId);
      if (!r.ok) {
        setError(r.error ?? "Could not save the shipping choice.");
        return;
      }
      router.refresh();
    });

  const international = Boolean(originCountry && address.country && address.country.trim().toUpperCase() !== originCountry);

  return (
    <div className="ktp-ship-form">
      <p>
        {canQuote
          ? `Add shipping to this order, or arrange it with ${payeeName}. Couriers quote live prices${originCountry ? ` from ${originCountry}` : ""}; the price is added to your total and paid with the order.`
          : reason}
      </p>

      {canQuote ? (
        <>
          <div className="ktp-ship-addr">
            {FIELDS.map((f) => (
              <label key={f.key}>
                <span>{f.label}</span>
                <input
                  className="ktp-input"
                  value={String(address[f.key] ?? "")}
                  onChange={set(f.key)}
                  autoComplete={f.auto}
                  required={f.required}
                />
              </label>
            ))}
          </div>
          <div className="ktp-shop-actions">
            <button type="button" className="ktp-btn" onClick={getRates} disabled={pending}>
              {pending && !options ? "Getting rates…" : "Get shipping rates"}
            </button>
          </div>
        </>
      ) : null}

      {options && options.length > 0 ? (
        <fieldset className="ktp-ship-fieldset">
          <legend>Choose a courier</legend>
          <ul className="ktp-ship-opts">
            {options.map((o) => (
              <li key={o.id}>
                <label className="ktp-ship-opt" data-on={selected === o.id ? "true" : undefined}>
                  <input type="radio" name="shipping-option" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
                  <span className="ktp-ship-opt-main">
                    <span className="ktp-ship-opt-name">{o.name}</span>
                    <span className="ktp-ship-opt-meta">
                      {days(o)}
                      {international && o.importDutyMinor + o.importTaxMinor > 0
                        ? `${days(o) ? " · " : ""}import duty and tax on delivery, about ${formatMoney(o.importDutyMinor + o.importTaxMinor, o.currency as Currency)}`
                        : ""}
                    </span>
                  </span>
                  <span className="ktp-ship-opt-price">{formatMoney(o.amountMinor, o.currency as Currency)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="ktp-shop-actions">
            <button type="button" className="ktp-btn" onClick={() => choose(selected)} disabled={pending || !selected}>
              Add this shipping
            </button>
          </div>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="ktp-shop-note">
          {error}
        </p>
      ) : null}

      <p className="ktp-shop-fine">
        <button type="button" className="ktp-linkbtn" onClick={() => choose("arranged")} disabled={pending}>
          Arrange shipping or pickup with {payeeName} instead
        </button>
      </p>
    </div>
  );
}
