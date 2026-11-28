import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkForEdit } from "@elkdonis/commerce/queries";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { ArtworkForm } from "../../../_components/artwork-form";
import { listingContext } from "../../../listing-context";
import { artworkFormInitial } from "../../../artwork-initial";
import { ParcelForm } from "../../../_components/shipping-forms";
import { getArtworkParcel } from "@elkdonis/commerce/shipping";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit artwork · My art" };

export default async function EditArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, store } = await requireStudioStore();
  const artwork = await getArtworkForEdit(id, userId);
  if (!artwork) notFound();

  const parcel = await getArtworkParcel(artwork.id).catch(() => null);
  const ctx = await listingContext(store);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-4xl tracking-tight">Edit artwork</h1>
        <Link href="/studio" className="text-sm underline underline-offset-4">
          Back to My art
        </Link>
      </header>
      <ArtworkForm
        allowMakerChoice={store.ownerKind === "org"}
        beneficiaries={ctx.beneficiaries}
        orgOptions={ctx.orgOptions}
        initial={artworkFormInitial(artwork)}
      />

      <section id="shipping" className="mt-12 border-t border-border pt-8">
        <h2 className="font-serif text-2xl tracking-tight">Shipping</h2>
        <p className="mt-2 mb-4 text-sm text-muted-foreground">
          The size and weight of the piece as packed for the courier. Buyers get live courier prices from it.
          Without it, the quote uses the piece&rsquo;s own size plus 8&nbsp;cm a side and 1.5&nbsp;kg for packing;
          with no size at all, shipping is arranged with the buyer.
        </p>
        <ParcelForm artworkId={artwork.id} initial={parcel} />
      </section>
    </main>
  );
}
