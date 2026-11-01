import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkForEdit } from "@elkdonis/commerce/queries";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { ArtworkForm } from "../../../_components/artwork-form";
import { listingContext } from "../../../listing-context";

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

  const defaultVariant = artwork.variants?.[0];
  const ctx = await listingContext(store);
  const donation = (artwork.provenance ?? []).find((p) => p.kind === "donated") ?? null;

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
        initial={{
          id: artwork.id,
          creditedArtistUserId: artwork.creditedArtistUserId ?? null,
          creditedArtistName: artwork.creditedArtistName ?? null,
          creditStatus: artwork.creditStatus,
          estimateLow: artwork.estimateLowMinor != null ? artwork.estimateLowMinor / 100 : null,
          estimateHigh: artwork.estimateHighMinor != null ? artwork.estimateHighMinor / 100 : null,
          donation: donation
            ? {
                fromUserId: donation.fromUserId ?? null,
                fromName: donation.fromName ?? null,
                fromText: donation.fromText ?? null,
                toOrgId: donation.toOrgId ?? null,
                occurredOn: donation.occurredOn ?? null,
                note: donation.note ?? null,
              }
            : null,
          beneficiaryPayeeId: defaultVariant?.beneficiaryPayeeId ?? null,
          beneficiaryScope: defaultVariant?.beneficiaryScope ?? null,
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
          currency: (defaultVariant?.currency ?? "CAD") as "CAD" | "USD" | "EUR",
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
