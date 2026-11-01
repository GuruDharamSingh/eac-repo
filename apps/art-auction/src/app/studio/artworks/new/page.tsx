import Link from "next/link";
import type { Metadata } from "next";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { ArtworkForm } from "../../_components/artwork-form";
import { listingContext } from "../../listing-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New artwork · My art" };

export default async function NewArtworkPage() {
  const { store } = await requireStudioStore();
  const ctx = await listingContext(store);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">New artwork</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listing in {store.displayName ?? "your store"}.
          </p>
        </div>
        <Link href="/studio" className="text-sm underline underline-offset-4">
          Back to My art
        </Link>
      </header>
      <ArtworkForm
        allowMakerChoice={store.ownerKind === "org"}
        beneficiaries={ctx.beneficiaries}
        orgOptions={ctx.orgOptions}
      />
    </main>
  );
}
