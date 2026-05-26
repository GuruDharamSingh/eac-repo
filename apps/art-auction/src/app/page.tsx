import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { ArtworkGrid } from "@elkdonis/commerce/components";
import {
  listFeaturedArtworks,
  listLiveAuctionArtworks,
} from "@elkdonis/commerce/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, liveLots] = await Promise.all([
    listFeaturedArtworks({ limit: 8 }),
    listLiveAuctionArtworks({ limit: 4 }),
  ]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {siteConfig.name}
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Original art.
            <br />
            From independent artists.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            {siteConfig.tagline} Browse fixed-price works or place a bid in a
            timed auction. Pay artists directly by Interac eTransfer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/artworks">Browse artworks</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/lots">Live auctions</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live auctions strip */}
      {liveLots.length > 0 && (
        <section className="border-b border-border bg-muted/40">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-serif text-3xl tracking-tight">
                Bidding open now
              </h2>
              <Link
                href="/lots"
                className="text-sm underline-offset-4 hover:underline"
              >
                See all auctions →
              </Link>
            </div>
            <ArtworkGrid items={liveLots} columns={4} showAuctionBadge />
          </div>
        </section>
      )}

      {/* Featured grid */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-serif text-3xl tracking-tight">
              Recent works
            </h2>
            <Link
              href="/artworks"
              className="text-sm underline-offset-4 hover:underline"
            >
              Browse all →
            </Link>
          </div>
          {featured.length === 0 ? (
            <p className="text-muted-foreground">
              No artwork is listed yet. Once artists join the marketplace and
              publish work, it will appear here.
            </p>
          ) : (
            <ArtworkGrid items={featured} columns={4} />
          )}
        </div>
      </section>
    </main>
  );
}
