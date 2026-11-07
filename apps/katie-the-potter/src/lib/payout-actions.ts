"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setPayoutIdentity } from "@elkdonis/commerce/server";
import { canEtransfer, normaliseCountry } from "@elkdonis/commerce/payout-rails";
import { getApiEditor } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";

// ============================================================================
// Getting paid, for the person asking (sunjay's payout-actions, trimmed).
//
// A payout identity is a PERSON's, not a site's: users.country, payout_method,
// payout_email, stripe_account_id, stripe_onboarded_at (migration 096). One
// Stripe account per person serves every front they sell from; an org holds
// none. So this page edits the SIGNED-IN person's own row. Stripe returns
// people to /api/payouts/return, which asks Stripe whether the account is
// payable yet and stamps it before sending them on.
//
// startStripeOnboardingAction and disconnectPayoutsAction reach Stripe; they
// are only ever called by a person pressing the button.
// ============================================================================

const RETURN_PATH = "/api/payouts/return";

/**
 * Save where they are and the rail that can reach them there. The country is
 * checked against the rail here as well as in the form: a rail is the
 * difference between being paid and not, so it is not taken on the client's word.
 */
export async function savePayoutSetupAction(input: {
  country: string;
  rail: "etransfer" | "stripe" | "manual";
  payoutEmail: string | null;
}): Promise<void> {
  const editor = await getApiEditor();
  if (!editor) redirect("/login?next=/manage/payouts");

  const country = normaliseCountry(input.country);
  if (input.rail === "etransfer") {
    if (!canEtransfer(country)) throw new Error("An Interac e-Transfer can only reach a Canadian bank account.");
    if (!input.payoutEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.payoutEmail)) {
      throw new Error("We need the email to send the e-Transfer to.");
    }
  }
  await setPayoutIdentity(editor.userId, {
    country,
    payoutMethod: input.rail,
    payoutEmail: input.rail === "etransfer" ? input.payoutEmail : null,
  });
  revalidatePath("/manage", "layout");
}

/** Send the person to Stripe Express onboarding, from the country they just saved. */
export async function startStripeOnboardingAction(): Promise<void> {
  const editor = await getApiEditor();
  if (!editor) redirect("/login?next=/manage/payouts");
  const { startPayoutsFor } = await import("@elkdonis/checkout/stripe");
  const res = await startPayoutsFor({
    userId: editor.userId,
    email: editor.email,
    origin: await siteOrigin(),
    returnPath: RETURN_PATH,
    // PayoutSetup saves the country before calling this.
  });
  if (res.ok === false) throw new Error(res.error);
  redirect(res.url);
}

/** Disconnect and forget the country: the only way out of an account created under the wrong one. */
export async function disconnectPayoutsAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Sign in first." };
  const { disconnectPayoutsFor } = await import("@elkdonis/checkout/stripe");
  const res = await disconnectPayoutsFor(editor.userId);
  revalidatePath("/manage", "layout");
  return res;
}
