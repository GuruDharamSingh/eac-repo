import Link from "next/link";
import type { Metadata } from "next";
import { listStores } from "@elkdonis/commerce/queries";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminPauseStore, adminReactivateStore } from "../actions";

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
  const stores = await listStores({
    limit: 100,
    status: ["active", "pending", "paused", "rejected"],
  });

  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">
        Stores
        <span className="ml-2 text-base text-muted-foreground">({stores.length})</span>
      </h2>
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
                    <Badge tone={STORE_STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(s.joinedAt)}</td>
                  <td className="px-4 py-2 text-right">
                    {s.status === "active" ? (
                      <form action={adminPauseStore.bind(null, s.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Pause
                        </Button>
                      </form>
                    ) : s.status === "paused" ? (
                      <form action={adminReactivateStore.bind(null, s.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Reactivate
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
