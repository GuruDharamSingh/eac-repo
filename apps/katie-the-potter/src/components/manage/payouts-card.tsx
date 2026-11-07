"use client";

import { useState } from "react";
import { PayoutSetup } from "@elkdonis/commerce/components";
import { canEtransfer, canUseStripeExpress } from "@elkdonis/commerce/payout-rails";
import { disconnectPayoutsAction, savePayoutSetupAction, startStripeOnboardingAction } from "@/lib/payout-actions";

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
 * /studio/payouts and sunjay's /manage). Their own row, not the site's.
 * Copied from sunjay's payouts-card with this site's classes.
 */
export function PayoutsCard({ identity, cardAvailable, returned }: { identity: PayoutsCardIdentity; cardAvailable: boolean; returned: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const country = identity.country;
  const abroad = country != null && !canEtransfer(country);
  const unreachable = abroad && !canUseStripeExpress(country);

  return (
    <section id="payouts" className="ktp-m-card eac-commerce">
      <h2>Getting paid</h2>
      <p className="ktp-m-fine">
        {abroad
          ? "Interac e-Transfer only reaches Canadian banks, so outside Canada a connected Stripe account is how you are paid."
          : "Tell us where you are and we will show the ways money can reach you. This is yours, not the site's."}
      </p>

      <PayoutSetup
        initial={{ country, rail: (identity.payoutMethod as "etransfer" | "stripe" | "manual" | null) ?? null, payoutEmail: identity.payoutEmail }}
        stripeOnboarded={identity.onboarded}
        stripeAvailable={cardAvailable}
        onSave={savePayoutSetupAction}
        onConnectStripe={startStripeOnboardingAction}
      />

      {!cardAvailable ? <p className="ktp-m-fine">Card payments are not switched on for this site yet, so only the other ways are offered.</p> : null}
      {unreachable ? <p className="ktp-m-fine">We cannot reach your country through Interac or Stripe, so your share is held for you and arranged directly.</p> : null}
      {returned === "done" && !identity.onboarded && identity.hasAccount ? (
        <p className="ktp-m-fine">Stripe has not finished verifying your account yet. Sales still go through; your share is held and released the moment Stripe enables payouts.</p>
      ) : null}
      {returned === "refresh" ? <p className="ktp-m-fine">That Stripe link expired. Press the button above to continue where you left off.</p> : null}
      {identity.onboarded ? <p className="ktp-m-status" data-tone="ok">Stripe is connected. Card sales pay out to your account automatically.</p> : null}

      {cardAvailable && identity.hasAccount ? (
        <p>
          <button
            type="button"
            disabled={busy}
            className="ktp-m-linkbtn"
            onClick={async () => {
              if (!window.confirm("Disconnect Stripe and start over? You will choose your country again.")) return;
              setBusy(true);
              setError(null);
              const res = await disconnectPayoutsAction();
              setBusy(false);
              if (res.ok === false) setError(res.error);
              else window.location.reload();
            }}
          >
            {identity.onboarded ? "Disconnect Stripe" : "Start over with a new account"}
          </button>
          {error ? <span className="ktp-m-msg">{error}</span> : null}
        </p>
      ) : null}
    </section>
  );
}
