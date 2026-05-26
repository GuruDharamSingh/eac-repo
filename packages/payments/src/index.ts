/**
 * @elkdonis/payments — provider-agnostic payments abstraction.
 *
 * Usage:
 *   const registry = new PaymentProviderRegistry()
 *     .register(createEtransferProvider({ defaultPayoutEmail: "..." }));
 *   const result = await registry.get("etransfer").initiate({...});
 */

export type {
  PaymentProvider,
  PaymentProviderId,
  InitiateInput,
  InitiateResult,
  ConfirmInput,
  ConfirmResult,
  RefundInput,
  RefundResult,
  PaymentDisplay,
} from "./types";

export { PaymentProviderRegistry } from "./registry";
export { createEtransferProvider, type EtransferProviderOptions } from "./providers/etransfer";
export { createStripeProvider, type StripeProviderOptions } from "./providers/stripe";
