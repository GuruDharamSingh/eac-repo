import type { Metadata } from "next";
import { adminListActiveCarts } from "@elkdonis/commerce/queries";
import { listHeld } from "@elkdonis/commerce/server";
import { formatMoney } from "@elkdonis/commerce/money";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Money · Admin" };

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminMoneyPage() {
  const [held, carts] = await Promise.all([
    listHeld({ limit: 50 }).catch(() => []),
    adminListActiveCarts({ limit: 25 }),
  ]);

  return (
    <>
      {/* HELD FUNDS */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-tight">
            Held funds
            <span className="ml-2 text-base text-muted-foreground">({held.length})</span>
          </h2>
          <a
            href={`${siteConfig.network.artsCollectiveUrl}/hub/admin/ledger`}
            className="text-sm underline underline-offset-4"
          >
            Release on the hub ledger →
          </a>
        </div>
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
      <section>
        <h2 className="mb-4 font-serif text-2xl tracking-tight">
          Active carts
          <span className="ml-2 text-base text-muted-foreground">({carts.length})</span>
        </h2>
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
    </>
  );
}
