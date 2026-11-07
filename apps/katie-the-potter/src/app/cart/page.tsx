import Link from "next/link";
import type { Metadata } from "next";
import { readCartToken } from "@elkdonis/checkout/server";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { sized } from "@/blocks/media";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { expressCheckoutCart, removeFromCart } from "@/lib/shop-actions";
import { cartHasSamplePiece, SAMPLE_CARD_REFUSAL } from "@/lib/sample-guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

const EXPRESS_NOTES: Record<string, string> = {
  unavailable: "Card payments are not available right now. Use Checkout to pay by Interac eTransfer.",
  sample: SAMPLE_CARD_REFUSAL,
  failed: "We couldn't start the payment. Please try again, or use Checkout.",
};

export default async function CartPage({ searchParams }: { searchParams: Promise<{ express?: string }> }) {
  const { express } = await searchParams;
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  const lines = cart?.lines ?? [];
  const currency = cart?.currency ?? "CAD";
  const unavailable = lines.filter((l) => l.artwork?.status !== "available");
  const hasSample = token && lines.length > 0 ? await cartHasSamplePiece(token) : false;
  // "Pay now": the cart straight to Stripe's page, which collects the email
  // and address (expressCheckoutCart). Same gates as the card option on /checkout.
  const expressOffered = isCardPaymentAvailable() && !hasSample && unavailable.length === 0;
  const expressNote = express ? (EXPRESS_NOTES[express] ?? null) : null;

  return (
    <div className="ktp-shop">
      <h1 className="ktp-shop-title">Your cart</h1>

      {lines.length === 0 ? (
        <div className="ktp-shop-empty">
          <p>Your cart is empty.</p>
          <Link className="ktp-btn" href="/#pieces">
            Browse the pieces
          </Link>
        </div>
      ) : (
        <>
          <ul className="ktp-shop-lines">
            {lines.map((line) => {
              const a = line.artwork;
              const gone = a?.status !== "available";
              return (
                <li key={line.id} className="ktp-shop-line" data-gone={gone ? "true" : undefined}>
                  <Link className="ktp-shop-thumb" href={`/pieces/${encodeURIComponent(a?.slug ?? a?.id ?? "")}`}>
                    {a?.primaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sized(a.primaryImageUrl, 256)} alt="" loading="lazy" />
                    ) : null}
                  </Link>
                  <div className="ktp-shop-line-body">
                    <Link className="ktp-shop-line-title" href={`/pieces/${encodeURIComponent(a?.slug ?? a?.id ?? "")}`}>
                      {a?.title ?? "A piece"}
                    </Link>
                    <p className="ktp-shop-line-meta">One of a kind</p>
                    {gone ? (
                      <p className="ktp-shop-line-warn" role="alert">
                        No longer available: someone else may have reserved it. Remove it to continue.
                      </p>
                    ) : null}
                    <form action={removeFromCart.bind(null, line.id)}>
                      <button type="submit" className="ktp-shop-link-btn">
                        Remove
                      </button>
                    </form>
                  </div>
                  <span className="ktp-shop-line-price">{formatMoney(line.unitPriceMinor * line.quantity, line.currency)}</span>
                </li>
              );
            })}
          </ul>

          {hasSample ? (
            <p className="ktp-shop-note" data-tone="sample">
              Your cart includes a <b>sample piece</b>. Sample pieces can be reserved by Interac eTransfer to try the checkout, but card payment is not open for them yet.
            </p>
          ) : null}

          <div className="ktp-shop-foot">
            <dl className="ktp-shop-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatMoney(cart?.subtotalMinor ?? 0, currency)}</dd>
              </div>
              <div data-muted="true">
                <dt>Shipping</dt>
                <dd>Arranged after you order</dd>
              </div>
              <div data-total="true">
                <dt>Total</dt>
                <dd>{formatMoney(cart?.subtotalMinor ?? 0, currency)}</dd>
              </div>
            </dl>
            <div className="ktp-shop-pay-buttons">
              {unavailable.length > 0 ? (
                <button type="button" className="ktp-btn" disabled>
                  Checkout
                </button>
              ) : (
                <Link className="ktp-btn" href="/checkout">
                  Checkout
                </Link>
              )}
              {expressOffered ? (
                <form action={expressCheckoutCart}>
                  <button type="submit" className="ktp-btn ktp-btn--express">
                    Pay now with card / Google Pay
                  </button>
                </form>
              ) : null}
              <Link className="ktp-btn ktp-btn--ghost" href="/#pieces">
                Continue shopping
              </Link>
            </div>
          </div>
          {expressNote ? (
            <p className="ktp-shop-note" role="alert">
              {expressNote}
            </p>
          ) : null}
          <p className="ktp-shop-fine">
            {expressOffered ? (
              <>
                <b>Checkout</b>: your details here, then card or Interac eTransfer. <b>Pay now</b>: straight to Stripe&rsquo;s secure page (card, Google Pay or Apple Pay), which asks for your email and shipping address.{" "}
              </>
            ) : null}
            Each piece is one of a kind. It is held for you once you place your order. Shipping is arranged after you buy: you&rsquo;ll choose the carrier and pay for the label.
          </p>
        </>
      )}
    </div>
  );
}
