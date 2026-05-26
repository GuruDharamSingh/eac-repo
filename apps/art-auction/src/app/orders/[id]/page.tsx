import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderById } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmation" };

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  awaiting_etransfer: {
    label: "Awaiting your eTransfer",
    tone: "bg-accent text-accent-foreground",
  },
  payment_received: {
    label: "Payment received — under review",
    tone: "bg-accent text-accent-foreground",
  },
  paid: { label: "Paid", tone: "bg-primary text-primary-foreground" },
  fulfilled: { label: "Shipped", tone: "bg-primary text-primary-foreground" },
  completed: { label: "Completed", tone: "bg-primary text-primary-foreground" },
  cancelled: {
    label: "Cancelled",
    tone: "bg-muted text-muted-foreground",
  },
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const status = STATUS_COPY[order.status] ?? {
    label: order.status,
    tone: "bg-muted text-muted-foreground",
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Order {order.number}</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">
          Thank you — your order is placed.
        </h1>
        <span
          className={
            "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider " +
            status.tone
          }
        >
          {status.label}
        </span>
      </div>

      {/* eTransfer instructions */}
      {order.paymentMethod === "etransfer" && order.paymentInstructions && (
        <section className="mb-8 rounded-lg border border-border bg-accent/30 p-6">
          <h2 className="mb-3 font-serif text-2xl">Complete your payment</h2>
          <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Reference
              </dt>
              <dd className="font-mono text-sm font-medium">
                {order.paymentReference}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Amount
              </dt>
              <dd className="text-sm font-medium tabular-nums">
                {formatMoney(order.totalMinor, order.currency)}
              </dd>
            </div>
            {order.paymentDueAt && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Pay by
                </dt>
                <dd className="text-sm font-medium">
                  {new Date(order.paymentDueAt).toLocaleString("en-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
            )}
          </dl>
          <pre className="whitespace-pre-wrap rounded-md bg-card p-4 font-sans text-sm leading-relaxed">
            {order.paymentInstructions}
          </pre>
        </section>
      )}

      {/* Totals */}
      <section className="mb-8 rounded-lg border border-border p-6">
        <h2 className="mb-4 font-serif text-xl">Summary</h2>
        <dl className="flex flex-col gap-2 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatMoney(order.subtotalMinor, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>
              {order.shippingMinor > 0
                ? formatMoney(order.shippingMinor, order.currency)
                : "Confirmed by artist"}
            </dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-2 font-medium">
            <dt>Total</dt>
            <dd className="font-serif text-lg">
              {formatMoney(order.totalMinor, order.currency)}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-sm text-muted-foreground">
        A copy of these instructions has been associated with{" "}
        <span className="font-medium text-foreground">{order.customerEmail}</span>.
        Once the artist confirms your eTransfer, your order moves to{" "}
        <span className="font-medium text-foreground">Paid</span> and they’ll
        arrange shipping.
      </p>

      <Link
        href="/artworks"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm hover:bg-muted"
      >
        Continue browsing
      </Link>
    </main>
  );
}
