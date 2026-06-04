import Link from "next/link";
import type { Metadata } from "next";
import { requireApprovedArtist } from "@/lib/marketplace-auth";
import { ArtistProfileForm } from "../_components/artist-profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · Studio" };

export default async function StudioProfilePage() {
  const { artist } = await requireApprovedArtist();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-4xl tracking-tight">Your profile</h1>
        <Link
          href="/studio"
          className="text-sm underline underline-offset-4"
        >
          Back to studio
        </Link>
      </header>
      <ArtistProfileForm
        mode="edit"
        initial={{
          displayName: artist.displayName,
          headline: artist.headline,
          city: artist.city,
          photoUrl: artist.photoUrl,
          bioHtml: artist.bioHtml,
          payoutEmail: artist.payoutEmail,
          links: artist.links,
        }}
      />
    </main>
  );
}
