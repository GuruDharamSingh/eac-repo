import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@elkdonis/auth-server";
import {
  getLotWithArtwork,
  listBidsForLot,
} from "@elkdonis/commerce/queries";
import { BidWidget } from "@elkdonis/commerce/components";
import { ArtworkGallery } from "@/components/artwork-gallery";
import { placeBidAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lot = await getLotWithArtwork(id);
  return { title: lot?.artwork ? `Auction — ${lot.artwork.title}` : "Auction" };
}

export default async function LotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lot = await getLotWithArtwork(id);
  if (!lot || !lot.artwork) notFound();

  const artwork = lot.artwork;
  const [bids, session] = await Promise.all([
    listBidsForLot(lot.id, 12),
    getServerSession().catch(() => null),
  ]);
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/lots" className="underline-offset-4 hover:underline">
          Live auctions
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{artwork.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ArtworkGallery
          images={(artwork.media ?? []).map((m) => ({ url: m.url, alt: m.alt }))}
          title={artwork.title}
        />

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">
              {artwork.title}
            </h1>
            {artwork.artistName && (
              <p className="mt-2 text-lg text-muted-foreground">
                {artwork.artistName}
                {artwork.yearCreated ? ` · ${artwork.yearCreated}` : ""}
              </p>
            )}
            {artwork.medium && (
              <p className="text-sm text-muted-foreground">{artwork.medium}</p>
            )}
          </div>

          <BidWidget
            lot={lot}
            recentBids={bids}
            isAuthenticated={isAuthenticated}
            signInHref="/login"
            onPlaceBid={placeBidAction}
          />

          <p className="text-xs text-muted-foreground">
            Bidding requires a signed-in account. Bids in the last{" "}
            {lot.antiSnipeMinutes} minutes extend the auction by{" "}
            {lot.antiSnipeMinutes} minutes.
            {lot.reserveMinor != null
              ? " This lot has a reserve price that must be met for the sale to complete."
              : ""}
          </p>

          <Link
            href={`/artworks/${artwork.id}`}
            className="text-sm underline-offset-4 hover:underline"
          >
            View full artwork details →
          </Link>
        </div>
      </div>
    </main>
  );
}
