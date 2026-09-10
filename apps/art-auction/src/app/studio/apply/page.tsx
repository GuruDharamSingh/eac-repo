import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  listStoresForUser,
  listOrgsUserCanOpenStoreFor,
} from "@elkdonis/commerce/queries";
import { canClaimStore } from "@elkdonis/commerce/server";
import { getCurrentStore, getCurrentUserId } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { ArtistProfileForm } from "../_components/artist-profile-form";
import { OpenOrgStoreButton } from "../_components/open-org-store-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sell · Studio" };

/**
 * The one page for "how do I sell here". Three doors, shown as they apply:
 *
 *   * an org store you can already act for → go to the studio
 *   * an org you OWN with no store yet     → open one (no review needed)
 *   * your own store                        → apply (reviewed), or its status
 *
 * Everything hangs off collective membership: a store is a commercial
 * relationship with the collective, so someone with only an account is
 * pointed at the hub to join an organisation first.
 */
export default async function StudioApplyPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio/apply");

  const [own, stores, openable, member] = await Promise.all([
    getCurrentStore(),
    listStoresForUser(userId),
    listOrgsUserCanOpenStoreFor(userId, siteConfig.marketplaceOrgId),
    canClaimStore(userId),
  ]);

  if (own?.status === "active") redirect("/studio");

  const actable = stores.filter((s) => s.status === "active" && s.id !== own?.id);
  const canOpen = openable.filter((o) => !o.storeId);
  const hub = siteConfig.network.artsCollectiveUrl;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">
          {own?.status === "pending"
            ? "Application received"
            : own?.status === "rejected"
              ? "Reapply"
              : "Sell on the marketplace"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Artists are paid directly — by card through Stripe, or by Interac
          eTransfer. An organisation takes a share only where you have agreed
          to it.
        </p>
      </header>

      {/* Org stores you can already act for */}
      {actable.length > 0 && (
        <section className="mb-8 rounded-lg border border-border p-5">
          <p className="font-medium">You can already sell through:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {actable.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/studio?store=${s.id}`}
                  className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {s.displayName ?? "Store"} <span className="ml-1 text-xs text-muted-foreground">({s.myRole})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Orgs you own that could have a store */}
      {(canOpen.length > 0 || openable.some((o) => o.storeId)) && (
        <section className="mb-8 rounded-lg border border-border p-5">
          <p className="font-medium">Organisations you own</p>
          <p className="mt-1 text-sm text-muted-foreground">
            An organisation’s store sells its own work — collective prints,
            merchandise — and can present members’ work under an agreement.
            As its owner you can open one without review.
          </p>
          <ul className="mt-3 space-y-2">
            {openable.map((o) => (
              <li key={o.orgId} className="flex items-center justify-between gap-3 text-sm">
                <span>{o.name}</span>
                {o.storeId ? (
                  <Link href={`/studio?store=${o.storeId}`} className="underline underline-offset-4">
                    Go to its studio
                  </Link>
                ) : (
                  <OpenOrgStoreButton orgId={o.orgId} label="Open a store" />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Your own store */}
      {own?.status === "pending" ? (
        <section className="rounded-lg border border-border p-5">
          <p className="font-medium">Your application is under review.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks, {own.displayName ?? "artist"}. We’ll email you once it’s
            approved. In the meantime, make sure your{" "}
            <a href={`${siteConfig.network.artdirectUrl}`} className="underline underline-offset-4">
              ArtDirect profile
            </a>{" "}
            is up to date — your store uses the same name, photo and bio.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-4">
            Back to the marketplace
          </Link>
        </section>
      ) : !member ? (
        <section className="rounded-lg border border-dashed border-border p-5">
          <p className="font-medium">A store is for members of the collective.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Join an organisation in the network first — that is where payouts,
            agreements and your public profile live. Then come back and claim
            your store.
          </p>
          <a
            href={`${hub}/hub`}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to the Arts Collective hub
          </a>
        </section>
      ) : (
        <section>
          <h2 className="mb-2 font-serif text-2xl">
            {own?.status === "rejected" ? "Reapply for your own store" : "Your own store"}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Tell collectors about yourself. Your name, photo and headline are
            shared with your ArtDirect profile. An eTransfer address is needed
            to apply; card payouts can be connected once you are approved.
          </p>
          {own?.status === "rejected" && own.rejectionReason && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Your previous application was declined: {own.rejectionReason}
            </div>
          )}
          <ArtistProfileForm
            mode="apply"
            initial={{
              displayName: own?.displayName,
              headline: own?.headline,
              city: own?.city,
              photoUrl: own?.photoUrl,
              bioHtml: own?.bioHtml,
              payoutEmail: own?.payoutEmail,
              links: own?.links,
            }}
          />
        </section>
      )}
    </main>
  );
}
