"use client";

import * as React from "react";
import type { Address } from "@elkdonis/commerce/types";
import { cn } from "./cn";

export interface CheckoutFormValues {
  customerName: string;
  customerEmail: string;
  shippingAddress: Address;
  notes?: string;
  paymentMethod: "etransfer" | "stripe";
  /** Where the commission goes: payee ids with percentages summing to 100. */
  support?: Array<{ payeeId: string; percent: number }>;
}

/** One choice in the "where the commission goes" block. */
export interface SupportOption {
  id: string;
  label: string;
  description?: string | null;
  /** The split this choice means. One payee at 100%, or several. */
  split: Array<{ payeeId: string; percent: number }>;
}

export interface CheckoutFormProps {
  initialValues?: Partial<CheckoutFormValues>;
  paymentMethods?: Array<{ id: "etransfer" | "stripe"; label: string; description: string; disabled?: boolean }>;
  /**
   * Choices for the commission's destination (ORG_STORE_BRIEF R3). Omitted
   * or empty hides the block and the marketplace keeps the commission.
   */
  supportOptions?: SupportOption[];
  /** The index in `supportOptions` selected by default. */
  defaultSupportIndex?: number;
  /** Lines whose proceeds a listing directs to a beneficiary; shown as a notice. */
  beneficiaryNotices?: Array<{ title: string; beneficiaryName: string; scope: "all_proceeds" | "commission" }>;
  /** Caller wires this to a server action. Should return on success. */
  onSubmit: (values: CheckoutFormValues) => Promise<void>;
  submitLabel?: string;
  className?: string;
}

// Card is opt-in, not a default: whether it can be offered depends on
// `isCardPaymentAvailable()`, which reads a server-side secret this client
// component cannot see. A caller that wants it passes `paymentMethods`
// explicitly after checking. Listing a disabled "coming soon" card option here
// told every caller that Stripe was unbuilt long after it worked.
const DEFAULT_METHODS: NonNullable<CheckoutFormProps["paymentMethods"]> = [
  {
    id: "etransfer",
    label: "Interac eTransfer",
    description: "Send the artist an Interac eTransfer after placing the order.",
  },
];

