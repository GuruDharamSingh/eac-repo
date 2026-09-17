import Link from "next/link";
import type { Metadata } from "next";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { ArtistProfileForm } from "../_components/artist-profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · Studio" };

export default async function StudioProfilePage() {
  const { store } = await requireStudioStore();
  const isOwn = store.ownerKind === "user";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">
            {isOwn ? "Your profile" : "Store details"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOwn ? (
              <>
                Name, photo and headline are your network identity — the same
                ones on your{" "}
                <a href={siteConfig.network.artdirectUrl} className="underline underline-offset-4">
                  ArtDirect profile
                </a>
                . Payouts are managed from the{" "}
                <Link href="/studio/payouts" className="underline underline-offset-4">
                  studio
                </Link>
                .
              </>
            ) : (
              <>
                The organisation’s name and identity are edited on the{" "}
                <a href={`${siteConfig.network.artsCollectiveUrl}/hub`} className="underline underline-offset-4">
                  org hub
                </a>
                ; only the store’s own blurb and links live here.
              </>
            )}
          </p>
        </div>
        <Link href="/studio" className="text-sm underline underline-offset-4">
          Back to studio
        </Link>
      </header>
      <ArtistProfileForm
        mode="edit"
        storeKind={store.ownerKind}
        initial={{
          displayName: store.displayName,
          headline: store.headline,
          city: store.city,
          photoUrl: store.photoUrl,
          bioHtml: store.bioHtml,
          payoutEmail: store.payoutEmail,
          links: store.links,
        }}
      />
    </main>
  );
}
