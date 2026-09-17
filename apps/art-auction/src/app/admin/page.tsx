import Link from "next/link";
import { getAdminStats } from "@elkdonis/commerce/queries";
import { listHeld } from "@elkdonis/commerce/server";
import { formatMoney } from "@elkdonis/commerce/money";

export const dynamic = "force-dynamic";

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
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminOverviewPage() {
  const [stats, held] = await Promise.all([
    getAdminStats(),
    listHeld({ limit: 50 }).catch(() => []),
  ]);
  const heldTotal = held.map((e) => e.amountMinor).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Users" value={stats.users} href="/admin/users" />
      <Stat label="Active stores" value={stats.artists} href="/admin/stores" />
      <Stat
        label="Pending applications"
        value={stats.pendingApplications}
        href="/admin/applications"
      />
      <Stat label="Artworks" value={stats.artworks} href="/admin/artworks" />
      <Stat label="Listed" value={stats.listedArtworks} href="/admin/artworks" />
      <Stat label="Orders" value={stats.orders} href="/admin/orders" />
      <Stat label="Sales" value={formatMoney(stats.salesMinor, "CAD")} href="/admin/orders" />
      <Stat label="Held funds" value={formatMoney(heldTotal, "CAD")} href="/admin/money" />
    </div>
  );
}
