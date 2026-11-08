import { db } from "@elkdonis/db";
import type { Order, OrderStatus } from "../types";
import { iso, isoOrNull } from "../time";

export type Row = Record<string, unknown>;

/**
 * A jsonb parameter. Use this — never `${JSON.stringify(x)}::jsonb`: with the
 * cast Postgres reports the parameter as jsonb, and the driver then JSON-
 * encodes the string a second time, so the column ends up holding a JSON
 * *string* of JSON and every reader gets text back instead of an object.
 * (`db.json` is typed for plain JSON values; the cast is only to admit
 * `Record<string, unknown>`.)
 */
export const jsonb = (v: unknown) => db.json(v as never);
export const num = (v: unknown): number => (v == null ? 0 : Number(v));

export function mapOrder(r: Row): Order {
  return {
    id: r.id as string,
    number: r.number as string,
    storeId: (r.store_id as string | null) ?? null,
    customerId: (r.customer_id as string | null) ?? null,
    customerEmail: r.customer_email as string,
    customerName: (r.customer_name as string | null) ?? null,
    status: r.status as OrderStatus,
    paymentMethod: r.payment_method as Order["paymentMethod"],
    paymentReference: (r.payment_reference as string | null) ?? null,
    paymentInstructions: (r.payment_instructions as string | null) ?? null,
    paymentDueAt: isoOrNull(r.payment_due_at),
    paymentConfirmedAt: isoOrNull(r.payment_confirmed_at),
    paymentConfirmedBy: (r.payment_confirmed_by as string | null) ?? null,
    paymentMetadata: (r.payment_metadata as Record<string, unknown>) ?? {},
    subtotalMinor: num(r.subtotal_minor),
    shippingMinor: num(r.shipping_minor),
    taxMinor: num(r.tax_minor),
    totalMinor: num(r.total_minor),
    currency: r.currency as Order["currency"],
    shippingAddress: (r.shipping_address as Order["shippingAddress"]) ?? null,
    billingAddress: (r.billing_address as Order["billingAddress"]) ?? null,
    notes: (r.notes as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    paidAt: isoOrNull(r.paid_at),
    fulfilledAt: isoOrNull(r.fulfilled_at),
    cancelledAt: isoOrNull(r.cancelled_at),
  };
}
