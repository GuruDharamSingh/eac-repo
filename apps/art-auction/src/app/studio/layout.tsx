import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listOrgsUserCanOpenStoreFor } from "@elkdonis/commerce/queries";
import { releaseExpiredOrders, settleExpiredLots } from "@elkdonis/commerce/server";
import { resolveStudioStore, getCurrentUser, signInPath } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { TabNav } from "@/components/ui/tab-nav";
import { LogoutButton } from "@/components/logout-button";
import { StoreSwitcher } from "./_components/store-switcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My art" };

/**
 * "My art" (ORG_STORE_BRIEF D8, D9): the person's hub on the marketplace.
 * Chrome shared by every tab: the guard (signed in), the header, the store
 * switcher when they can act for a store, and the tab bar.
 *
 * A person with no store still gets in (plan Phase F): the overview shows
 * work credited to them and their bids, the Auction series and Profile tabs
 * work without a store, and the header offers to open one. The store tabs
 * (Sales, Auctions, Money, the artwork pages) still need an active store and
 * send them to /studio/apply.
 *
 * The path stays /studio (R10); only the words changed, because the network's
 * authoring Studio on arts-collective keeps the name.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const { userId, store: picked, stores } = await resolveStudioStore();
  if (!userId) redirect(await signInPath());
  const store = picked?.status === "active" ? picked : (stores.find((s) => s.status === "active") ?? null);
  const isOwn = store?.ownerKind === "user";
  const user = await getCurrentUser();

  // Housekeeping for anyone opening the hub; the clock worker also does this.
  const [openable] = await Promise.all([
    listOrgsUserCanOpenStoreFor(userId, siteConfig.marketplaceOrgId),
    releaseExpiredOrders().catch(() => 0),
    settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null),
  ]);

  const tabs = store
    ? [
        { href: "/studio", label: "My art" },
        { href: "/studio/sales", label: "Sales" },
        { href: "/studio/auctions", label: "Auctions" },
        { href: "/studio/payouts", label: isOwn ? "Payouts" : "Money" },
        { href: "/studio/series", label: "Auction series" },
        { href: "/studio/installations", label: "Installations" },
        { href: "/studio/presence", label: "Profile" },
      ]
    : [
        { href: "/studio", label: "My art" },
        { href: "/studio/series", label: "Auction series" },
        { href: "/studio/presence", label: "Profile" },
      ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">My art</h1>
          <p className="mt-1 text-muted-foreground">
            {store
              ? isOwn
                ? `Welcome back, ${store.displayName ?? user?.displayName ?? "artist"}.`
                : `${store.displayName ?? "Organisation store"} — you are ${store.myRole}.`
              : `Welcome, ${user?.displayName ?? "there"}.`}
            {user?.email && <span className="opacity-60"> · {user.email}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {store ? (
            <>
              <Button asChild variant="outline">
                <Link href="/studio/profile">Store details</Link>
              </Button>
              <Button asChild>
                <Link href="/studio/artworks/new">New artwork</Link>
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href="/studio/apply">Open a store</Link>
            </Button>
          )}
          <LogoutButton />
        </div>
      </header>

      {(store || openable.length > 0) && (
        <div className="mb-8">
          {store && <StoreSwitcher current={store} stores={stores} openable={openable} />}
        </div>
      )}

      <TabNav tabs={tabs} />

      {children}
    </main>
  );
}
