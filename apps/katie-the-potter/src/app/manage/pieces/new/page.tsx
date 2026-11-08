import Link from "next/link";
import type { Metadata } from "next";
import { loadManageCtx } from "@/lib/manage";
import { PieceForm } from "@/components/manage/piece-form";
import { PageHeader } from "@elkdonis/cms-ui/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a piece" };

export default async function NewPiecePage() {
  const { store, canAct } = await loadManageCtx("/manage/pieces/new");
  const reason = !store
    ? "There is no store yet, so a piece can't be saved. See Overview."
    : store.status !== "active"
      ? "The store is still waiting for approval; pieces can be added once it is active."
      : !canAct
        ? "Only the store's owner or its team can add pieces."
        : null;

  return (
    <>
      <p className="ktp-m-crumb">
        <Link href="/manage/pieces">← Pieces</Link>
      </p>
      <PageHeader title="Add a piece" />
      <PieceForm
        readOnlyReason={reason}
        initial={{ id: null, title: "", descriptionHtml: "", kind: "original", yearCreated: new Date().getFullYear(), medium: "", style: "", heightCm: null, widthCm: null, depthCm: null, weightKg: null, price: null, currency: "CAD", inventoryQty: 1, images: [], status: "draft" }}
      />
    </>
  );
}
