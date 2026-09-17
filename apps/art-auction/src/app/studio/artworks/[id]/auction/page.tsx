import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkForEdit, getOpenLotForArtwork } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { LotForm } from "../../../_components/lot-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Put up for auction · Studio" };

export default async function AuctionArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireStudioStore();
  const artwork = await getArtworkForEdit(id, userId);
  if (!artwork) notFound();

  const open = await getOpenLotForArtwork(artwork.id);
  if (open) redirect(`/lots/${open.id}`);

  const variant = artwork.variants?.[0];
  const listPrice = variant ? variant.priceMinor / 100 : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Put up for auction</h1>
          <p className="mt-2 text-muted-foreground">
            {artwork.title}
            {variant ? ` · listed at ${formatMoney(variant.priceMinor, variant.currency)}` : ""}
          </p>
        </div>
        <Link href="/studio" className="text-sm underline underline-offset-4">
          Back to studio
        </Link>
      </header>

      {artwork.status !== "available" ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          Publish the piece first — only a listed piece can go to auction.{" "}
          <Link href={`/studio/artworks/${artwork.id}/edit`} className="underline">
            Edit it
          </Link>
          .
        </div>
      ) : (
        <LotForm
          artworkId={artwork.id}
          listPrice={listPrice}
          currency={variant?.currency ?? "CAD"}
        />
      )}
    </main>
  );
}
