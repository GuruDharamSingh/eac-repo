/**
 * A simple in-memory registry: store the providers your app supports, look one
 * up by id when initiating / confirming a payment.
 */

import type { PaymentProvider, PaymentProviderId } from "./types";

export class PaymentProviderRegistry {
  private providers = new Map<PaymentProviderId, PaymentProvider>();

  register(provider: PaymentProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  get(id: PaymentProviderId): PaymentProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`No payment provider registered for id "${id}".`);
    return p;
  }

  has(id: PaymentProviderId): boolean {
    return this.providers.has(id);
  }

  list(): PaymentProvider[] {
    return Array.from(this.providers.values());
  }
}
