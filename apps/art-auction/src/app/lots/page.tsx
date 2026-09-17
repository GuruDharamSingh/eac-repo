import type { Metadata } from "next";
import { ProductGrid } from "@elkdonis/commerce/components";
import { listLiveAuctionArtworks } from "@elkdonis/commerce/queries";
import { settleExpiredLots } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live auctions" };

export default async function LotsPage() {
  // Lots close lazily: any that have run out are settled (winner's order
  // created, or passed) before the list is drawn. Cheap when nothing is due.
  await settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null);
  const lots = await listLiveAuctionArtworks({ limit: 48 });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Live auctions</h1>
        <p className="mt-2 text-muted-foreground">
          Timed auctions — place a bid before the clock runs out. Bids in the
          final minutes extend the auction to keep things fair. The winner gets
          an order to pay by card or eTransfer.
        </p>
      </header>

      <ProductGrid
        items={lots}
        label="Live auctions"
        emptyState={
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No auctions are running right now. Sellers put pieces up for auction
            from their studio.
          </div>
        }
      />
    </main>
  );
}
