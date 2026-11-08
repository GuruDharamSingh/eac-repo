"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Address, Currency } from "@elkdonis/commerce/types";
import type { ShippingOption } from "@elkdonis/commerce/shipping";
import { formatMoney } from "@elkdonis/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chooseShippingAction, quoteShippingAction } from "./shipping-actions";

const FIELDS: Array<{ key: keyof Address; label: string; auto: string; span?: boolean; required?: boolean }> = [
  { key: "recipientName", label: "Name", auto: "name", span: true, required: true },
  { key: "line1", label: "Street address", auto: "address-line1", span: true, required: true },
  { key: "line2", label: "Apartment, suite (optional)", auto: "address-line2", span: true },
  { key: "city", label: "City", auto: "address-level2", required: true },
  { key: "region", label: "Province / state", auto: "address-level1" },
  { key: "postalCode", label: "Postal / ZIP code", auto: "postal-code", required: true },
  { key: "country", label: "Country (CA, US, FR…)", auto: "country", required: true },
  { key: "phone", label: "Phone (for the courier)", auto: "tel", span: true },
];

function days(o: ShippingOption): string {
  if (o.minDays == null && o.maxDays == null) return "";
  if (o.minDays === o.maxDays || o.maxDays == null) return `${o.minDays} business day${o.minDays === 1 ? "" : "s"}`;
  return `${o.minDays}–${o.maxDays} business days`;
}

/**
 * Address → live courier quotes → one choice, before the buyer can pay. The
 * server re-quotes on choose, so the price shown is the price charged.
 */
export function ShippingPicker({
  orderId,
  initialAddress,
  originCountry,
  canQuote,
  reason,
}: {
  orderId: string;
  initialAddress: Address | null;
  originCountry: string | null;
  canQuote: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [address, setAddress] = useState<Address>(
    initialAddress ?? { recipientName: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "US", phone: "" }
  );
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [selected, setSelected] = useState<string>("");
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

  const international = originCountry && address.country && address.country.trim().toUpperCase() !== originCountry;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {canQuote
          ? `Where should the piece go? Couriers quote live prices${originCountry ? ` from ${originCountry}` : ""}.`
          : reason}
      </p>

      {canQuote && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className={f.span ? "sm:col-span-2" : undefined}>
                <span className="mb-1 block text-xs text-muted-foreground">{f.label}</span>
                <Input
                  value={String(address[f.key] ?? "")}
                  onChange={set(f.key)}
                  autoComplete={f.auto}
                  required={f.required}
                />
              </label>
            ))}
          </div>
          <div>
            <Button type="button" onClick={getRates} disabled={pending}>
              {pending && !options ? "Getting rates…" : "Get shipping rates"}
            </Button>
          </div>
        </>
      )}

      {options && options.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Choose a courier</legend>
          {options.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm ${
                selected === o.id ? "ring-2 ring-ring" : "hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="shipping-option"
                value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="block font-medium">{o.name}</span>
                <span className="block text-muted-foreground">
                  {days(o)}
                  {international && o.importDutyMinor + o.importTaxMinor > 0
                    ? ` · import duty and tax on delivery, est. ${formatMoney(o.importDutyMinor + o.importTaxMinor, o.currency as Currency)}`
                    : ""}
                </span>
              </span>
              <span className="tabular-nums">{formatMoney(o.amountMinor, o.currency as Currency)}</span>
            </label>
          ))}
          <div className="mt-2">
            <Button type="button" onClick={() => choose(selected)} disabled={pending || !selected}>
              Use this shipping
            </Button>
          </div>
        </fieldset>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => choose("arranged")}
          disabled={pending}
          className="text-sm underline underline-offset-4 disabled:opacity-50"
        >
          Arrange shipping or pickup with the artist instead
        </button>
      </div>
    </div>
  );
}
