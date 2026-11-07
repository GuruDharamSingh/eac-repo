import type { Metadata } from "next";
import { getBalance, getEarningsStatement, getPayoutIdentity, type Balance, type EarningsLine } from "@elkdonis/commerce/server";
import { EarningsStatement } from "@elkdonis/commerce/components";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { loadManageCtx } from "@/lib/manage";
import { PayoutsCard } from "@/components/manage/payouts-card";
import { Notice, PageHeader } from "@elkdonis/cms-ui/manage";
import "@elkdonis/commerce/commerce.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

/**
 * Payouts: the SIGNED-IN person's own payout identity (a payout identity is a
 * person's, not a site's) and their money. Sunjay's pattern with the shared
 * PayoutSetup and EarningsStatement. Reading this page calls no Stripe API;
 * Stripe is only reached from the buttons inside PayoutSetup.
 */
export default async function ManagePayouts({ searchParams }: { searchParams: Promise<{ payouts?: string }> }) {
  const sp = await searchParams;
  const { viewer, store, isStoreOwner } = await loadManageCtx("/manage/payouts");

  const identity = await getPayoutIdentity(viewer.userId).catch(() => null);
  let balance: Balance | null = null;
  let earnings: EarningsLine[] = [];
  try {
    const party = { kind: "user", userId: viewer.userId } as const;
    [balance, earnings] = await Promise.all([getBalance(party), getEarningsStatement(party, { limit: 100 })]);
  } catch {
    balance = null;
    earnings = [];
  }
  const onboarded = Boolean(identity?.stripeOnboardedAt);

  return (
    <>
      <PageHeader title="Payouts" description="How money reaches you, and what you are owed. This is yours as a person: the same wherever you sell." />
      {store && !isStoreOwner ? (
        <Notice>
          Sales are paid to the store&rsquo;s owner. What you set here is <b>your own</b> payout detail, not the shop&rsquo;s.
        </Notice>
      ) : null}

      <PayoutsCard
        identity={{
          country: identity?.country ?? null,
          payoutMethod: identity?.payoutMethod ?? null,
          payoutEmail: identity?.payoutEmail ?? null,
          hasAccount: Boolean(identity?.stripeAccountId),
          onboarded,
        }}
        cardAvailable={isCardPaymentAvailable()}
        returned={sp.payouts ?? null}
      />

      <section className="ktp-m-card eac-commerce">
        <h2>Your money</h2>
        <EarningsStatement
          lines={earnings}
          payableMinor={balance?.payableMinor ?? 0}
          heldMinor={balance?.heldMinor ?? 0}
          currency={(balance?.currency as "CAD") ?? "CAD"}
          payoutNote={onboarded ? "Card sales pay out to your Stripe account automatically." : "Settled to you by the collective."}
        />
      </section>
    </>
  );
}
