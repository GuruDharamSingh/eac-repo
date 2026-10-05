"use client";

import { useState } from "react";
import { PayoutSetup } from "@elkdonis/commerce/components";
import { canEtransfer, canUseStripeExpress } from "@elkdonis/commerce/payout-rails";
import {
  disconnectPayoutsAction,
  savePayoutSetupAction,
  startStripeOnboardingAction,
} from "@/lib/payout-actions";

export interface PayoutsCardIdentity {
  country: string | null;
  payoutMethod: string | null;
  payoutEmail: string | null;
  hasAccount: boolean;
  onboarded: boolean;
}

/**
 * How the person looking at this page gets paid: where they are, then the ways
 * that can reach them there (the shared PayoutSetup, as on art-auction's
 * /studio/payouts). Their own row, not the site's — the site has no account.
 */
export function PayoutsCard({
  identity,
  cardAvailable,
  returned,
}: {
  identity: PayoutsCardIdentity;
  cardAvailable: boolean;
  /** `?payouts=done|refresh` from Stripe. */
  returned: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const country = identity.country;
  const abroad = country != null && !canEtransfer(country);
  const unreachable = abroad && !canUseStripeExpress(country);

  return (
    <section id="payouts" className="card-natural p-6">
      <h3 className="font-serif text-xl">Getting paid</h3>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">
        {abroad
          ? "Interac e-Transfer only reaches Canadian banks, so outside Canada a connected Stripe account is how you are paid."
          : "Tell us where you are and we will show the ways money can reach you. This is yours, not the site's: services you write are paid to you."}
      </p>

      <PayoutSetup
        initial={{
          country,
          rail: (identity.payoutMethod as "etransfer" | "stripe" | "manual" | null) ?? null,
          payoutEmail: identity.payoutEmail,
        }}
        stripeOnboarded={identity.onboarded}
        stripeAvailable={cardAvailable}
        onSave={savePayoutSetupAction}
        onConnectStripe={startStripeOnboardingAction}
      />

      {!cardAvailable ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Card payments are not switched on for this site yet, so only the other ways are offered.
        </p>
      ) : null}
      {unreachable ? (
        <p className="mt-4 text-sm text-muted-foreground">
          We cannot reach your country through Interac or Stripe, so your share is held for you and arranged directly.
        </p>
      ) : null}

      {returned === "done" && !identity.onboarded && identity.hasAccount ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Stripe has not finished verifying your account yet. Sales still go through; your share is held and released
          the moment Stripe enables payouts.
        </p>
      ) : null}
      {returned === "refresh" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          That Stripe link expired. Press the button above to continue where you left off.
        </p>
      ) : null}
      {identity.onboarded ? (
        <p className="mt-4 text-sm">Stripe is connected. Card sales pay out to your account automatically.</p>
      ) : null}

      {cardAvailable && identity.hasAccount ? (
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Disconnect Stripe and start over? You will choose your country again.")) return;
              setBusy(true);
              setError(null);
              const res = await disconnectPayoutsAction();
              setBusy(false);
              if (res.ok === false) setError(res.error);
              else window.location.reload();
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
          >
            {identity.onboarded ? "Disconnect Stripe" : "Start over with a new account"}
          </button>
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
