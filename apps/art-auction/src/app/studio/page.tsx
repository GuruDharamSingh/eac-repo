import Link from "next/link";
import type { Metadata } from "next";
import {
  listStoreArtworks,
  listLotsForStore,
  listOrdersForStore,
  listStoreMembers,
  listOrgsUserCanOpenStoreFor,
  listPresentedArtworks,
} from "@elkdonis/commerce/queries";
import {
  getBalance,
  getPayoutIdentity,
  releaseExpiredOrders,
  settleExpiredLots,
  type Balance,
} from "@elkdonis/commerce/server";
import {
  isCardPaymentAvailable,
  refreshStripeAccountStatus,
} from "@elkdonis/checkout/stripe";
import {
  listConversationsForUser,
  getUnreadCount,
} from "@elkdonis/messaging/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Order } from "@elkdonis/commerce/types";
import { requireStudioStore, getCurrentUser } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { LogoutButton } from "@/components/logout-button";
import { ListingActions } from "./_components/listing-actions";
import { LotActions } from "./_components/lot-actions";
import { OrderActions } from "./_components/order-actions";
import { StoreSwitcher } from "./_components/store-switcher";
import { PayoutPanel } from "./_components/payout-panel";
import { TeamPanel } from "./_components/team-panel";
import { RemovePresentedButton } from "./_components/presented-actions";
import {
  cancelOrderAction,
  confirmOrderPaidAction,
  fulfilOrderAction,
  refundOrderAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  available: "bg-emerald-100 text-emerald-800",
  reserved: "bg-amber-100 text-amber-800",
  sold: "bg-stone-200 text-stone-700",
  archived: "bg-stone-100 text-stone-500",
};

const lotStatusStyles: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-800",
  live: "bg-emerald-100 text-emerald-800",
  ended: "bg-stone-200 text-stone-700",
  sold: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-100 text-stone-500",
  passed: "bg-stone-100 text-stone-500",
};

