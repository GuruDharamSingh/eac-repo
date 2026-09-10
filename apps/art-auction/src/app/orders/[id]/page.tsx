import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderById, getOrderLines } from "@elkdonis/commerce/queries";
import { canActForOrder } from "@elkdonis/commerce/server";
import { formatMoney } from "@elkdonis/commerce/money";
import { isCardPaymentAvailable, syncStripeOrder } from "@elkdonis/checkout/stripe";
import { payOrderByCard, payOrderByEtransfer } from "@/app/actions";
import { getCurrentUserId, getIsAdmin } from "@/lib/marketplace-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order" };

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  pending_payment: {
    label: "Payment not completed",
    tone: "bg-accent text-accent-foreground",
  },
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
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
  refunded: { label: "Refunded", tone: "bg-muted text-muted-foreground" },
};

const UNPAID = new Set(["pending_payment", "awaiting_etransfer", "payment_received"]);

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  // Coming back from Stripe: reconcile against the session so the buyer sees
  // "paid" even if the webhook has not landed yet.
  let order = sp.paid ? await syncStripeOrder(id) : await getOrderById(id);
  if (!order) notFound();

  // A signed-in buyer's order is theirs alone (plus the seller and admins). A
  // guest order has no account to check against; its unguessable id is the
  // capability, as it is for the emailed confirmation link.
  const userId = await getCurrentUserId();
  if (order.customerId) {
    const allowed =
      userId === order.customerId ||
      (userId ? await canActForOrder(userId, order.id) : false) ||
      (await getIsAdmin());
    if (!allowed) notFound();
  }
  order = order!;

  const lines = await getOrderLines(order.id);
  const status = STATUS_COPY[order.status] ?? {
    label: order.status.replace(/_/g, " "),
    tone: "bg-muted text-muted-foreground",
  };
  const unpaid = UNPAID.has(order.status);
  const cardAvailable = isCardPaymentAvailable();
  const isAuctionWin = order.metadata?.kind === "auction";
  const payeeName = (order.paymentMetadata?.payeeName as string | undefined) ?? "the artist";

  const heading = order.status === "paid" || order.status === "fulfilled" || order.status === "completed"
    ? "Thank you — your payment is in."
    : order.status === "cancelled"
      ? "This order was cancelled."
      : isAuctionWin
        ? "You won the auction — complete your purchase."
        : "Thank you — your order is placed.";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Order {order.number}</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{heading}</h1>
        <span
          className={
            "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider " +
            status.tone
          }
        >
          {status.label}
        </span>
        {sp.cancelled && unpaid && (
          <p className="mt-3 text-sm text-muted-foreground">
            You left the card payment page before paying. Nothing was charged; the
            piece is still held for you for a short while.
          </p>
        )}
      </div>

      {/* Pay: card, or eTransfer instructions, with a switch between them */}
      {unpaid && (
        <section className="mb-8 rounded-lg border border-border bg-accent/30 p-6">
          <h2 className="mb-3 font-serif text-2xl">Complete your payment</h2>
          <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Amount
              </dt>
              <dd className="text-sm font-medium tabular-nums">
                {formatMoney(order.totalMinor, order.currency)}
              </dd>
            </div>
            {order.paymentReference && order.paymentMethod === "etransfer" && (
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Reference
                </dt>
                <dd className="font-mono text-sm font-medium">{order.paymentReference}</dd>
              </div>
            )}
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

          {order.paymentMethod === "etransfer" && order.paymentInstructions ? (
            <>
              <pre className="whitespace-pre-wrap rounded-md bg-card p-4 font-sans text-sm leading-relaxed">
                {order.paymentInstructions}
              </pre>
              {cardAvailable && (
                <form action={payOrderByCard.bind(null, order.id)} className="mt-4">
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                  >
                    Pay by card instead
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              {cardAvailable && (
                <form action={payOrderByCard.bind(null, order.id)}>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Pay by card
                  </button>
                </form>
              )}
              <form action={payOrderByEtransfer.bind(null, order.id)}>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-medium hover:bg-muted"
                >
                  Pay by Interac eTransfer
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {/* Lines */}
      <section className="mb-8 rounded-lg border border-border p-6">
        <h2 className="mb-4 font-serif text-xl">Summary</h2>
        <ul className="mb-4 divide-y divide-border">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                {l.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {l.artworkId ? (
                  <Link href={`/artworks/${l.artworkId}`} className="underline-offset-4 hover:underline">
                    {l.description}
                  </Link>
                ) : (
                  l.description
                )}
                {l.quantity > 1 ? ` × ${l.quantity}` : ""}
              </span>
              <span className="tabular-nums">
                {formatMoney(l.unitPriceMinor * l.quantity, l.currency)}
              </span>
            </li>
          ))}
        </ul>
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
                : "Arranged with the seller"}
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
        {order.status === "paid" || order.status === "fulfilled" ? (
          <>
            {payeeName} has been notified and will arrange shipping with you at{" "}
            <span className="font-medium text-foreground">{order.customerEmail}</span>.
          </>
        ) : unpaid ? (
          order.paymentMethod === "etransfer" ? (
            <>
              A copy of these instructions was sent to{" "}
              <span className="font-medium text-foreground">{order.customerEmail}</span>. Once{" "}
              {payeeName} confirms your eTransfer, your order moves to{" "}
              <span className="font-medium text-foreground">Paid</span> and they’ll arrange shipping.
            </>
          ) : (
            <>
              The piece is held for you until the time shown above. Confirmation goes to{" "}
              <span className="font-medium text-foreground">{order.customerEmail}</span> as soon as
              payment clears.
            </>
          )
        ) : null}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {userId && (
          <Link
            href="/account"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm hover:bg-muted"
          >
            Your orders
          </Link>
        )}
        <Link
          href="/artworks"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm hover:bg-muted"
        >
          Continue browsing
        </Link>
      </div>
    </main>
  );
}
