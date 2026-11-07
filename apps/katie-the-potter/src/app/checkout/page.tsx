import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { readCartToken } from "@elkdonis/checkout/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { getViewer } from "@/lib/auth";
import { cartHasSamplePiece } from "@/lib/sample-guard";
import { CheckoutClient } from "@/components/checkout-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  const lines = cart?.lines ?? [];
  if (!token || !cart || lines.length === 0) redirect("/cart");
  // A line someone else has since reserved cannot be ordered: back to the
  // cart, which says which one.
  if (lines.some((l) => l.artwork?.status !== "available")) redirect("/cart");

  const viewer = await getViewer().catch(() => null);
  const currency = cart.currency;
  const hasSample = await cartHasSamplePiece(token);
  // Card first when it is on: it needs no one to confirm anything by hand.
  // It is withheld for a cart holding a sample piece (lib/sample-guard.ts),
  // and placeOrder refuses it there too. eTransfer is always offered.
  const cardOffered = isCardPaymentAvailable() && !hasSample;

  const paymentMethods = [
    ...(cardOffered
      ? [
          {
            id: "stripe" as const,
            label: "Credit / debit card",
            description: "Pay securely through Stripe. You will return here as soon as the payment clears.",
          },
        ]
      : []),
    {
      id: "etransfer" as const,
      label: "Interac eTransfer",
      description: "Send Katie an Interac eTransfer after placing the order. The piece is held for you until it arrives.",
    },
  ];

  return (
    <div className="ktp-shop ktp-shop--wide">
      <h1 className="ktp-shop-title">Checkout</h1>

      {hasSample ? (
        <p className="ktp-shop-note" data-tone="sample">
          Your cart includes a <b>sample piece</b>, so card payment is not offered. You can still reserve it by Interac eTransfer to try the checkout.
        </p>
      ) : null}

      <div className="ktp-shop-cols">
        <CheckoutClient
          initialValues={{ customerEmail: viewer?.email ?? "", paymentMethod: cardOffered ? "stripe" : "etransfer" }}
          paymentMethods={paymentMethods}
          // One neutral label: the shared form keeps a fixed label whatever rail is
          // picked, and "Continue to payment" read wrong with eTransfer chosen.
          // Card still goes on to Stripe's page after this.
          submitLabel="Place order"
        />

        <aside className="ktp-shop-summary">
          <h2>Order summary</h2>
          <ul>
            {lines.map((l) => (
              <li key={l.id}>
                <span>{l.artwork?.title ?? "A piece"}</span>
                <span>{formatMoney(l.unitPriceMinor * l.quantity, currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="ktp-shop-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(cart.subtotalMinor ?? 0, currency)}</dd>
            </div>
            <div data-muted="true">
              <dt>Shipping</dt>
              <dd>Arranged after you order</dd>
            </div>
            <div data-total="true">
              <dt>Total</dt>
              <dd>{formatMoney(cart.subtotalMinor ?? 0, currency)}</dd>
            </div>
          </dl>
          <p className="ktp-shop-fine">
            {cardOffered
              ? "Pay by card now, or place the order and send an Interac eTransfer. Either way the piece is reserved for you while payment completes."
              : "After placing the order you will see Interac eTransfer instructions. The piece stays reserved for you until payment is received."}
          </p>
        </aside>
      </div>
    </div>
  );
}
