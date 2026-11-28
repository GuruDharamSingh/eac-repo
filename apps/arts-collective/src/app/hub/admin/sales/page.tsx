import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import {
  SALES_METHODS,
  SALES_STATUSES,
  listSales,
  orderHref,
  parseSalesFilters,
  salesFilterOptions,
  salesQuery,
  salesTotals,
  type SalesRow,
} from "@/lib/admin-sales";
import { RefundButton } from "./RefundButton";

/**
 * Every sale on the network, read-only: thread orders (incl. network-sold),
 * market orders, booking orders. Network admins only (users.is_admin from the
 * session, server-side; anyone else gets a 404). Refunds go through the
 * `sales-refund` registry entry. Definitions: src/lib/admin-sales.ts.
 */
export const dynamic = "force-dynamic";

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(minor / 100);

type SP = Record<string, string | string[] | undefined>;

export default async function AdminSalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("/login?next=/hub/admin/sales");
  if (!(await isAdmin(user.id))) notFound();

  const sp = await searchParams;
  const filters = parseSalesFilters(sp);
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const [{ rows, next }, totals, options] = await Promise.all([
    listSales(filters, { cursor }),
    salesTotals(filters),
    salesFilterOptions(),
  ]);

  const byCurrency = new Map<string, { gross: number; refunded: number; net: number; orders: number }>();
  for (const t of totals) {
    const c = byCurrency.get(t.currency) ?? { gross: 0, refunded: 0, net: 0, orders: 0 };
    c.gross += t.grossMinor;
    c.refunded += t.refundedMinor;
    c.net += t.netMinor;
    c.orders += t.orders;
    byCurrency.set(t.currency, c);
  }

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-[96rem] space-y-6 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Network operations</p>
          <h1 className="mt-2 font-serif text-3xl">Sales</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Every commerce order across the apps and seller organisations. Gross counts orders whose money was
            received (paid, fulfilled, completed, refunded); refunded is the platform&rsquo;s full refunds. A
            refund made in the Stripe dashboard is not shown.{" "}
            <a className="underline" href="/hub/admin">
              ← Back to admin
            </a>
          </p>
        </header>

        <form method="get" className="grid grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-4 lg:grid-cols-8">
          <Select name="source" label="Source" value={filters.source} options={options.sources} />
          <Select name="org" label="Organisation" value={filters.org} options={options.orgs} />
          <Select name="status" label="Status" value={filters.status} options={[...SALES_STATUSES]} />
          <Select name="method" label="Payment" value={filters.method} options={[...SALES_METHODS]} />
          <Select name="refunded" label="Refunded" value={filters.refunded} options={["yes", "no"]} />
          <Field name="from" label="From" type="date" value={filters.from} />
          <Field name="to" label="To" type="date" value={filters.to} />
          <Field name="seller" label="Seller user id" value={filters.seller} />
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Filter
            </button>
            <a className="underline" href="/hub/admin/sales">
              Clear
            </a>
            <a className="underline" href={`/api/hub/admin/sales${salesQuery(filters)}`}>
              Download CSV (up to 5000 rows)
            </a>
          </div>
        </form>

        <section aria-label="Totals for the filtered set" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byCurrency.size === 0 && <p className="text-sm text-muted-foreground">No orders match.</p>}
          {[...byCurrency.entries()].map(([currency, t]) => (
            <div key={currency} className="rounded-md border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {currency} · {t.orders} order{t.orders === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm">
                Gross <b className="tabular-nums">{money(t.gross, currency)}</b>
              </p>
              <p className="text-sm">
                Refunded <b className="tabular-nums">{money(t.refunded, currency)}</b>
              </p>
              <p className="text-sm">
                Net <b className="tabular-nums">{money(t.net, currency)}</b>
              </p>
            </div>
          ))}
        </section>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1400px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                {["Date", "Buyer", "What", "Seller org", "Line / thread org", "Payee", "Amount", "Payment", "Status", "Refunded", "Stripe reference", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                    No orders match these filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <Row key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>

        <nav className="flex gap-4 text-sm">
          {cursor && (
            <a className="underline" href={`/hub/admin/sales${salesQuery(filters)}`}>
              ← Newest
            </a>
          )}
          {next && (
            <a className="underline" href={`/hub/admin/sales${salesQuery(filters, { cursor: next })}`}>
              Older →
            </a>
          )}
        </nav>
      </div>
    </SiteShell>
  );
}

function Row({ r }: { r: SalesRow }) {
  const href = orderHref(r);
  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
      <td className="px-3 py-2">
        {r.buyerName ?? "—"}
        <p className="text-xs text-muted-foreground">{r.buyerEmail}</p>
      </td>
      <td className="px-3 py-2">
        {r.what || "—"}
        {r.lineCount > 1 && <span className="text-xs text-muted-foreground"> ({r.lineCount} lines)</span>}
        <p className="text-xs text-muted-foreground">
          {r.source}
          {r.networkSale ? " · network sale" : ""}
          {r.sellerUser ? ` · ${r.sellerUser}` : ""}
        </p>
      </td>
      <td className="px-3 py-2">{r.sellerOrg ?? "—"}</td>
      <td className="px-3 py-2 text-xs">
        {[r.lineOrg, r.threadOrg].filter((v, i, a) => v && a.indexOf(v) === i).join(" / ") || "—"}
      </td>
      <td className="px-3 py-2 text-xs">
        {r.payee ?? "—"}
        {r.payeeOrgs.length > 0 && <p className="text-muted-foreground">{r.payeeOrgs.join(", ")}</p>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">{money(r.amountMinor, r.currency)}</td>
      <td className="px-3 py-2">{r.paymentMethod}</td>
      <td className="px-3 py-2">{r.status}</td>
      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.refundedMinor ? money(r.refundedMinor, r.currency) : "—"}</td>
      <td className="px-3 py-2 font-mono text-[11px] leading-snug">
        {r.paymentReference ?? "—"}
        {r.stripeSessionId && <p className="break-all text-muted-foreground">{r.stripeSessionId}</p>}
        {r.stripeRefundReference && <p className="break-all text-muted-foreground">refund {r.stripeRefundReference}</p>}
        <p className="text-muted-foreground">{r.number}</p>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-start gap-2">
          {href && (
            <a className="underline" href={href}>
              Order
            </a>
          )}
          {r.bookingId && <span className="text-xs text-muted-foreground">booking</span>}
          {r.refundable && (
            <RefundButton orderId={r.id} number={r.number} amount={money(r.amountMinor, r.currency)} card={r.paymentMethod === "stripe"} />
          )}
        </div>
      </td>
    </tr>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5">
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ name, label, type = "text", value }: { name: string; label: string; type?: string; value?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input name={name} type={type} defaultValue={value ?? ""} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5" />
    </label>
  );
}
