import Link from "next/link";
import type { Metadata } from "next";
import {
  getAdminStats,
  listOrders,
  listStores,
  adminListArtworks,
  adminListActiveCarts,
  adminListUsers,
} from "@elkdonis/commerce/queries";
import {
  listHeld,
  releaseExpiredOrders,
  settleExpiredLots,
} from "@elkdonis/commerce/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Order } from "@elkdonis/commerce/types";
import { requireAdmin } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { OrderActions } from "@/app/studio/_components/order-actions";
import {
  adminCancelOrder,
  adminConfirmOrder,
  adminFulfilOrder,
  adminRefundOrder,
  adminPauseStore,
  adminReactivateStore,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin overview" };

const ORDER_STATUS_STYLE: Record<Order["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  pending_payment: "bg-amber-100 text-amber-800",
  awaiting_etransfer: "bg-amber-100 text-amber-800",
  payment_received: "bg-emerald-100 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-800",
  fulfilled: "bg-emerald-100 text-emerald-800",
  completed: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-100 text-stone-500",
  refunded: "bg-stone-100 text-stone-500",
};

const ARTWORK_STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  available: "bg-emerald-100 text-emerald-800",
  reserved: "bg-amber-100 text-amber-800",
  sold: "bg-stone-200 text-stone-700",
  archived: "bg-stone-100 text-stone-500",
};

