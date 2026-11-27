import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getSellerProfile,
  listStoresForUser,
  listOrgsUserCanOpenStoreFor,
} from "@elkdonis/commerce/queries";
import { canClaimStore } from "@elkdonis/commerce/server";
import { getArtistAgreement, listAffiliationOrgs } from "@elkdonis/services";
import { sanitizeRichText } from "@elkdonis/utils";
import { getCurrentStore, getCurrentUserId } from "@/lib/marketplace-auth";
import { toNetworkProfile } from "@/lib/profile-bio";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ArtistProfileForm } from "../_components/artist-profile-form";
import { OpenOrgStoreButton } from "../_components/open-org-store-button";
import { JoinCollectiveCard } from "../_components/join-collective-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sell · My art" };

/**
 * The one page for "how do I sell here". Three doors, shown as they apply:
 *
 *   * an org store you can already act for → go to the studio
 *   * an org you OWN with no store yet     → open one (no review needed)
 *   * your own store                        → apply (opens at once while stores are auto-approved), or its status
 *
 * Everything hangs off collective membership: a store is a commercial
 * relationship with the collective. Someone with only an account first joins
 * as an artist (accepts the artist agreement, optionally says which orgs they
 * already belong to), which makes them an `oad` member.
 */
export default async function StudioApplyPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio/apply");

  // The profile is read from `users` directly: a first-time applicant has no
  // store row yet, and their name, photo and bio usually exist already from
  // another network site.
  const [own, stores, openable, member, me] = await Promise.all([
    getCurrentStore(),
    listStoresForUser(userId),
    listOrgsUserCanOpenStoreFor(userId, siteConfig.marketplaceOrgId),
    canClaimStore(userId),
    getSellerProfile(userId),
  ]);

  if (own?.status === "active") redirect("/studio");

  // Only needed (and only read) for someone who has not joined yet.
  const [agreement, affiliationOrgs] = member
    ? ([null, []] as [Awaited<ReturnType<typeof getArtistAgreement>>, Awaited<ReturnType<typeof listAffiliationOrgs>>])
    : await Promise.all([getArtistAgreement(), listAffiliationOrgs()]);

  const actable = stores.filter((s) => s.status === "active" && s.id !== own?.id);
  const canOpen = openable.filter((o) => !o.storeId);
  const hub = siteConfig.network.artsCollectiveUrl;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
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
                <Button asChild variant="outline" size="sm">
                  <Link href={`/studio?store=${s.id}`}>
                    {s.displayName ?? "Store"} <span className="ml-1 text-xs text-muted-foreground">({s.myRole})</span>
                  </Link>
                </Button>
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
        <JoinCollectiveCard
          agreement={
            agreement
              ? {
                  id: agreement.id,
                  title: agreement.title,
                  bodyHtml: sanitizeRichText(agreement.bodyHtml ?? ""),
                }
              : null
          }
          orgs={affiliationOrgs}
          hubUrl={`${hub}/hub`}
        />
      ) : (
        <section>
          <h2 className="mb-2 font-serif text-2xl">
            {own?.status === "rejected" ? "Reapply for your own store" : "Your own store"}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Your store is presented under the profile you already have in the
            network. Check it, add a store note if you like, and give an
            eTransfer address; card payouts can be connected once your
            store is open.
          </p>
          {own?.status === "rejected" && own.rejectionReason && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Your previous application was declined: {own.rejectionReason}
            </div>
          )}
          <ArtistProfileForm
            mode="apply"
            profile={toNetworkProfile(me, siteConfig.network.artdirectUrl)}
            initial={{
              bioHtml: own?.bioHtml,
              payoutEmail: own?.payoutEmail ?? me?.payoutEmail,
              links: own?.links,
            }}
          />
        </section>
      )}
    </main>
  );
}
