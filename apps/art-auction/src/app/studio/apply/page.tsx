import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentArtist, getCurrentUserId } from "@/lib/marketplace-auth";
import { ArtistProfileForm } from "../_components/artist-profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply · Studio" };

export default async function StudioApplyPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio/apply");

  const artist = await getCurrentArtist();

  if (artist?.status === "active") redirect("/studio");

  if (artist?.status === "pending") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-serif text-3xl">Application received</h1>
        <p className="mt-3 text-muted-foreground">
          Thanks, {artist.displayName ?? "artist"}. Your application is under
          review. We’ll email you once it’s approved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          Back to the marketplace
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">
          {artist?.status === "rejected" ? "Reapply" : "Become a seller"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about yourself to start publishing and selling your work.
        </p>
        {artist?.status === "rejected" && artist.rejectionReason && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Your previous application was declined: {artist.rejectionReason}
          </div>
        )}
      </header>
      <ArtistProfileForm
        mode="apply"
        initial={{
          displayName: artist?.displayName,
          headline: artist?.headline,
          city: artist?.city,
          photoUrl: artist?.photoUrl,
          bioHtml: artist?.bioHtml,
          payoutEmail: artist?.payoutEmail,
          links: artist?.links,
        }}
      />
    </main>
  );
}
