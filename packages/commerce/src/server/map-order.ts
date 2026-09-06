import type { Order, OrderStatus } from "../types";

export type Row = Record<string, unknown>;
export const num = (v: unknown): number => (v == null ? 0 : Number(v));

export function mapOrder(r: Row): Order {
  return {
    id: r.id as string,
    number: r.number as string,
    customerId: (r.customer_id as string | null) ?? null,
    customerEmail: r.customer_email as string,
    customerName: (r.customer_name as string | null) ?? null,
    status: r.status as OrderStatus,
    paymentMethod: r.payment_method as Order["paymentMethod"],
    paymentReference: (r.payment_reference as string | null) ?? null,
    paymentInstructions: (r.payment_instructions as string | null) ?? null,
    paymentDueAt: (r.payment_due_at as string | null) ?? null,
    paymentConfirmedAt: (r.payment_confirmed_at as string | null) ?? null,
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
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    paidAt: (r.paid_at as string | null) ?? null,
    fulfilledAt: (r.fulfilled_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
  };
}
