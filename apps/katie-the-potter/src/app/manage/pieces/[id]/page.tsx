import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArtworkForEdit } from "@elkdonis/commerce/queries";
import { loadManageCtx } from "@/lib/manage";
import { UUID_RE } from "@/lib/shop";
import { PieceForm } from "@/components/manage/piece-form";
import { PageHeader } from "@elkdonis/cms-ui/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit a piece" };

export default async function EditPiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, store, canAct } = await loadManageCtx(`/manage/pieces/${id}`);
  if (!store || !UUID_RE.test(id)) notFound();

  // Access is through the store that sells it (its owner or team), not the
  // site role; a piece in another store is "not found" here.
  const piece = await getArtworkForEdit(id, viewer.userId);
  if (!piece || piece.storeId !== store.id) notFound();

  const v = piece.variants?.[0];
  const locked = piece.status === "reserved" || piece.status === "sold";
  const reason = !canAct
    ? "Only the store's owner or its team can change this piece. You are looking at it read-only."
    : locked
      ? `This piece is ${piece.status}. It has an order behind it, so changes are paused; handle that under Orders.`
      : null;

  return (
    <>
      <p className="ktp-m-crumb">
        <Link href="/manage/pieces">← Pieces</Link>
        {piece.status === "available" || locked ? (
          <>
            {" · "}
            <Link href={`/pieces/${piece.slug}`}>See it on the site</Link>
          </>
        ) : null}
      </p>
      <PageHeader title={piece.title} />
      <PieceForm
        readOnlyReason={reason}
        initial={{
          id: piece.id,
          title: piece.title,
          descriptionHtml: piece.descriptionHtml ?? "",
          kind: piece.kind,
          yearCreated: piece.yearCreated ?? null,
          medium: piece.medium ?? "",
          style: piece.style ?? "",
          heightCm: piece.heightCm != null ? Number(piece.heightCm) : null,
          widthCm: piece.widthCm != null ? Number(piece.widthCm) : null,
          depthCm: piece.depthCm != null ? Number(piece.depthCm) : null,
          price: v && v.priceMinor > 0 ? v.priceMinor / 100 : null,
          currency: v?.currency === "USD" ? "USD" : "CAD",
          inventoryQty: v?.inventoryQty && v.inventoryQty > 0 ? v.inventoryQty : 1,
          images: [...(piece.media ?? [])]
            .filter((m) => m.role !== "video")
            .sort((a, b) => a.position - b.position)
            .map((m) => ({ id: m.id, url: m.url, alt: m.alt ?? "" })),
          status: piece.status,
        }}
      />
    </>
  );
}