const ORDER_STATUS: Record<Order["status"], { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  pending_payment: { label: "Card — not paid yet", cls: "bg-amber-100 text-amber-800" },
  awaiting_etransfer: { label: "Awaiting eTransfer", cls: "bg-amber-100 text-amber-800" },
  payment_received: { label: "Payment received", cls: "bg-emerald-100 text-emerald-800" },
  paid: { label: "Paid — ship it", cls: "bg-emerald-100 text-emerald-800" },
  fulfilled: { label: "Shipped", cls: "bg-stone-200 text-stone-700" },
  completed: { label: "Completed", cls: "bg-stone-200 text-stone-700" },
  cancelled: { label: "Cancelled", cls: "bg-stone-100 text-stone-500" },
  refunded: { label: "Refunded", cls: "bg-stone-100 text-stone-500" },
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  id,
  action,
}: {
  title: string;
  count?: number;
  id: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 id={id} className="scroll-mt-24 font-serif text-2xl tracking-tight">
        {title}
        {count != null && (
          <span className="ml-2 text-base text-muted-foreground">({count})</span>
        )}
      </h2>
      {action}
    </div>
  );
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; stripe?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { userId, store, stores } = await requireStudioStore(sp.store ?? null);
  const isOwn = store.ownerKind === "user";
  const canManageSales = isOwn || store.myRole === "owner" || store.myRole === "manager";

  // Housekeeping that has no scheduler: release lapsed reservations and close
  // auctions that have run out. Both are cheap when nothing is due.
  await Promise.all([
    releaseExpiredOrders().catch(() => 0),
    settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null),
  ]);
  // Back from Stripe onboarding: ask Stripe whether the account is payable now
  // rather than waiting on the webhook.
  if (isOwn && sp.stripe === "return") {
    await refreshStripeAccountStatus(userId).catch(() => null);
  }

  const [user, artworks, lots, orders, conversations, unread, openable, identity, members, presented] =
    await Promise.all([
      getCurrentUser(),
      listStoreArtworks(store.id),
      listLotsForStore(store.id),
      listOrdersForStore(store.id, { limit: 50 }),
      listConversationsForUser(userId, { limit: 6 }),
      getUnreadCount(userId),
      listOrgsUserCanOpenStoreFor(userId, siteConfig.marketplaceOrgId),
      isOwn ? getPayoutIdentity(userId) : Promise.resolve(null),
      isOwn ? Promise.resolve([]) : listStoreMembers(store.id),
      listPresentedArtworks(store.id),
    ]);

  let balance: Balance | null = null;
  try {
    balance = isOwn
      ? await getBalance({ kind: "user", userId })
      : await getBalance({ kind: "org", orgId: store.ownerOrgId! });
  } catch {
    balance = null;
  }

  const listed = artworks.filter((a) => a.status === "available").length;
  const openLots = lots.filter((l) => l.status === "live" || l.status === "scheduled");
  const openLotByArtwork = new Map(openLots.map((l) => [l.artwork?.id ?? "", l.id]));
  const needsAction = orders.filter(
    (o) => o.status === "awaiting_etransfer" || o.status === "paid" || o.status === "payment_received"
  ).length;
  const cardAvailable = isCardPaymentAvailable();
  const net = siteConfig.network;
  const orderActions = { confirm: confirmOrderPaidAction, cancel: cancelOrderAction, fulfil: fulfilOrderAction, refund: refundOrderAction };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Studio</h1>
          <p className="mt-1 text-muted-foreground">
            {isOwn ? `Welcome back, ${store.displayName ?? user?.displayName ?? "artist"}.` : `${store.displayName ?? "Organisation store"} — you are ${store.myRole}.`}
            {user?.email && <span className="opacity-60"> · {user.email}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/studio/profile"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            {isOwn ? "Edit profile" : "Store details"}
          </Link>
          <Link
            href="/studio/artworks/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New artwork
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mb-8">
        <StoreSwitcher current={store} stores={stores} openable={openable} />
      </div>

      {sp.error && (
        <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {sp.error}
        </p>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Works" value={artworks.length} />
        <Stat label="Listed" value={listed} />
        <Stat label="Sales needing you" value={needsAction} />
        <Stat label="New messages" value={unread} />
      </div>

      {/* In-page nav */}
      <nav className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm">
        <a href="#store" className="text-muted-foreground hover:text-foreground">Store</a>
        {!isOwn && <a href="#presented" className="text-muted-foreground hover:text-foreground">Presented</a>}
        <a href="#sales" className="text-muted-foreground hover:text-foreground">Sales</a>
        <a href="#auctions" className="text-muted-foreground hover:text-foreground">Auctions</a>
        <a href="#payouts" className="text-muted-foreground hover:text-foreground">
          {isOwn ? "Payouts" : "Money"}
        </a>
        {!isOwn && (
          <a href="#team" className="text-muted-foreground hover:text-foreground">Team</a>
        )}
        <a href="#messages" className="text-muted-foreground hover:text-foreground">Messages</a>
        <a href="#network" className="text-muted-foreground hover:text-foreground">Network</a>
      </nav>

      {/* STORE */}
      <section className="mb-12">
        <SectionHeader
          title="Your store"
          count={artworks.length}
          id="store"
          action={
            <div className="flex items-center gap-4 text-sm">
              {store.slug && (
                <Link href={`/artists/${store.slug}`} className="underline underline-offset-4">
                  View public page
                </Link>
              )}
              <Link href="/studio/artworks/new" className="underline underline-offset-4">
                Add a piece
              </Link>
            </div>
          }
        />

        {artworks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No artworks yet.{" "}
            <Link href="/studio/artworks/new" className="underline">
              Create the first piece
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {artworks.map((a) => (
              <li key={a.id} className="flex items-center gap-4 p-4">
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                  {a.primaryImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.primaryImageUrl}
                      alt={a.primaryImageAlt ?? a.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/artworks/${a.id}`}
                    className="truncate font-serif text-lg underline-offset-4 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-medium ${
                        statusStyles[a.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.status}
                    </span>
                    {!isOwn && !a.artistUserId && (
                      <span className="text-muted-foreground">org-owned · no maker</span>
                    )}
                    <span className="text-muted-foreground">
                      {a.viewCount ?? 0} {a.viewCount === 1 ? "view" : "views"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ListingActions
                    artworkId={a.id}
                    status={a.status}
                    openLotId={openLotByArtwork.get(a.id) ?? null}
                  />
                  <Link
                    href={`/studio/artworks/${a.id}/edit`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PRESENTED — other stores' pieces shown in this front */}
      {(presented.length > 0 || !isOwn) && (
        <section className="mb-12">
          <SectionHeader title="Presented pieces" count={presented.length} id="presented" />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            Work sold by other stores that this front shows. The artist still sells it
            and is still paid; a sale through this window is one your agreement with
            them applies to. Add pieces from their page on the marketplace.
          </p>
          {presented.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing presented yet. Open any listed piece and use “Show in {store.displayName ?? "this store"}”.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {presented.map((a) => (
                <li key={a.id} className="flex items-center gap-4 p-4">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                    {a.primaryImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.primaryImageUrl} alt={a.primaryImageAlt ?? a.title} className="h-full w-full object-cover" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/artworks/${a.id}?via=${store.id}`} className="truncate font-serif text-lg underline-offset-4 hover:underline">
                      {a.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.artistName ?? "—"} · {a.status}
                    </p>
                  </div>
                  {canManageSales && <RemovePresentedButton storeId={store.id} artworkId={a.id} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* SALES */}
      <section className="mb-12">
        <SectionHeader title="Sales" count={orders.length} id="sales" />
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No orders yet. When someone buys a piece — or wins one at auction —
            it shows up here for you to confirm payment and ship.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Buyer</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => {
                  const st = ORDER_STATUS[o.status];
                  return (
                    <tr key={o.id} className="align-middle hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Link href={`/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                          {o.number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(o.createdAt)} · {o.paymentMethod === "stripe" ? "card" : o.paymentMethod}
                          {o.metadata?.kind === "auction" ? " · auction" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {o.customerName?.trim() || o.customerEmail}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(o.totalMinor, o.currency)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {canManageSales && <OrderActions order={o} actions={orderActions} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AUCTIONS */}
      <section className="mb-12">
        <SectionHeader title="Auctions" count={openLots.length} id="auctions" />
        {lots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No auctions yet. Any listed piece can go up — use{" "}
            <span className="font-medium text-foreground">Auction</span> on its row above.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {lots.map((lot) => (
              <li key={lot.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/lots/${lot.id}`}
                    className="truncate font-serif text-lg underline-offset-4 hover:underline"
                  >
                    {lot.artwork?.title ?? "Untitled lot"}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lot.status === "scheduled" ? "Starts" : "Ends"}{" "}
                    {new Date(lot.status === "scheduled" ? lot.startAt : lot.endAt).toLocaleString("en-CA")} ·{" "}
                    {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
                    {lot.reserveMinor != null ? ` · reserve ${formatMoney(lot.reserveMinor, lot.currency)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">
                    {formatMoney(lot.currentBidMinor ?? lot.startingBidMinor, lot.currency)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      lotStatusStyles[lot.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {lot.status}
                  </span>
                  {(lot.status === "live" || lot.status === "scheduled") && (
                    <LotActions lotId={lot.id} bidCount={lot.bidCount} />
                  )}
                  {lot.status === "sold" && typeof lot.metadata?.orderId === "string" && (
                    <Link href={`/orders/${lot.metadata.orderId}`} className="text-sm underline underline-offset-4">
                      Order
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PAYOUTS / MONEY */}
      <section className="mb-12">
        <SectionHeader title={isOwn ? "Payouts" : "Money"} id="payouts" />
        {isOwn ? (
          <PayoutPanel
            identity={identity}
            balance={balance}
            cardAvailable={cardAvailable}
            stripeReturn={sp.stripe ?? null}
            ledgerUrl={`${net.artsCollectiveUrl}/hub/admin/ledger`}
          />
        ) : (
          <div className="rounded-lg border border-border p-5 text-sm">
            <p>
              An organisation is never paid directly. Each sale pays the maker;
              the organisation’s share — where the maker has accepted an
              agreement with it, or the whole amount for org-owned work — is
              earmarked for it inside the collective’s account.
            </p>
            {balance && (
              <dl className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payable</dt>
                  <dd className="tabular-nums">{formatMoney(balance.payableMinor, balance.currency as "CAD")}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Held</dt>
                  <dd className="tabular-nums">{formatMoney(balance.heldMinor, balance.currency as "CAD")}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total</dt>
                  <dd className="tabular-nums">{formatMoney(balance.totalMinor, balance.currency as "CAD")}</dd>
                </div>
              </dl>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Agreements are authored on the org hub:{" "}
              <a href={`${net.artsCollectiveUrl}/hub/agreements`} className="underline underline-offset-4">
                agreements
              </a>{" "}
              ·{" "}
              <a href={`${net.artsCollectiveUrl}/hub/admin/ledger`} className="underline underline-offset-4">
                ledger
              </a>
            </p>
          </div>
        )}
      </section>

      {/* TEAM (org stores) */}
      {!isOwn && (
        <section className="mb-12">
          <SectionHeader title="Team" count={members.length} id="team" />
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            Who may list, price and sell through this store. Separate from the
            organisation’s membership on purpose.
          </p>
          <TeamPanel
            members={members}
            canEdit={store.myRole === "owner"}
            selfUserId={userId}
            error={sp.error ?? null}
          />
        </section>
      )}

      {/* MESSAGES */}
      <section className="mb-12">
        <SectionHeader
          title="Messages"
          count={conversations.length}
          id="messages"
          action={
            <Link href="/messages" className="text-sm underline underline-offset-4">
              View all messages
            </Link>
          }
        />
        {conversations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No messages yet. When a collector asks about a piece, the
            conversation shows up here and in your inbox.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {conversations.map((c) => {
              const who =
                c.others.map((o) => o.displayName?.trim() || o.email || "Someone").join(", ") ||
                "Conversation";
              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{who}</span>
                        {c.unreadCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </p>
                      {c.subject && (
                        <p className="truncate text-xs text-muted-foreground">Re: {c.subject}</p>
                      )}
                      {c.lastMessagePreview && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {c.lastMessageSenderId === userId ? "You: " : ""}
                          {c.lastMessagePreview}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(c.lastMessageAt).toLocaleDateString("en-CA")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* NETWORK — the other two centralising sites */}
      <section className="mb-4">
        <SectionHeader title="Across the network" id="network" />
        <div className="grid gap-3 sm:grid-cols-3">
          <a
            href={isOwn && user?.slug ? `${net.artdirectUrl}/${user.slug}` : net.artdirectUrl}
            className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40"
          >
            <p className="font-medium">ArtDirect profile</p>
            <p className="mt-1 text-muted-foreground">
              {isOwn && user?.slug
                ? "Your network-wide profile — bio, gallery, links. Your store name and photo come from it."
                : "The network-wide artist directory."}
            </p>
          </a>
          <a
            href={`${net.artsCollectiveUrl}/hub`}
            className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40"
          >
            <p className="font-medium">Arts Collective hub</p>
            <p className="mt-1 text-muted-foreground">
              Your organisations, workshops and community.
            </p>
          </a>
          <a
            href={`${net.artsCollectiveUrl}/hub/agreements`}
            className="rounded-lg border border-border p-4 text-sm hover:bg-muted/40"
          >
            <p className="font-medium">Agreements</p>
            <p className="mt-1 text-muted-foreground">
              Which organisations take a share of your sales, and on what terms.
              No agreement, no cut.
            </p>
          </a>
        </div>
      </section>
    </main>
  );
}