const STORE_STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  paused: "bg-stone-200 text-stone-700",
  rejected: "bg-stone-100 text-stone-500",
};

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
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
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminOverviewPage() {
  await requireAdmin();

  // Housekeeping without a scheduler: lapsed payment windows and finished
  // auctions are dealt with whenever an admin (or a seller) looks.
  const [expired, settled] = await Promise.all([
    releaseExpiredOrders().catch(() => 0),
    settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null),
  ]);

  const [stats, orders, stores, artworks, carts, users, held] = await Promise.all([
    getAdminStats(),
    listOrders({ limit: 25 }),
    listStores({ limit: 100, status: ["active", "pending", "paused", "rejected"] }),
    adminListArtworks({ limit: 50 }),
    adminListActiveCarts({ limit: 25 }),
    adminListUsers({ limit: 50 }),
    listHeld({ limit: 50 }).catch(() => []),
  ]);

  const orderActions = {
    confirm: adminConfirmOrder,
    cancel: adminCancelOrder,
    fulfil: adminFulfilOrder,
    refund: adminRefundOrder,
  };
  const heldTotal = held.map((e) => e.amountMinor).reduce((a, b) => a + b, 0);
  const cardAvailable = isCardPaymentAvailable();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Overview</h1>
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

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Users" value={stats.users} href="#users" />
        <Stat label="Active stores" value={stats.artists} href="#stores" />
        <Stat
          label="Pending applications"
          value={stats.pendingApplications}
          href="/admin/applications"
        />
        <Stat label="Artworks" value={stats.artworks} href="#artworks" />
        <Stat label="Listed" value={stats.listedArtworks} href="#artworks" />
        <Stat label="Orders" value={stats.orders} href="#orders" />
        <Stat
          label="Sales"
          value={formatMoney(stats.salesMinor, "CAD")}
          href="#orders"
        />
        <Stat label="Held funds" value={formatMoney(heldTotal, "CAD")} href="#held" />
      </div>

      {/* In-page nav */}
      <nav className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm">
        <a href="#orders" className="text-muted-foreground hover:text-foreground">Orders</a>
        <a href="#stores" className="text-muted-foreground hover:text-foreground">Stores</a>
        <a href="#held" className="text-muted-foreground hover:text-foreground">Held funds</a>
        <a href="#carts" className="text-muted-foreground hover:text-foreground">Carts</a>
        <a href="#artworks" className="text-muted-foreground hover:text-foreground">Artworks</a>
        <a href="#users" className="text-muted-foreground hover:text-foreground">Users</a>
        <Link href="/admin/applications" className="text-muted-foreground hover:text-foreground">
          Applications →
        </Link>
      </nav>

      {/* ORDERS */}
      <section className="mb-12">
        <SectionHeader title="Recent orders" count={stats.orders} id="orders" />
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link href={`/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                        {o.number}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {o.paymentMethod === "stripe" ? "card" : o.paymentMethod}
                        {typeof o.metadata?.kind === "string" ? ` · ${o.metadata.kind}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {o.customerName?.trim() || o.customerEmail}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[o.status]}`}>
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(o.totalMinor, o.currency)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <OrderActions order={o} actions={orderActions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* STORES */}
      <section className="mb-12">
        <SectionHeader title="Stores" count={stores.length} id="stores" />
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          Every front in the marketplace — a person’s or an organisation’s.
          Pausing hides its work and blocks new orders; nothing is deleted.
        </p>
        {stores.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No stores yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Store</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 font-medium">Payouts</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Since</th>
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stores.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      {s.slug ? (
                        <Link href={`/artists/${s.slug}`} className="font-medium underline-offset-4 hover:underline">
                          {s.displayName ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium">{s.displayName ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.ownerKind === "org" ? `org · ${s.ownerOrgId}` : "person"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.ownerKind === "org"
                        ? "earmarked (ledger)"
                        : s.ownerCanReceiveDestinationCharge
                          ? "Stripe"
                          : s.payoutEmail
                            ? "eTransfer"
                            : "none set"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STORE_STATUS_STYLE[s.status] ?? ""}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(s.joinedAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {s.status === "active" ? (
                        <form action={adminPauseStore.bind(null, s.id)}>
                          <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                            Pause
                          </button>
                        </form>
                      ) : s.status === "paused" ? (
                        <form action={adminReactivateStore.bind(null, s.id)}>
                          <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                            Reactivate
                          </button>
                        </form>
                      ) : s.status === "pending" ? (
                        <Link href="/admin/applications" className="text-sm underline underline-offset-4">
                          Review
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* HELD FUNDS */}
      <section className="mb-12">
        <SectionHeader
          title="Held funds"
          count={held.length}
          id="held"
          action={
            <a
              href={`${siteConfig.network.artsCollectiveUrl}/hub/admin/ledger`}
              className="text-sm underline underline-offset-4"
            >
              Release on the hub ledger →
            </a>
          }
        />
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          Money the collective is holding: org shares in their dispute window,
          and card sales to makers who have not finished Stripe onboarding.
          Releases happen on the network ledger, not here.
        </p>
        {held.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing held.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Party</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Since</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {held.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      {e.partyName ?? e.party.orgId ?? e.party.userId ?? "platform"}
                      <span className="ml-1 text-xs text-muted-foreground">({e.party.kind})</span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{e.holdReason?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(e.amountMinor, e.currency as "CAD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CARTS */}
      <section className="mb-12">
        <SectionHeader title="Active carts" count={carts.length} id="carts" />
        {carts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No one has items in their cart right now.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Shopper</th>
                  <th className="px-4 py-2 font-medium">Items</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                  <th className="px-4 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {carts.map((c) => (
                  <tr key={c.cartId} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      {c.userEmail ?? (
                        <span className="text-muted-foreground">Guest · {c.token.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{c.itemCount}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(c.updatedAt)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(c.subtotalMinor, (c.currency as "CAD") ?? "CAD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ARTWORKS */}
      <section className="mb-12">
        <SectionHeader title="Artworks" count={stats.artworks} id="artworks" />
        {artworks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No artworks yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Piece</th>
                  <th className="px-4 py-2 font-medium">Credited to</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Views</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {artworks.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link href={`/artworks/${a.id}`} className="flex items-center gap-3">
                        <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                          {a.primaryImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.primaryImageUrl} alt={a.title} className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="font-medium underline-offset-4 hover:underline">{a.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {a.artistSlug ? (
                        <Link href={`/artists/${a.artistSlug}`} className="underline-offset-4 hover:underline">
                          {a.artistName ?? "—"}
                        </Link>
                      ) : (
                        a.artistName ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${ARTWORK_STATUS_STYLE[a.status] ?? "bg-muted text-muted-foreground"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{a.viewCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {a.priceMinor != null ? formatMoney(a.priceMinor, (a.currency as "CAD") ?? "CAD") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MEMBERS */}
      <section className="mb-4">
        <SectionHeader title="Members" count={users.length} id="users" />
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          People in the network — marketplace sellers and arts-collective
          members. Account-only signups are not shown.
        </p>
        {users.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No members yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Joined</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{u.displayName ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {u.artistStatus && (
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STORE_STATUS_STYLE[u.artistStatus] ?? "bg-muted text-muted-foreground"}`}>
                            store · {u.artistStatus}
                          </span>
                        )}
                        {u.inCollective && (
                          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                            collective
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
