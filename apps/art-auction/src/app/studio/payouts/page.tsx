import type { Metadata } from "next";
import { listStoreMembers } from "@elkdonis/commerce/queries";
import {
  getBalance,
  getEarningsStatement,
  getPayoutIdentity,
  type Balance,
  type EarningsLine,
} from "@elkdonis/commerce/server";
import { isCardPaymentAvailable, refreshStripeAccountStatus } from "@elkdonis/checkout/stripe";
import { formatMoney } from "@elkdonis/commerce/money";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { PayoutPanel } from "../_components/payout-panel";
import { TeamPanel } from "../_components/team-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts · Studio" };

export default async function StudioPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const { userId, store } = await requireStudioStore();
  const isOwn = store.ownerKind === "user";
  const net = siteConfig.network;

  // Back from Stripe onboarding: ask Stripe whether the account is payable
  // now rather than waiting on the webhook.
  if (isOwn && sp.stripe === "return") {
    await refreshStripeAccountStatus(userId).catch(() => null);
  }

  const [identity, members] = await Promise.all([
    isOwn ? getPayoutIdentity(userId) : Promise.resolve(null),
    isOwn ? Promise.resolve([]) : listStoreMembers(store.id),
  ]);

  const party = isOwn
    ? ({ kind: "user", userId } as const)
    : ({ kind: "org", orgId: store.ownerOrgId! } as const);

  let balance: Balance | null = null;
  let earnings: EarningsLine[] = [];
  try {
    [balance, earnings] = await Promise.all([
      getBalance(party),
      getEarningsStatement(party, { limit: 100 }),
    ]);
  } catch {
    balance = null;
    earnings = [];
  }

  const cardAvailable = isCardPaymentAvailable();

  return (
    <>
      {sp.error && (
        <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {sp.error}
        </p>
      )}

      <section className="mb-12">
        <h2 className="mb-4 font-serif text-2xl tracking-tight">{isOwn ? "Payouts" : "Money"}</h2>
        {isOwn ? (
          <PayoutPanel
            identity={identity}
            balance={balance}
            earnings={earnings}
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

      {!isOwn && (
        <section className="mb-12">
          <h2 className="mb-4 font-serif text-2xl tracking-tight">
            Team
            <span className="ml-2 text-base text-muted-foreground">({members.length})</span>
          </h2>
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
    </>
  );
}