export function CheckoutForm({
  initialValues,
  paymentMethods = DEFAULT_METHODS,
  supportOptions = [],
  defaultSupportIndex = 0,
  beneficiaryNotices = [],
  onSubmit,
  submitLabel = "Place order",
  className,
}: CheckoutFormProps) {
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<CheckoutFormValues["paymentMethod"]>(
    initialValues?.paymentMethod ?? "etransfer"
  );
  const [supportIdx, setSupportIdx] = React.useState(
    Math.min(Math.max(0, defaultSupportIndex), Math.max(0, supportOptions.length - 1))
  );

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const data = new FormData(e.currentTarget);
    const values: CheckoutFormValues = {
      customerName: String(data.get("customerName") ?? ""),
      customerEmail: String(data.get("customerEmail") ?? ""),
      paymentMethod,
      support: supportOptions[supportIdx]?.split,
      notes: (data.get("notes") as string) || undefined,
      shippingAddress: {
        recipientName: String(data.get("recipientName") ?? "") || null,
        line1: String(data.get("line1") ?? ""),
        line2: (data.get("line2") as string) || null,
        city: String(data.get("city") ?? ""),
        region: (data.get("region") as string) || null,
        postalCode: String(data.get("postalCode") ?? ""),
        country: String(data.get("country") ?? "CA"),
        phone: (data.get("phone") as string) || null,
      },
    };
    setPending(true);
    try {
      await onSubmit(values);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong placing your order.");
      setPending(false);
    }
  };

  const Field = ({
    name,
    label,
    required,
    type = "text",
    defaultValue,
    autoComplete,
    placeholder,
    cols = "col-span-2",
  }: {
    name: string;
    label: string;
    required?: boolean;
    type?: string;
    defaultValue?: string;
    autoComplete?: string;
    placeholder?: string;
    cols?: string;
  }) => (
    <label className={cn("flex flex-col gap-1.5", cols)}>
      <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label} {required && <span className="text-[hsl(var(--destructive))]">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="h-11 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      />
    </label>
  );

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-8", className)}>
      <section>
        <h2 className="mb-3 font-serif text-xl">Contact</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="customerName"
            label="Full name"
            required
            autoComplete="name"
            defaultValue={initialValues?.customerName}
          />
          <Field
            name="customerEmail"
            label="Email"
            type="email"
            required
            autoComplete="email"
            defaultValue={initialValues?.customerEmail}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl">Shipping address</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="recipientName"
            label="Recipient (if different from above)"
            autoComplete="name"
            defaultValue={initialValues?.shippingAddress?.recipientName ?? undefined}
          />
          <Field
            name="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
            defaultValue={initialValues?.shippingAddress?.phone ?? undefined}
          />
          <Field
            name="line1"
            label="Address"
            required
            autoComplete="address-line1"
            defaultValue={initialValues?.shippingAddress?.line1}
          />
          <Field
            name="line2"
            label="Address line 2"
            autoComplete="address-line2"
            defaultValue={initialValues?.shippingAddress?.line2 ?? undefined}
          />
          <Field
            name="city"
            label="City"
            required
            autoComplete="address-level2"
            defaultValue={initialValues?.shippingAddress?.city}
            cols="col-span-1"
          />
          <Field
            name="region"
            label="Province / State"
            autoComplete="address-level1"
            defaultValue={initialValues?.shippingAddress?.region ?? undefined}
            cols="col-span-1"
          />
          <Field
            name="postalCode"
            label="Postal code"
            required
            autoComplete="postal-code"
            defaultValue={initialValues?.shippingAddress?.postalCode}
            cols="col-span-1"
          />
          <Field
            name="country"
            label="Country"
            required
            autoComplete="country"
            defaultValue={initialValues?.shippingAddress?.country ?? "CA"}
            cols="col-span-1"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl">Payment</h2>
        <div className="flex flex-col gap-2">
          {paymentMethods.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-[hsl(var(--border))] p-4 transition-colors",
                paymentMethod === m.id ? "ring-2 ring-[hsl(var(--ring))]" : "hover:bg-[hsl(var(--muted))]/30",
                m.disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={m.id}
                checked={paymentMethod === m.id}
                onChange={() => setPaymentMethod(m.id)}
                disabled={m.disabled}
                className="mt-1"
              />
              <div className="flex flex-col">
                <span className="font-medium">{m.label}</span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{m.description}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {beneficiaryNotices.length > 0 && (
        <section className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4 text-sm">
          <h2 className="mb-2 font-serif text-xl">Where this money goes</h2>
          <ul className="flex flex-col gap-1">
            {beneficiaryNotices.map((n, i) => (
              <li key={i}>
                <span className="font-medium">{n.title}</span>
                {n.scope === "all_proceeds"
                  ? ` — all proceeds (less card fees) go to ${n.beneficiaryName}.`
                  : ` — the commission on this piece goes to ${n.beneficiaryName}.`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            The collective collects the payment, records the amount for the beneficiary and pays it
            over; you will receive a statement of proceeds by email. This is not a tax receipt.
          </p>
        </section>
      )}

      {supportOptions.length > 0 && (
        <section>
          <h2 className="mb-1 font-serif text-xl">Support</h2>
          <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
            A small commission on each sale keeps the collective running. Choose where it goes.
          </p>
          <div className="flex flex-col gap-2">
            {supportOptions.map((o, i) => (
              <label
                key={o.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border border-[hsl(var(--border))] p-4 transition-colors",
                  supportIdx === i ? "ring-2 ring-[hsl(var(--ring))]" : "hover:bg-[hsl(var(--muted))]/30"
                )}
              >
                <input
                  type="radio"
                  name="support"
                  value={o.id}
                  checked={supportIdx === i}
                  onChange={() => setSupportIdx(i)}
                  className="mt-1"
                />
                <div className="flex flex-col">
                  <span className="font-medium">{o.label}</span>
                  {o.description && (
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{o.description}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-serif text-xl">Notes (optional)</h2>
        <textarea
          name="notes"
          rows={3}
          placeholder="Anything the artist should know about delivery, framing preferences, etc."
          defaultValue={initialValues?.notes}
          className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </section>

      {err && (
        <p className="rounded-md bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]">
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-6 text-base font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
      >
        {pending ? "Placing order…" : submitLabel}
      </button>
    </form>
  );
}
