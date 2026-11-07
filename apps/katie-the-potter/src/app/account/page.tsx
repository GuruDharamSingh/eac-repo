import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { listOrdersForCustomer } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { getViewer } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import "../manage/manage.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

const STATUS: Record<string, string> = {
  pending_payment: "Payment not completed",
  awaiting_etransfer: "Awaiting your eTransfer",
  payment_received: "Payment received",
  paid: "Paid",
  fulfilled: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Sunjay's /account, trimmed: who you are, your role here, your orders on this site. */
export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  // Orders placed while signed in on this site (guest orders have no account to list under).
  const orders = (await listOrdersForCustomer(viewer.userId, { limit: 25 }).catch(() => [])).filter((o) => o.status !== "draft");

  return (
    <div className="ktp-m ktp-m--narrow">
      <h1 className="ktp-m-title">Your account</h1>

      <section className="ktp-m-card">
        <h2>Sign-in</h2>
        <dl className="ktp-m-kv">
          <div>
            <dt>Email</dt>
            <dd>{viewer.email}</dd>
          </div>
          <div>
            <dt>Role here</dt>
            <dd>{viewer.role ?? "Visitor"}</dd>
          </div>
        </dl>
        <p className="ktp-m-fine">This account works across every site in the Arts Collective network. Your role is set separately on each one.</p>
        <p className="ktp-m-actions">
          {viewer.canEdit ? (
            <Link className="ktp-btn" href="/manage">
              Manage the shop
            </Link>
          ) : null}
          <SignOutButton />
        </p>
      </section>

      <section className="ktp-m-card">
        <h2>Your orders</h2>
        {orders.length === 0 ? (
          <p>Nothing yet. Orders you place while signed in show up here.</p>
        ) : (
          <ul className="ktp-m-plain">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`}>{o.number}</Link> · {STATUS[o.status] ?? o.status} · {formatMoney(o.totalMinor, o.currency)}{" "}
                <span className="ktp-m-fine">{new Date(o.createdAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
