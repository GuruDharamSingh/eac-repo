import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { listOrgsUserCanOpenStoreFor } from "@elkdonis/commerce/queries";
import { releaseExpiredOrders, settleExpiredLots } from "@elkdonis/commerce/server";
import { requireStudioStore, getCurrentUser } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { TabNav } from "@/components/ui/tab-nav";
import { LogoutButton } from "@/components/logout-button";
import { StoreSwitcher } from "./_components/store-switcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

/**
 * Chrome shared by every studio tab: the guard (signed in, active store to
 * act for), the header, the store switcher, and the tab bar. Each tab below
 * is its own route and fetches only what it renders — this used to be one
 * 600-line page fetching all of it at once.
 *
 * A layout cannot read `searchParams` (Next.js only gives that to
 * page.tsx), so store selection here is cookie-only. A `?store=` deep link
 * (used by /studio/apply) is promoted into the cookie by the Overview page
 * before this layout ever renders it — see studio/page.tsx.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const { userId, store, stores } = await requireStudioStore();
  const isOwn = store.ownerKind === "user";
  const user = await getCurrentUser();

  // Housekeeping with no scheduler: lapsed payment windows and finished
  // auctions are dealt with whenever anyone opens the studio. Cheap when
  // nothing is due.
  const [openable] = await Promise.all([
    listOrgsUserCanOpenStoreFor(userId, siteConfig.marketplaceOrgId),
    releaseExpiredOrders().catch(() => 0),
    settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null),
  ]);

  const tabs = [
    { href: "/studio", label: "Overview" },
    { href: "/studio/sales", label: "Sales" },
    { href: "/studio/auctions", label: "Auctions" },
    { href: "/studio/payouts", label: isOwn ? "Payouts" : "Money" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Studio</h1>
          <p className="mt-1 text-muted-foreground">
            {isOwn
              ? `Welcome back, ${store.displayName ?? user?.displayName ?? "artist"}.`
              : `${store.displayName ?? "Organisation store"} — you are ${store.myRole}.`}
            {user?.email && <span className="opacity-60"> · {user.email}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/studio/profile">{isOwn ? "Edit profile" : "Store details"}</Link>
          </Button>
          <Button asChild>
            <Link href="/studio/artworks/new">New artwork</Link>
          </Button>
          <LogoutButton />
        </div>
      </header>

      <div className="mb-8">
        <StoreSwitcher current={store} stores={stores} openable={openable} />
      </div>

      <TabNav tabs={tabs} />

      {children}
    </main>
  );
}
