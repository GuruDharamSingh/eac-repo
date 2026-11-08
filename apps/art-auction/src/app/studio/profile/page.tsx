import Link from "next/link";
import type { Metadata } from "next";
import { getSellerProfile } from "@elkdonis/commerce/queries";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { toNetworkProfile } from "@/lib/profile-bio";
import { siteConfig } from "@/config/site";
import { ArtistProfileForm } from "../_components/artist-profile-form";
import { ShipFromForm, type ShipFromValue } from "../_components/shipping-forms";
import { getShipFrom, getStoreShippingMode } from "@elkdonis/commerce/shipping";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · My art" };

export default async function StudioProfilePage() {
  const { store, userId } = await requireStudioStore();
  const [shipFrom, shippingMode] = await Promise.all([
    getShipFrom(userId).catch(() => null),
    getStoreShippingMode(store.id).catch(() => "arranged" as const),
  ]);
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

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-serif text-2xl tracking-tight">Shipping</h2>
        <p className="mt-2 mb-4 text-sm text-muted-foreground">
          {shippingMode === "arranged"
            ? "This store arranges shipping with each buyer. "
            : shippingMode === "platform"
              ? "Buyers pick a courier at checkout and the collective buys the label; you print it from Sales. "
              : "Buyers pick a courier at checkout and pay for it; you buy your own label and add tracking in Sales, which releases the shipping money to you. "}
          Couriers quote from your own ship-from address below, for every store that sells your work. Set a
          packed size on each piece (Edit → Shipping).
        </p>
        <ShipFromForm initial={(shipFrom as ShipFromValue | null) ?? null} />
      </section>
    </main>
  );
}
