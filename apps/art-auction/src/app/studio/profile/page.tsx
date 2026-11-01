import Link from "next/link";
import type { Metadata } from "next";
import { getSellerProfile } from "@elkdonis/commerce/queries";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { toNetworkProfile } from "@/lib/profile-bio";
import { siteConfig } from "@/config/site";
import { ArtistProfileForm } from "../_components/artist-profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · My art" };

export default async function StudioProfilePage() {
  const { store } = await requireStudioStore();
  const isOwn = store.ownerKind === "user";
  // From users, not the store: the store's slug falls back to a raw id, which
  // ArtDirect cannot resolve.
  const me = isOwn && store.ownerUserId ? await getSellerProfile(store.ownerUserId) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">
            {isOwn ? "Your store" : "Store details"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isOwn ? (
              <>
                The store shows your network profile, plus a store note and
                links of its own. Payouts are managed from the{" "}
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
          Back to My art
        </Link>
      </header>
      <ArtistProfileForm
        mode="edit"
        storeKind={store.ownerKind}
        profile={isOwn ? toNetworkProfile(me, siteConfig.network.artdirectUrl) : undefined}
        initial={{
          bioHtml: store.bioHtml,
          payoutEmail: store.payoutEmail,
          links: store.links,
        }}
      />
    </main>
  );
}
