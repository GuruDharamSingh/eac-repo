import type { Metadata } from "next";
import { adminListActiveCarts } from "@elkdonis/commerce/queries";
import { listHeld, listPayable, getMarketplaceSettings } from "@elkdonis/commerce/server";
import { db } from "@elkdonis/db";
import { formatMoney } from "@elkdonis/commerce/money";
import { siteConfig } from "@/config/site";
import { OwedTable, ReleaseButton, SettingsForm, ApprovePayeeButton, type OwedRow } from "./money-panels";

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
  const [held, carts, payable, settings, suggested] = await Promise.all([
    listHeld({ limit: 50 }).catch(() => []),
    adminListActiveCarts({ limit: 25 }),
    listPayable({ limit: 100 }).catch(() => []),
    getMarketplaceSettings("market"),
    db<Array<{ id: string; name: string; website: string | null; managed_by_org_id: string | null }>>`
      SELECT p.id, p.name, p.website, p.managed_by_org_id
      FROM payee p WHERE p.status = 'suggested' ORDER BY p.created_at ASC
    `.catch(() => []),
  ]);
  const owed: OwedRow[] = payable.map((p) => ({
    partyKind: p.party.kind,
    partyId: p.party.userId ?? p.party.orgId ?? p.party.payeeId ?? "",
    partyName: p.partyName ?? p.party.userId ?? p.party.orgId ?? p.party.payeeId ?? "platform",
    payableMajor: p.payableMinor / 100,
    heldMajor: p.heldMinor / 100,
    currency: p.currency,
    owedSince: p.owedSince,
    payoutMethod: p.payoutMethod,
    payoutEmail: p.payoutEmail,
  }));

  return (
    <>
      {/* SETTINGS */}
      <section className="mb-12">
        <h2 className="mb-1 font-serif text-2xl tracking-tight">Marketplace settings</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          The flat commission the collective keeps on a sale (the artist receives the price less this
          and the card fee), and the auction defaults a series inherits.
        </p>
        <SettingsForm
          defaultCommissionRate={settings.defaultCommissionRate}
          softCloseMinutes={settings.softCloseMinutes}
          paymentWindowHours={settings.paymentWindowHours}
        />
      </section>

      {/* OWED */}
      <section className="mb-12">
        <h2 className="mb-1 font-serif text-2xl tracking-tight">
          Owed
          <span className="ml-2 text-base text-muted-foreground">({owed.length})</span>
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Everyone the collective currently owes payable money: makers paid by platform charge or
          recorded sale, organisations' commission once released, and beneficiaries. Record a payout
          here once the money has been sent.
        </p>
        <OwedTable rows={owed} />
      </section>

      {/* SUGGESTED BENEFICIARIES */}
      {suggested.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-1 font-serif text-2xl tracking-tight">
            Suggested beneficiaries
            <span className="ml-2 text-base text-muted-foreground">({suggested.length})</span>
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Charities buyers named at checkout. Money directed to them is held until one is approved
            (here, or by the organisation that manages it).
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {suggested.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  {p.name}
                  {p.website && (
                    <a className="ml-2 text-xs underline underline-offset-4" href={p.website} target="_blank" rel="noopener">
                      {p.website}
                    </a>
                  )}
                  {p.managed_by_org_id && <span className="ml-2 text-xs text-muted-foreground">for {p.managed_by_org_id}</span>}
                </span>
                <ApprovePayeeButton payeeId={p.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
            Network ledger →
          </a>
        </div>
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          Money the collective is holding: commission in its dispute window, beneficiary shares
          waiting on approval, and card sales to makers who have not finished Stripe onboarding.
          Releasing makes the amount payable.
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {held.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      {e.partyName ?? e.party.orgId ?? e.party.userId ?? e.party.payeeId ?? "platform"}
                      <span className="ml-1 text-xs text-muted-foreground">({e.party.kind})</span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{e.holdReason?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(e.amountMinor, e.currency as "CAD")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.holdReason === "pending_beneficiary" ? (
                        <span className="text-xs text-muted-foreground">approve the beneficiary first</span>
                      ) : (
                        <ReleaseButton entryId={e.id} />
                      )}
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
