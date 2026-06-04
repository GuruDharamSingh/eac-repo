import Link from "next/link";
import type { Metadata } from "next";
import { requireApprovedArtist } from "@/lib/marketplace-auth";
import { ArtworkForm } from "../../_components/artwork-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New artwork · Studio" };

export default async function NewArtworkPage() {
  await requireApprovedArtist();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-4xl tracking-tight">New artwork</h1>
        <Link href="/studio" className="text-sm underline underline-offset-4">
          Back to studio
        </Link>
      </header>
      <ArtworkForm />
    </main>
  );
}
