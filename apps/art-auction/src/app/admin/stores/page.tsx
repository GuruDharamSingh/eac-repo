import Link from "next/link";
import type { Metadata } from "next";
import { listStores } from "@elkdonis/commerce/queries";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminPauseStore, adminReactivateStore, adminSetStoreShippingMode } from "../actions";
import { listStoreShippingModes } from "@elkdonis/commerce/shipping";
import { requireKeeper } from "@/lib/marketplace-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stores · Admin" };

const STORE_STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  active: "success",
  pending: "pending",
  paused: "neutral",
  rejected: "destructive",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminStoresPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  const { isAdmin } = await requireKeeper();
  const [stores, shippingModes] = await Promise.all([
    listStores({ limit: 100, status: ["active", "pending", "paused", "rejected"] }),
    listStoreShippingModes().catch(() => ({}) as Record<string, string>),
  ]);

  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">
        Stores
        <span className="ml-2 text-base text-muted-foreground">({stores.length})</span>
      </h2>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Every front in the marketplace — a person’s or an organisation’s.
        Pause hides the store and all its work from the site and blocks new orders; Reactivate shows it again. Nothing is deleted.
        Shipping sets who buys the courier label; buyers get Easyship quotes in the first two.
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
                <th className="px-4 py-2 font-medium">Shipping</th>
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
                    {isAdmin ? (
                    <form action={adminSetStoreShippingMode.bind(null, s.id)} className="flex items-center gap-2">
                      <select
                        name="mode"
                        defaultValue={shippingModes[s.id] ?? "quote"}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        aria-label="Shipping mode"
                      >
                        <option value="quote">Quote; seller buys label</option>
                        <option value="platform">Quote; platform buys label</option>
                        <option value="arranged">Arranged with buyer</option>
                      </select>
                      <Button type="submit" variant="outline" size="sm">Set</Button>
                    </form>
                    ) : (
                      <span className="text-muted-foreground">{shippingModes[s.id] ?? "quote"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={STORE_STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(s.joinedAt)}</td>
                  <td className="px-4 py-2 text-right">
                    {s.status === "active" ? (
                      <form action={adminPauseStore.bind(null, s.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Hide store
                        </Button>
                      </form>
                    ) : s.status === "paused" ? (
                      <form action={adminReactivateStore.bind(null, s.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Show store
                        </Button>
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
  );
}
