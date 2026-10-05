"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getPayoutIdentity, setPayoutIdentity } from "@elkdonis/commerce/server";
import { canEtransfer, normaliseCountry } from "@elkdonis/commerce/payout-rails";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import { getViewer } from "@/lib/auth";

// ============================================================================
// Getting paid, for the person asking.
//
// A payout identity is a person's, not a site's: `users.country`,
// `payout_method`, `payout_email`, `stripe_account_id`, `stripe_onboarded_at`
// (migration 096). One Stripe account per person serves every front they sell
// from, and an org holds no connected account of its own (commerce.md). So
// Para Theater has no Stripe address separate from its owner's: whoever writes
// a service is the one who is paid, and each owner or guide connects their own
// here (on /manage and in the profile popup) — the same flow art-auction's
// /studio/payouts and IFAC's popup use.
//
// Stripe returns people to /api/payouts/return, which asks Stripe whether the
// account is payable yet and stamps it (refreshStripeAccountStatus) before
// sending them on. The work itself is @elkdonis/checkout's startPayoutsFor.
// ============================================================================

const RETURN_PATH = "/api/payouts/return";

async function origin(): Promise<string> {
  return publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
}

/** What the profile popup's Payouts tab shows. Any signed-in person: being payable is personal. */
export async function loadProfilePageAction() {
  const viewer = await getViewer();
  if (!viewer) return { sections: [], payouts: null };
  const identity = await getPayoutIdentity(viewer.userId);
  const { PAYOUT_ONBOARDING_COPY } = await import("@elkdonis/checkout/stripe");
  return {
    // This site has no optional page sections to switch on.
    sections: [],
    payouts: {
      available: Boolean(process.env.STRIPE_SECRET_KEY),
      state: identity?.stripeOnboardedAt
        ? ("ready" as const)
        : identity?.stripeAccountId
          ? ("pending" as const)
          : ("none" as const),
      accountLabel: identity?.stripeAccountId ?? null,
      country: identity?.country ?? null,
      onboarding: PAYOUT_ONBOARDING_COPY,
    },
  };
}

/** The popup has no sections here; the connector is required by its type. */
export async function setProfileSectionAction(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "There are no page sections to switch on here." };
}

/** Popup: begin (or resume) Stripe Express onboarding; the surface sends the browser to `url`. */
export async function startPayoutsAction(
  country?: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const { startPayoutsFor } = await import("@elkdonis/checkout/stripe");
  return startPayoutsFor({
    userId: viewer.userId,
    email: viewer.email,
    origin: await origin(),
    returnPath: RETURN_PATH,
    country,
  });
}

/** Disconnect and forget the country: the only way out of an account created under the wrong one. */
export async function disconnectPayoutsAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  const { disconnectPayoutsFor } = await import("@elkdonis/checkout/stripe");
  const res = await disconnectPayoutsFor(viewer.userId);
  revalidatePath("/manage");
  return res;
}

// ── /manage ─────────────────────────────────────────────────────────────────

/**
 * Save where they are and the rail that can reach them there.
 *
 * The country is checked against the rail here as well as in the form: a rail
 * is the difference between being paid and not, so it is not taken on the
 * client's word.
 */
export async function savePayoutSetupAction(input: {
  country: string;
  rail: "etransfer" | "stripe" | "manual";
  payoutEmail: string | null;
}): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/manage");

  const country = normaliseCountry(input.country);
  if (input.rail === "etransfer") {
    if (!canEtransfer(country)) throw new Error("An Interac e-Transfer can only reach a Canadian bank account.");
    if (!input.payoutEmail) throw new Error("We need the email to send the e-Transfer to.");
  }
  await setPayoutIdentity(viewer.userId, {
    country,
    payoutMethod: input.rail,
    payoutEmail: input.rail === "etransfer" ? input.payoutEmail : null,
  });
  revalidatePath("/manage");
}

/** /manage: send the person to Stripe Express onboarding, from the country they just saved. */
export async function startStripeOnboardingAction(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/manage");
  const { startPayoutsFor } = await import("@elkdonis/checkout/stripe");
  const res = await startPayoutsFor({
    userId: viewer.userId,
    email: viewer.email,
    origin: await origin(),
    returnPath: RETURN_PATH,
    // PayoutSetup saves the country before calling this.
  });
  if (res.ok === false) throw new Error(res.error);
  redirect(res.url);
}
