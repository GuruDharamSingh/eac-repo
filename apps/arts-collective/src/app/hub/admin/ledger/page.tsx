import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { listHeld } from "@elkdonis/commerce/ledger";
import { requireUser } from "@/lib/session";
import { SiteShell } from "@/components/site-shell";
import { HeldFundsTable, type HeldRow } from "@/components/hub/HeldFundsTable";

/**
 * Held funds — what the collective is sitting on and why.
 *
 * An org's share of a sale never leaves the host account: it has no connected
 * account and receives no transfer, so "the org is owed £x" exists only as a
 * ledger balance (migration 098). This is where that balance is looked at and,
 * when appropriate, made payable.
 *
 * Network admin only, deliberately. An org cannot release its own held money —
 * that would make the hold meaningless.
 */
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const user = await requireUser("/login?next=/hub/admin/ledger");
  if (!(await isAdmin(user.id))) notFound();

  const held = await listHeld({ limit: 200 });
  const rows: HeldRow[] = held.map((h) => ({
    id: h.id,
    partyName: h.partyName,
    partyKind: h.party.kind,
    amountMinor: h.amountMinor,
    currency: h.currency,
    holdReason: h.holdReason,
    note: h.note,
    createdAt: h.createdAt,
    orderId: h.orderId,
  }));

  const totals = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] ?? 0) + r.amountMinor;
    return acc;
  }, {});

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Network operations
          </p>
          <h1 className="mt-2 font-serif text-3xl">Held funds</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Money accrued but not yet payable. An organisation&rsquo;s share of a
            sale stays in the collective&rsquo;s account earmarked to it, so this
            is the only place it exists.{" "}
            <a className="underline" href="/hub/admin">
              ← Back to admin
            </a>
          </p>
          {Object.keys(totals).length > 0 && (
            <p className="mt-4 text-sm">
              Currently holding{" "}
              {Object.entries(totals).map(([currency, minor], i) => (
                <span key={currency} className="font-medium">
                  {i > 0 ? ", " : ""}
                  {new Intl.NumberFormat("en-CA", {
                    style: "currency",
                    currency,
                  }).format(minor / 100)}
                </span>
              ))}
              .
            </p>
          )}
        </header>

        <HeldFundsTable rows={rows} />
      </div>
    </SiteShell>
  );
}
