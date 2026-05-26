import type { Metadata } from "next";
import { ArtworkGrid } from "@elkdonis/commerce/components";
import { listLiveAuctionArtworks } from "@elkdonis/commerce/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live auctions" };

export default async function LotsPage() {
  const lots = await listLiveAuctionArtworks({ limit: 48 });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Live auctions</h1>
        <p className="mt-2 text-muted-foreground">
          Timed auctions — place a bid before the clock runs out. Bids in the
          final minutes extend the auction to keep things fair.
        </p>
      </header>

      <ArtworkGrid
        items={lots}
        columns={4}
        showAuctionBadge
        emptyState={
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No auctions are running right now. Check back soon.
          </div>
        }
      />
    </main>
  );
}
