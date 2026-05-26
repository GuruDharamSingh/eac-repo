import * as React from "react";
import type { Currency } from "@elkdonis/commerce/types";
import { formatMoney } from "@elkdonis/commerce/money";
import { cn } from "./cn";

export interface CartSummaryProps {
  subtotalMinor: number;
  shippingMinor?: number;
  taxMinor?: number;
  totalMinor?: number;
  currency: Currency;
  className?: string;
}

export function CartSummary({
  subtotalMinor,
  shippingMinor = 0,
  taxMinor = 0,
  totalMinor,
  currency,
  className,
}: CartSummaryProps) {
  const total = totalMinor ?? subtotalMinor + shippingMinor + taxMinor;
  return (
    <dl className={cn("flex flex-col gap-2 text-sm tabular-nums", className)}>
      <Row label="Subtotal" value={formatMoney(subtotalMinor, currency)} />
      <Row
        label="Shipping"
        value={shippingMinor > 0 ? formatMoney(shippingMinor, currency) : "Calculated separately"}
        muted={shippingMinor === 0}
      />
      {taxMinor > 0 && <Row label="Tax" value={formatMoney(taxMinor, currency)} />}
      <div className="my-1 border-t border-[hsl(var(--border))]" />
      <Row label="Total" value={formatMoney(total, currency)} bold />
    </dl>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn(muted && "text-[hsl(var(--muted-foreground))]", bold && "font-medium")}>
        {label}
      </dt>
      <dd className={cn(muted && "text-[hsl(var(--muted-foreground))]", bold && "font-serif text-lg")}>
        {value}
      </dd>
    </div>
  );
}
