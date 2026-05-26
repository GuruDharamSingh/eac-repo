/**
 * Stripe provider — STUB.
 *
 * Not implemented in v1 — Art-Auction launches with eTransfer only. This file
 * exists so the abstraction is concrete: when we add Stripe, we drop in the
 * implementation here without rewiring callers.
 */

import type { PaymentProvider } from "../types";

export interface StripeProviderOptions {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

export function createStripeProvider(_opts: StripeProviderOptions): PaymentProvider {
  return {
    id: "stripe",
    displayName: "Credit / debit card",
    description: "Pay securely with Stripe. (Coming soon — currently disabled.)",

    async initiate() {
      throw new Error("Stripe provider not implemented yet — use eTransfer.");
    },
    async confirm() {
      throw new Error("Stripe provider not implemented yet.");
    },
    async webhookHandler() {
      return new Response("Not implemented", { status: 501 });
    },
  };
}
