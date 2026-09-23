"use client";

import Link from "next/link";
import type { PayoutIdentity } from "@elkdonis/commerce/types";
import type { Balance, EarningsLine } from "@elkdonis/commerce/server";
import { EarningsStatement, PayoutSetup } from "@elkdonis/commerce/components";
import { canEtransfer, canUseStripeExpress } from "@elkdonis/commerce/payout-rails";
import { Button } from "@/components/ui/button";
import {
  disconnectStripeAction,
  savePayoutSetupAction,
  startStripeOnboardingAction,
} from "../actions";

/**
 * How a PERSON gets paid — on their own row (migration 096), so it is the
 * same whichever fronts present their work.
 *
 * Country is asked first now. Interac e-Transfer reaches Canadian banks and
 * nowhere else, so the old side-by-side "eTransfer or Stripe" pair quietly
 * offered artists abroad a payout email that could never pay them. The rails
 * on offer are derived from where they are (`@elkdonis/commerce/payout-rails`)
 * rather than shown unconditionally.
 *
 * An org store has no payout identity: its share is a ledger balance inside
 * the collective's account.
 */
export function PayoutPanel({
  identity,
  balance,
  earnings,
  cardAvailable,
  stripeReturn,
  ledgerUrl,
}: {
  identity: PayoutIdentity | null;
  balance: Balance | null;
  earnings: EarningsLine[];
  cardAvailable: boolean;
  /** `?stripe=return|refresh` from onboarding. */
  stripeReturn?: string | null;
  ledgerUrl: string;
}) {
  const onboarded = Boolean(identity?.canReceiveDestinationCharge);
  const hasAccount = Boolean(identity?.stripeAccountId);
  const country = identity?.country ?? null;
  const abroad = country != null && !canEtransfer(country);
  const unreachable = country != null && !canEtransfer(country) && !canUseStripeExpress(country);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border p-5">
        <h3 className="font-medium">Getting paid</h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          {abroad
            ? "Interac e-Transfer only reaches Canadian banks, so outside Canada a connected Stripe account is how we pay you."
            : "Tell us where you are and we'll show you the ways we can actually get money to you."}
        </p>

        <PayoutSetup
          initial={{
            country,
            rail: (identity?.payoutMethod as "etransfer" | "stripe" | "manual") ?? null,
            payoutEmail: identity?.payoutEmail ?? null,
          }}
          stripeOnboarded={onboarded}
          stripeAvailable={cardAvailable}
          onSave={savePayoutSetupAction}
          onConnectStripe={startStripeOnboardingAction}
        />

        {unreachable && (
          <p className="mt-4 text-sm text-muted-foreground">
            We can&rsquo;t reach your country through Interac or Stripe, so your share is held
            for you and we&rsquo;ll arrange a transfer directly. Nothing is lost — it&rsquo;s
            all recorded below.
          </p>
        )}

        {/* Stripe's in-between states. The setup control above starts and
            resumes onboarding; these are the things it can't express. */}
        {cardAvailable && hasAccount && !onboarded && (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              {stripeReturn === "return"
                ? "Stripe hasn't finished verifying your account yet. Sales still go through — your share is held for you and released the moment Stripe enables payouts."
                : "Stripe setup was started but not finished. Sales still go through; your share is held for you until Stripe enables payouts."}
            </p>
            <form action={disconnectStripeAction} className="mt-2">
              <button
                type="submit"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Start over with a new account
              </button>
            </form>
          </div>
        )}

        {cardAvailable && onboarded && (
          <form action={disconnectStripeAction} className="mt-4">
            <Button type="submit" variant="outline">
              Disconnect Stripe
            </Button>
          </form>
        )}
      </div>

      <div className="rounded-lg border border-border p-5">
        <h3 className="mb-4 font-medium">Your money</h3>
        <EarningsStatement
          lines={earnings}
          payableMinor={balance?.payableMinor ?? 0}
          heldMinor={balance?.heldMinor ?? 0}
          currency={(balance?.currency as "CAD") ?? "CAD"}
          payoutNote={
            onboarded ? (
              "Card sales pay out to your Stripe account automatically."
            ) : (
              <>
                Settled to you by the collective.{" "}
                <Link href={ledgerUrl} className="underline underline-offset-4">
                  Ledger
                </Link>
              </>
            )
          }
        />
      </div>
    </div>
  );
}
