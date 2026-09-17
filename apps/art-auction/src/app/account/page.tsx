import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  listOrdersForCustomer,
  listFavoriteArtworks,
} from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { ProductGrid } from "@elkdonis/commerce/components";
import type { Order } from "@elkdonis/commerce/types";
import { getCurrentStore, listActableStores, getCurrentUser } from "@/lib/marketplace-auth";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

const STATUS_LABEL: Record<Order["status"], string> = {
  draft: "Draft",
  pending_payment: "Pending payment",
  awaiting_etransfer: "Awaiting eTransfer",
  payment_received: "Payment received",
  paid: "Paid",
  fulfilled: "Fulfilled",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_STYLE: Record<Order["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  pending_payment: "bg-amber-100 text-amber-800",
  awaiting_etransfer: "bg-amber-100 text-amber-800",
  payment_received: "bg-emerald-100 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-800",
  fulfilled: "bg-emerald-100 text-emerald-800",
  completed: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-100 text-stone-500",
  refunded: "bg-stone-100 text-stone-500",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [orders, own, stores, saved] = await Promise.all([
    listOrdersForCustomer(user.id),
    getCurrentStore(),
    listActableStores(),
    listFavoriteArtworks(user.id),
  ]);
  // "You sell here" if any store — own or an org's — is active.
  const artist = own?.status === "active" ? own : (stores.find((s) => s.status === "active") ?? own);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Your account</h1>
          <p className="mt-1 text-muted-foreground">
            {user.displayName?.trim() || user.email}
            {user.displayName && user.email ? (
              <span className="opacity-60"> · {user.email}</span>
            ) : null}
          </p>
        </div>
        <LogoutButton />
      </header>

      {/* Artist / seller status */}
      <section className="mb-10 rounded-lg border border-border p-5">
        {artist?.status === "active" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">You sell on the marketplace.</p>
              <p className="text-sm text-muted-foreground">
                Manage your listings, profile, and sales from your studio.
              </p>
            </div>
            <Button asChild>
              <Link href="/studio">Go to your studio</Link>
            </Button>
          </div>
        ) : artist?.status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Your artist application is under review. We&rsquo;ll email you when
            it&rsquo;s approved.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Are you an artist?</p>
              <p className="text-sm text-muted-foreground">
                Apply to sell your work on the marketplace.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/studio/apply">Sell your work</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Saved pieces */}
      {saved.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-serif text-2xl tracking-tight">
            Saved pieces
          </h2>
          <ProductGrid items={saved} label="Saved pieces" />
        </section>
      )}

      {/* Orders */}
      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">Your orders</h2>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            <p>You haven&rsquo;t placed any orders yet.</p>
            <Button asChild className="mt-4">
              <Link href="/">Browse artworks</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium">Order {o.number}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    <span className="tabular-nums text-sm">
                      {formatMoney(o.totalMinor, o.currency)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
