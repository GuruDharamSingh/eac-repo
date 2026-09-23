/**
 * How a given person can actually be paid, by where they are.
 *
 * This exists because "give us your payout email" is only a real question in
 * Canada. Interac e-Transfer moves money between Canadian banks and nowhere
 * else, so asking an American artist for a payout email collects something
 * that cannot pay them and leaves them believing they are set up.
 *
 * Pure — no database, no Stripe client — so the same rules drive the server
 * check and the form the person fills in, and the two cannot drift.
 */

/**
 * Countries this platform can pay a Stripe connected account in.
 *
 * Read from Stripe's own `country_specs` for CA on 2026-09-19
 * (`supported_transfer_countries`), not from documentation. Notably ABSENT:
 * AU, IN, MX, and most of Asia, Latin America and Africa — a platform in
 * Canada cannot pay a connected account there, so Express is not an answer
 * for those artists no matter how willing they are to onboard.
 *
 * Re-check with:
 *   curl -s https://api.stripe.com/v1/country_specs/CA -u "$STRIPE_SECRET_KEY:"
 */
export const STRIPE_TRANSFER_COUNTRIES = [
  "CA", "US", "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GI", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT",
  "LU", "LV", "MC", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SM", "SI",
  "SK",
] as const;

/** Where Interac e-Transfer reaches. It is a domestic Canadian rail. */
export const ETRANSFER_COUNTRIES = ["CA"] as const;

export type PayoutRail = "etransfer" | "stripe" | "manual";

export interface PayoutRailOption {
  rail: PayoutRail;
  /** Offer this one first. */
  recommended: boolean;
  label: string;
  /** Why this is being offered, in the person's terms. */
  detail: string;
}

/** Normalise whatever is stored in `users.country` to an ISO-3166 alpha-2. */
export function normaliseCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const c = country.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(c)) return c;
  // A few spellings that turn up in profiles typed by hand.
  const named: Record<string, string> = {
    CANADA: "CA",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    USA: "US",
    "UNITED KINGDOM": "GB",
    UK: "GB",
  };
  return named[c] ?? null;
}

export function canEtransfer(country: string | null | undefined): boolean {
  const c = normaliseCountry(country);
  return c != null && (ETRANSFER_COUNTRIES as readonly string[]).includes(c);
}

export function canUseStripeExpress(country: string | null | undefined): boolean {
  const c = normaliseCountry(country);
  return c != null && (STRIPE_TRANSFER_COUNTRIES as readonly string[]).includes(c);
}

/**
 * The rails to offer someone, best first.
 *
 * An unknown country offers everything rather than nothing: a half-filled
 * profile should not block a sale, and the admin settling the money will see
 * the country is missing.
 */
export function payoutRailsFor(country: string | null | undefined): PayoutRailOption[] {
  const c = normaliseCountry(country);
  const options: PayoutRailOption[] = [];

  if (c == null || canEtransfer(c)) {
    options.push({
      rail: "etransfer",
      recommended: true,
      label: "Interac e-Transfer",
      detail:
        "Give us the email you want to be paid at. Nothing to sign up for, and money usually arrives the same day. Canada only.",
    });
  }

  if (c == null || canUseStripeExpress(c)) {
    options.push({
      rail: "stripe",
      // Outside Canada this is the only thing that pays automatically, so it
      // stops being an optional convenience and becomes the answer.
      recommended: !canEtransfer(c),
      label: "Connect a Stripe account",
      detail: canEtransfer(c)
        ? "Your share of each sale is sent to you automatically as it happens. Takes a few minutes to set up once."
        : "Your share is sent automatically as each sale happens. Outside Canada this is the only way we can pay you without a bank wire.",
    });
  }

  if (!options.length) {
    options.push({
      rail: "manual",
      recommended: true,
      label: "We'll arrange it with you",
      detail:
        "We can't reach your country through our usual rails, so we'll sort out a transfer with you directly before your first payout.",
    });
  }

  return options;
}

/** Whether a stored payout setup can actually be paid as it stands. */
export function payoutSetupIssue(input: {
  country: string | null | undefined;
  payoutMethod: string | null | undefined;
  payoutEmail: string | null | undefined;
  stripeOnboardedAt: string | null | undefined;
}): string | null {
  const { country, payoutMethod, payoutEmail, stripeOnboardedAt } = input;

  if (payoutMethod === "stripe") {
    if (!stripeOnboardedAt) return "Stripe setup was started but never finished.";
    if (!canUseStripeExpress(country) && normaliseCountry(country) != null) {
      return "Stripe can't pay an account in this country from our platform.";
    }
    return null;
  }

  if (payoutMethod === "etransfer") {
    if (!payoutEmail) return "No payout email on file.";
    if (normaliseCountry(country) != null && !canEtransfer(country)) {
      return "An e-Transfer can only reach a Canadian bank; this artist is elsewhere.";
    }
    return null;
  }

  if (payoutMethod === "manual") return null;
  return "No payout method chosen yet.";
}
