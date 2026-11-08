import type { ReactNode } from "react";
import type { Metadata } from "next";
import { listPendingStoreApplications } from "@elkdonis/commerce/queries";
import { releaseExpiredOrders, settleExpiredLots } from "@elkdonis/commerce/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { requireKeeper } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { TabNav } from "@/components/ui/tab-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin overview" };

/**
 * Chrome shared by every admin tab: the guard, the housekeeping pass (lapsed
 * payment windows, finished auctions — runs once per visit regardless of
 * tab), and the tab bar. Was one ~530-line page; each tab now fetches only
 * what it renders.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin: admin } = await requireKeeper();

  const [expired, settled, pendingApplications] = await Promise.all([
    releaseExpiredOrders().catch(() => 0),
    settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null),
    listPendingStoreApplications().catch(() => []),
  ]);
  const cardAvailable = isCardPaymentAvailable();

  const allTabs = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/stores", label: "Stores" },
    { href: "/admin/artworks", label: "Artworks" },
    { href: "/admin/users", label: "Members" },
    { href: "/admin/money", label: "Money" },
    { href: "/admin/series", label: "Series" },
    { href: "/admin/pages", label: "Pages" },
    { href: "/admin/visitors", label: "Visitors" },
    { href: "/admin/applications", label: "Applications", count: pendingApplications.length },
  ];
  // Marketplace owners who are not platform admins get the two tabs that show
  // and hide work; every other page redirects them away.
  const tabs = admin ? allTabs : allTabs.filter((t) => t.href === "/admin/stores" || t.href === "/admin/artworks");

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          Everything across the marketplace — people, work, and money.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Card payments: {cardAvailable ? "on (Stripe)" : "off — set STRIPE_SECRET_KEY to enable"}.
          {expired > 0 ? ` Released ${expired} expired order${expired === 1 ? "" : "s"}.` : ""}
          {settled && (settled.sold > 0 || settled.passed > 0)
            ? ` Closed ${settled.sold + settled.passed} auction${settled.sold + settled.passed === 1 ? "" : "s"} (${settled.sold} sold).`
            : ""}
        </p>
      </header>

      <TabNav tabs={tabs} />

      {children}
    </main>
  );
}
