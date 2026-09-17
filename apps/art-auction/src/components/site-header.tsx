import Link from "next/link";
import { readCartToken } from "@elkdonis/checkout/server";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { getUnreadCount } from "@elkdonis/messaging/queries";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  listActableStores,
  getCurrentUser,
  getIsAdmin,
} from "@/lib/marketplace-auth";
import { SiteNav, type NavLink } from "./site-nav";

export async function SiteHeader() {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  const count = cart?.lines?.length ?? 0;

  const [user, stores, admin] = await Promise.all([
    getCurrentUser(),
    listActableStores(),
    getIsAdmin(),
  ]);
  const unread = user ? await getUnreadCount(user.id) : 0;
  // Any store the person can act for — their own or an org's — opens the studio.
  const seller = stores.some((s) => s.status === "active");
  const studioHref = seller ? "/studio" : "/studio/apply";

  const links: NavLink[] = [
    { href: "/", label: "Artworks" },
    { href: "/lots", label: "Auctions" },
    { href: "/artists", label: "Artists" },
    { href: "/gallery", label: "3D gallery" },
    // Also a standing button beside the cart on wide screens, so in the row
    // it would be the same link twice.
    { href: studioHref, label: seller ? "Studio" : "Sell your work", narrowOnly: true },
    // Messages has its own link beside the cart on wide screens, where it
    // carries the unread count; in the narrow menu it belongs with the rest.
    ...(user ? [{ href: "/messages", label: "Messages", narrowOnly: true }] : []),
    ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="shrink-0 font-serif text-xl tracking-tight">
          {siteConfig.name}
        </Link>

        <SiteNav links={links} />

        <div className="flex items-center gap-3 text-sm">
          {user && (
            <Link
              href="/messages"
              className="relative hidden items-center underline-offset-4 hover:underline md:inline-flex"
            >
              Messages
              {unread > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )}

          {/* Selling is the marketplace's second business and its growth
              engine, so it gets a standing button rather than one link in a
              row of six. Members who already sell get their studio instead. */}
          <Button
            asChild
            variant="outline"
            className="hidden border-primary font-medium text-primary hover:bg-primary hover:text-primary-foreground lg:inline-flex"
          >
            <Link href={studioHref}>{seller ? "Studio" : "Sell your work"}</Link>
          </Button>

          {user ? (
            <Link
              href="/account"
              className="hidden underline-offset-4 hover:underline sm:inline"
              title={user.email ?? undefined}
            >
              {user.displayName?.trim() || "Account"}
            </Link>
          ) : (
            <Link href="/login" className="underline-offset-4 hover:underline">
              Sign in
            </Link>
          )}

          <Button asChild variant="outline" className="gap-1.5">
            <Link
              href="/cart"
              aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
            >
              Cart
              {count > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
