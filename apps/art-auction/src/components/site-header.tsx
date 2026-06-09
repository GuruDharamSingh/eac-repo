import Link from "next/link";
import { readCartToken } from "@elkdonis/checkout/server";
import { getCartByToken } from "@elkdonis/commerce/queries";
import { getUnreadCount } from "@elkdonis/messaging/queries";
import { siteConfig } from "@/config/site";
import {
  getCurrentArtist,
  getCurrentUser,
  getIsAdmin,
} from "@/lib/marketplace-auth";

export async function SiteHeader() {
  const token = await readCartToken();
  const cart = token ? await getCartByToken(token) : null;
  const count = cart?.lines?.length ?? 0;

  const [user, artist, admin] = await Promise.all([
    getCurrentUser(),
    getCurrentArtist(),
    getIsAdmin(),
  ]);
  const unread = user ? await getUnreadCount(user.id) : 0;
  const studioHref = artist?.status === "active" ? "/studio" : "/studio/apply";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="font-serif text-xl tracking-tight">
          {siteConfig.name}
        </Link>
        <nav className="hidden gap-6 text-sm md:flex">
          <Link href="/artworks" className="underline-offset-4 hover:underline">
            Artworks
          </Link>
          <Link href="/lots" className="underline-offset-4 hover:underline">
            Auctions
          </Link>
          <Link href="/artists" className="underline-offset-4 hover:underline">
            Artists
          </Link>
          <Link href={studioHref} className="underline-offset-4 hover:underline">
            {artist?.status === "active" ? "Studio" : "Sell"}
          </Link>
          {admin && (
            <Link href="/admin" className="underline-offset-4 hover:underline">
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          {user && (
            <Link
              href="/messages"
              className="relative inline-flex items-center underline-offset-4 hover:underline"
            >
              Messages
              {unread > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )}
          {user ? (
            <Link
              href={artist?.status === "active" ? "/studio" : "/account"}
              className="underline-offset-4 hover:underline"
              title={user.email ?? undefined}
            >
              {user.displayName?.trim() || "Account"}
            </Link>
          ) : (
            <Link href="/login" className="underline-offset-4 hover:underline">
              Sign in
            </Link>
          )}
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 underline-offset-4 hover:bg-muted"
          >
            Cart
            {count > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
