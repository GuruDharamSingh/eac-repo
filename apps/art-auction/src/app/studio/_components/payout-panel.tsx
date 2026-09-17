import Link from "next/link";
import type { PayoutIdentity } from "@elkdonis/commerce/types";
import type { Balance } from "@elkdonis/commerce/server";
import { formatMoney } from "@elkdonis/commerce/money";
import { Button } from "@/components/ui/button";
import {
  disconnectStripeAction,
  setPayoutEmailAction,
  startStripeOnboardingAction,
} from "../actions";

/**
 * How a PERSON gets paid — on their own row (migration 096), so it is the
 * same whichever fronts present their work. Two routes, either is enough:
 *
 *   eTransfer  buyers send it to this address; the seller confirms receipt
 *   Stripe     Express account; card sales transfer to it automatically
 *
 * Shown on a person's own store only. An org store has no payout identity:
 * its share is a ledger balance inside the collective's account.
 */
export function PayoutPanel({
  identity,
  balance,
  cardAvailable,
  stripeReturn,
  ledgerUrl,
}: {
  identity: PayoutIdentity | null;
  balance: Balance | null;
  cardAvailable: boolean;
  /** `?stripe=return|refresh` from onboarding. */
  stripeReturn?: string | null;
  ledgerUrl: string;
}) {
  const onboarded = Boolean(identity?.canReceiveDestinationCharge);
  const hasAccount = Boolean(identity?.stripeAccountId);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* eTransfer */}
      <div className="rounded-lg border border-border p-5">
        <h3 className="font-medium">Interac eTransfer</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Buyers who choose eTransfer send it straight to this address. You
          confirm it arrived from your sales list.
        </p>
        <form action={setPayoutEmailAction} className="mt-3 flex gap-2">
          <input
            name="payoutEmail"
            type="email"
            defaultValue={identity?.payoutEmail ?? ""}
            placeholder="you@example.com"
            className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <Button type="submit" variant="outline">
            Save
          </Button>
        </form>
        {!identity?.payoutEmail && !onboarded && (
          <p className="mt-2 text-xs text-destructive">
            Without an eTransfer address or an active card account, your pieces
            cannot be bought.
          </p>
        )}
      </div>

      {/* Stripe */}
      <div className="rounded-lg border border-border p-5">
        <h3 className="font-medium">Card payouts (Stripe)</h3>
        {!cardAvailable ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Card payments are not switched on for this site yet. When they are,
            you will be able to connect a Stripe account here and card sales
            will pay out to it automatically.
          </p>
        ) : onboarded ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Active.</span> Card
              sales of your work transfer to your Stripe account on Stripe’s
              payout schedule. Any org cut you have agreed to is taken before
              the transfer.
            </p>
            <form action={disconnectStripeAction} className="mt-3">
              <Button type="submit" variant="outline">
                Disconnect
              </Button>
            </form>
          </>
        ) : hasAccount ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {stripeReturn === "return"
                ? "Stripe has not finished verifying your account yet. Card sales still go through — the money is held for you and released the moment Stripe enables payouts."
                : "Onboarding was started but not finished. Card sales still go through; the money is held for you until Stripe enables payouts."}
            </p>
            <form action={startStripeOnboardingAction} className="mt-3 flex gap-2">
              <Button type="submit">Continue Stripe setup</Button>
            </form>
            <form action={disconnectStripeAction} className="mt-2">
              <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                Start over with a new account
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a Stripe Express account and card sales pay out to you
              automatically — no waiting on anyone to forward a transfer.
              Takes a few minutes; Stripe handles identity checks.
            </p>
            <form action={startStripeOnboardingAction} className="mt-3">
              <Button type="submit">Set up card payouts</Button>
            </form>
          </>
        )}
      </div>

      {/* Balance */}
      {balance && (balance.totalMinor !== 0 || balance.heldMinor !== 0) && (
        <div className="rounded-lg border border-border p-5 md:col-span-2">
          <h3 className="font-medium">Held by the collective for you</h3>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Card sales taken before your Stripe account was active land here
            and are settled to you by the collective.{" "}
            <Link href={ledgerUrl} className="underline underline-offset-4">
              Ledger
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
