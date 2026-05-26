import * as React from "react";
import type { PaymentDisplay } from "@elkdonis/payments";
import { cn } from "./cn";

export interface PaymentInstructionsCardProps {
  display: PaymentDisplay;
  className?: string;
}

/**
 * Renders payment instructions returned by a PaymentProvider.
 * Currently supports the eTransfer kind in detail; Stripe/manual fall back
 * to plain text or the Stripe Elements mount point (left to consumers).
 */
export function PaymentInstructionsCard({ display, className }: PaymentInstructionsCardProps) {
  if (display.kind === "etransfer_instructions") {
    const due = new Date(display.dueAt);
    return (
      <div className={cn("rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--accent))]/30 p-6", className)}>
        <h2 className="mb-2 font-serif text-2xl">Send your eTransfer</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Your artwork is reserved. Complete the transfer below to confirm your order.
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Send to" value={display.payoutEmail} mono />
          <Field label="Reference" value={display.reference} mono />
          <Field
            label="Pay by"
            value={due.toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" })}
          />
        </dl>

        <pre className="mt-6 whitespace-pre-wrap rounded-md bg-[hsl(var(--card))] p-4 font-sans text-sm leading-relaxed text-[hsl(var(--foreground))]">
          {display.bodyText}
        </pre>
      </div>
    );
  }

  if (display.kind === "manual") {
    return (
      <div className={cn("rounded-lg border border-[hsl(var(--border))] p-6", className)}>
        <p className="text-sm">{display.message}</p>
      </div>
    );
  }

  // stripe_client_secret — consumers mount Stripe Elements here
  return (
    <div className={cn("rounded-lg border border-[hsl(var(--border))] p-6", className)}>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Loading secure payment form…
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className={cn("text-sm font-medium", mono && "font-mono break-all")}>{value}</dd>
    </div>
  );
}
