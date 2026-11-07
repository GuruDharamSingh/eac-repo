import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderLines } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { CARD_CHARGE_CEILING_MINOR, isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { sized } from "@/blocks/media";
import { loadOrderForViewer } from "@/lib/shop";
import { formatAddress } from "@/lib/address";
import { orderHasSamplePiece, SAMPLE_CARD_REFUSAL } from "@/lib/sample-guard";
import { payOrderByCard, payOrderByEtransfer } from "@/lib/shop-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const STATUS: Record<string, { label: string; tone: "pending" | "ok" | "off" }> = {
  pending_payment: { label: "Payment not completed", tone: "pending" },
  awaiting_etransfer: { label: "Awaiting your eTransfer", tone: "pending" },
  payment_received: { label: "Payment received, under review", tone: "pending" },
  paid: { label: "Paid", tone: "ok" },
  fulfilled: { label: "Shipped", tone: "ok" },
  completed: { label: "Completed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "off" },
  refunded: { label: "Refunded", tone: "off" },
};
const UNPAID = new Set(["pending_payment", "awaiting_etransfer", "payment_received"]);

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; card?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  // The access rule lives in loadOrderForViewer (copied from the marketplace's
  // order page): a signed-in buyer's order is theirs alone, a guest order is
  // reached by its unguessable id. "Not yours" and "not found" are both 404.
  const order = await loadOrderForViewer(id, { sync: Boolean(sp.paid) });
  if (!order) notFound();

  const lines = await getOrderLines(order.id);
  const status = STATUS[order.status] ?? { label: order.status.replace(/_/g, " "), tone: "off" as const };
  const unpaid = UNPAID.has(order.status);
  const isSample = await orderHasSamplePiece(order.id);
  // Above Stripe's per-charge ceiling a card button can only bounce back here,
  // and a sample piece may not be paid for by card (lib/sample-guard.ts).
  const cardAvailable = isCardPaymentAvailable() && order.totalMinor <= CARD_CHARGE_CEILING_MINOR && !isSample;
  const payeeName = (order.paymentMetadata?.payeeName as string | undefined) ?? "Katie";
  const done = order.status === "paid" || order.status === "fulfilled" || order.status === "completed";
  // A Buy-now order has no email until Stripe's page collects it.
  const email = order.customerEmail?.trim() || null;
  const ship = formatAddress(order.shippingAddress);
  // eTransfer is settled by hand: offered only when we can reach the buyer.
  const etransferOffered = Boolean(email);

  const heading = done
    ? "Thank you. Your payment is in."
    : order.status === "cancelled"
      ? "This order was cancelled."
      : order.status === "refunded"
        ? "This order was refunded."
        : "Thank you. Your order is placed.";

  return (
    <div className="ktp-shop">
      <p className="ktp-shop-kicker">Order {order.number}</p>
      <h1 className="ktp-shop-title">{heading}</h1>
      <p className="ktp-shop-status" data-tone={status.tone}>
        {status.label}
      </p>

      {sp.cancelled && unpaid ? (
        <p className="ktp-shop-note">You left the card payment page before paying. Nothing was charged; the piece is still held for you for a short while.</p>
      ) : null}
      {sp.card === "over_ceiling" && unpaid ? (
        <p className="ktp-shop-note">This order is more than a card can carry in a single payment. Nothing was charged. You can pay by eTransfer below.</p>
      ) : null}
      {sp.card === "stripe_refused" && unpaid ? (
        <p className="ktp-shop-note">Card payment couldn&rsquo;t be started for this order. Nothing was charged. You can try the card again, or pay by eTransfer below.</p>
      ) : null}
      {sp.card === "sample" && unpaid ? (
        <p className="ktp-shop-note" data-tone="sample" role="alert">
          {SAMPLE_CARD_REFUSAL}
        </p>
      ) : null}
      {sp.card === "unavailable" && unpaid ? <p className="ktp-shop-note">Card payments are not available right now. Please pay by eTransfer.</p> : null}
      {sp.card === "etransfer_unavailable" && unpaid ? <p className="ktp-shop-note">eTransfer isn&rsquo;t available for this order. Please pay by card.</p> : null}
      {sp.card === "etransfer_needs_email" && unpaid ? (
        <p className="ktp-shop-note">This order was started with Buy now, so we don&rsquo;t have your email yet. Please pay by card, or add the piece to your cart and use Checkout to pay by eTransfer.</p>
      ) : null}

      {done ? (
        <section className="ktp-shop-card ktp-shop-next">
          <h2>What happens next</h2>
          <p>
            {payeeName} has your order{email ? (
              <>
                {" "}and will write to you at <b>{email}</b>
              </>
            ) : null}
            .{order.paymentMethod === "stripe" ? " Your card receipt comes from Stripe." : null}
          </p>
          <p>
            <b>Shipping:</b> you&rsquo;ll get a link to choose a carrier and pay for the label. Until that link is ready, {payeeName} will be in touch to arrange it.
          </p>
          {ship ? (
            <p className="ktp-shop-ship">
              <span>Ship to</span> {ship}
            </p>
          ) : null}
        </section>
      ) : null}

      {unpaid ? (
        <section className="ktp-shop-card ktp-shop-pay">
          <h2>Complete your payment</h2>
          <dl className="ktp-shop-facts">
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(order.totalMinor, order.currency)}</dd>
            </div>
            {order.paymentReference && order.paymentMethod === "etransfer" ? (
              <div>
                <dt>Reference</dt>
                <dd className="ktp-shop-mono">{order.paymentReference}</dd>
              </div>
            ) : null}
            {order.paymentDueAt ? (
              <div>
                <dt>Pay by</dt>
                <dd>{new Date(order.paymentDueAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</dd>
              </div>
            ) : null}
          </dl>

          {order.paymentMethod === "etransfer" && order.paymentInstructions ? (
            <>
              <pre className="ktp-shop-instructions">{order.paymentInstructions}</pre>
              {cardAvailable ? (
                <form action={payOrderByCard.bind(null, order.id)}>
                  <button type="submit" className="ktp-btn ktp-btn--ghost">
                    Pay by card instead
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <div className="ktp-shop-actions">
              {cardAvailable ? (
                <form action={payOrderByCard.bind(null, order.id)}>
                  <button type="submit" className="ktp-btn">
                    Pay by card
                  </button>
                </form>
              ) : null}
              {etransferOffered ? (
                <form action={payOrderByEtransfer.bind(null, order.id)}>
                  <button type="submit" className={cardAvailable ? "ktp-btn ktp-btn--ghost" : "ktp-btn"}>
                    Pay by Interac eTransfer
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="ktp-shop-card">
        <h2>Summary</h2>
        <ul className="ktp-shop-lines ktp-shop-lines--flat">
          {lines.map((l) => (
            <li key={l.id} className="ktp-shop-line">
              <span className="ktp-shop-thumb ktp-shop-thumb--sm">
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sized(l.imageUrl, 256)} alt="" loading="lazy" />
                ) : null}
              </span>
              <div className="ktp-shop-line-body">
                {l.artworkId ? (
                  <Link className="ktp-shop-line-title" href={`/pieces/${encodeURIComponent(l.artworkId)}`}>
                    {l.description}
                  </Link>
                ) : (
                  <span className="ktp-shop-line-title">{l.description}</span>
                )}
              </div>
              <span className="ktp-shop-line-price">{formatMoney(l.unitPriceMinor * l.quantity, l.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="ktp-shop-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotalMinor, order.currency)}</dd>
          </div>
          <div data-muted="true">
            <dt>Shipping</dt>
            <dd>{order.shippingMinor > 0 ? formatMoney(order.shippingMinor, order.currency) : "Arranged with Katie"}</dd>
          </div>
          <div data-total="true">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalMinor, order.currency)}</dd>
          </div>
        </dl>
      </section>

      <p className="ktp-shop-fine">
        {done ? (
          <>Keep this page&rsquo;s address: it is how you come back to your order.</>
        ) : unpaid ? (
          order.paymentMethod === "etransfer" ? (
            <>
              Once {payeeName} confirms your eTransfer, your order moves to <b>Paid</b> and shipping is arranged with you at <b>{order.customerEmail}</b>. Keep this page&rsquo;s address: it is how you come back to your order.
            </>
          ) : email ? (
            <>
              The piece is held for you until the time shown above. Confirmation goes to <b>{email}</b> as soon as payment clears.
            </>
          ) : (
            <>The piece is held for you until the time shown above. Stripe&rsquo;s page asks for your email and shipping address, and your receipt goes there.</>
          )
        ) : null}
      </p>

      <p className="ktp-shop-actions">
        <Link className="ktp-btn ktp-btn--ghost" href="/#pieces">
          Back to the pieces
        </Link>
      </p>
    </div>
  );
}
