/**
 * @elkdonis/payments — provider-agnostic payments abstraction.
 *
 * Usage:
 *   const registry = new PaymentProviderRegistry()
 *     .register(createEtransferProvider({ defaultPayoutEmail: "..." }));
 *   const stripe = getStripeProvider();          // null when no STRIPE_SECRET_KEY
 *   if (stripe) registry.register(stripe);
 *   const result = await registry.get("etransfer").initiate({...});
 *
 * Orders, settlement and the ledger live in @elkdonis/commerce; the glue that
 * turns an order into a Stripe session (and a webhook back into a paid order)
 * is @elkdonis/checkout/stripe. This package only knows how to talk to rails.
 */

export type {
  PaymentProvider,
  PaymentProviderId,
  InitiateInput,
  InitiateLine,
  InitiateResult,
  ConfirmInput,
  ConfirmResult,
  RefundInput,
  RefundResult,
  PaymentDisplay,
} from "./types";

export { PaymentProviderRegistry } from "./registry";
export { createEtransferProvider, type EtransferProviderOptions } from "./providers/etransfer";
export {
  createStripeProvider,
  getStripeProvider,
  getStripeConfigFromEnv,
  isStripeConfigured,
  type StripeProvider,
  type StripeProviderOptions,
  type StripeCheckoutLine,
  type StripeCheckoutSession,
  type StripeCheckoutSessionStatus,
  type StripeAccountStatus,
  type CreateCheckoutSessionInput,
} from "./providers/stripe";
