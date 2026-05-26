import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@elkdonis/auth-server";
import { readCartToken } from "@elkdonis/checkout/server";
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl tracking-tight">Checkout</h1>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]">
        <CheckoutForm
          initialValues={{
            customerEmail: session?.user?.email ?? "",
          }}
          onSubmit={placeOrder}
          submitLabel="Place order"
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
            After placing the order you’ll get Interac eTransfer instructions.
            The artwork stays reserved for you until payment is received.
          </p>
        </aside>
      </div>
    </main>
  );
}
