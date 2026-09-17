import Link from "next/link";
import type { Metadata } from "next";
import { readCartToken } from "@elkdonis/checkout/server";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { CartLineItem, CartSummary } from "@elkdonis/checkout/components";
import { Button } from "@/components/ui/button";
import { removeFromCart } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  const lines = cart?.lines ?? [];
  const currency = cart?.currency ?? "CAD";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 font-serif text-4xl tracking-tight">Your cart</h1>

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button asChild className="mt-4">
            <Link href="/">Browse artworks</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border border-y border-border">
            {lines.map((line) => (
              <CartLineItem
                key={line.id}
                line={line}
                onRemove={removeFromCart}
                artworkHref={`/artworks/${line.artwork?.id ?? ""}`}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <CartSummary
              subtotalMinor={cart?.subtotalMinor ?? 0}
              currency={currency}
              className="sm:w-64"
            />
            <Button asChild size="lg">
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Shipping is arranged per piece and confirmed by the artist after
            your order is placed.
          </p>
        </>
      )}
    </main>
  );
}
