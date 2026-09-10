import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@elkdonis/auth-server";
import { readCartToken } from "@elkdonis/checkout/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { CartSummary, CheckoutForm } from "@elkdonis/checkout/components";
import { formatMoney } from "@elkdonis/commerce/money";
import { placeOrder } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  if (!cart || (cart.lines?.length ?? 0) === 0) {
    redirect("/cart");
  }

  const session = await getServerSession().catch(() => null);
  const currency = cart.currency;
  const lines = cart.lines ?? [];
  const cardAvailable = isCardPaymentAvailable();

  // Card first when it is on: it is the path that needs no one to confirm
  // anything by hand. eTransfer is always offered — it needs no configuration
  // and some sellers only take it.
  const paymentMethods = [
    ...(cardAvailable
      ? [
          {
            id: "stripe" as const,
            label: "Credit / debit card",
            description:
              "Pay securely through Stripe. The piece is yours as soon as the payment clears.",
          },
        ]
      : []),
    {
      id: "etransfer" as const,
      label: "Interac eTransfer",
      description: cardAvailable
        ? "Send the artist an Interac eTransfer after placing the order. The piece is held for you until they confirm it arrived."
        : "Send the artist an Interac eTransfer after placing the order.",
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl tracking-tight">Checkout</h1>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]">
        <CheckoutForm
          initialValues={{
            customerEmail: session?.user?.email ?? "",
            paymentMethod: cardAvailable ? "stripe" : "etransfer",
          }}
          paymentMethods={paymentMethods}
          onSubmit={placeOrder}
          submitLabel={cardAvailable ? "Continue to payment" : "Place order"}
        />

        <aside className="h-fit rounded-lg border border-border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 font-serif text-xl">Order summary</h2>
          <ul className="mb-4 flex flex-col gap-3">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {l.artwork?.title ?? "Artwork"}
                  {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                </span>
                <span className="tabular-nums">
                  {formatMoney(l.unitPriceMinor * l.quantity, currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-4">
            <CartSummary
              subtotalMinor={cart.subtotalMinor ?? 0}
              currency={currency}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {cardAvailable
              ? "Pay by card now, or place the order and send an Interac eTransfer. Either way the piece is reserved for you while payment completes."
              : "After placing the order you’ll get Interac eTransfer instructions. The artwork stays reserved for you until payment is received."}
          </p>
        </aside>
      </div>
    </main>
  );
}
