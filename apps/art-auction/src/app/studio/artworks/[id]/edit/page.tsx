import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkForEdit } from "@elkdonis/commerce/queries";
import { requireApprovedArtist } from "@/lib/marketplace-auth";
import { ArtworkForm } from "../../../_components/artwork-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit artwork · Studio" };

export default async function EditArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireApprovedArtist();
  const artwork = await getArtworkForEdit(id, userId);
  if (!artwork) notFound();

  const defaultVariant = artwork.variants?.[0];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-4xl tracking-tight">Edit artwork</h1>
        <Link href="/studio" className="text-sm underline underline-offset-4">
          Back to studio
        </Link>
      </header>
      <ArtworkForm
        initial={{
          id: artwork.id,
          title: artwork.title,
          descriptionHtml: artwork.descriptionHtml ?? "",
          kind: artwork.kind,
          yearCreated: artwork.yearCreated,
          medium: artwork.medium,
          style: artwork.style,
          subject: artwork.subject,
          heightCm: artwork.heightCm,
          widthCm: artwork.widthCm,
          depthCm: artwork.depthCm,
          certificateOfAuthenticity: artwork.certificateOfAuthenticity,
          provenanceNotes: artwork.provenanceNotes,
          price: defaultVariant ? defaultVariant.priceMinor / 100 : 0,
          inventoryQty: defaultVariant?.inventoryQty ?? 1,
          status: artwork.status,
          images: (artwork.media ?? []).map((m) => ({
            id: m.id,
            url: m.url,
            path: m.nextcloudPath ?? undefined,
            nextcloudFileId: m.nextcloudFileId ?? undefined,
            alt: m.alt ?? "",
          })),
        }}
      />
    </main>
  );
}
