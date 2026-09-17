import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getLotWithArtwork,
  listBidsForLot,
} from "@elkdonis/commerce/queries";
import { settleExpiredLots } from "@elkdonis/commerce/server";
import { BidWidget } from "@elkdonis/commerce/components";
import { ArtworkGallery } from "@/components/artwork-gallery";
import { Button } from "@/components/ui/button";
import { placeBidAction } from "@/app/actions";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";

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
  // Close anything that has run out before drawing this page, so a lot that
  // ended a minute ago already shows its outcome.
  await settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null);

  const lot = await getLotWithArtwork(id);
  if (!lot || !lot.artwork) notFound();

  const artwork = lot.artwork;
  const [bids, userId] = await Promise.all([listBidsForLot(lot.id, 12), getCurrentUserId()]);
  const isAuthenticated = Boolean(userId);
  const closed = !(lot.status === "live" || lot.status === "scheduled");
  const iWon = closed && lot.status === "sold" && userId && lot.winnerUserId === userId;
  const winnerOrderId = (lot.metadata?.orderId as string | undefined) ?? null;

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

          {iWon && (
            <div className="rounded-lg border border-border bg-accent/30 p-5">
              <p className="font-medium">You won this auction.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                An order has been created for you at the hammer price. Pay by card
                or eTransfer within 72 hours to complete the purchase.
              </p>
              {winnerOrderId && (
                <Button asChild size="lg" className="mt-4">
                  <Link href={`/orders/${winnerOrderId}`}>Complete your purchase</Link>
                </Button>
              )}
            </div>
          )}

          <BidWidget
            lot={lot}
            recentBids={bids}
            isAuthenticated={isAuthenticated}
            signInHref={`/login?next=/lots/${lot.id}`}
            onPlaceBid={placeBidAction}
          />

          {closed ? (
            <p className="text-xs text-muted-foreground">
              {lot.status === "sold"
                ? "This auction has ended and the piece is sold to the winning bidder."
                : lot.status === "passed"
                  ? "This auction ended without meeting its reserve. The piece may be available to buy directly."
                  : "This auction was withdrawn."}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Bidding requires a signed-in account. Bids in the last{" "}
              {lot.antiSnipeMinutes} minutes extend the auction by{" "}
              {lot.antiSnipeMinutes} minutes.
              {lot.reserveMinor != null
                ? " This lot has a reserve price that must be met for the sale to complete."
                : ""}{" "}
              The winner receives an order to pay by card or eTransfer within 72
              hours.
            </p>
          )}

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
