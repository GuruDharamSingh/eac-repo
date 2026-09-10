/**
 * Provider-neutral types for the payment abstraction.
 *
 * The `PaymentProvider` interface lets the rest of the network stay agnostic
 * about which payment rail (eTransfer, Stripe, manual) is in use. eTransfer
 * needs no configuration and is always available; Stripe is available when
 * `STRIPE_SECRET_KEY` is set (see providers/stripe.ts).
 */

import type { Currency, Order } from "@elkdonis/commerce/types";

export type PaymentProviderId = "etransfer" | "stripe" | "manual";

export interface InitiateLine {
  name: string;
  description?: string | null;
  amountMinor: number;
  currency: string;
  quantity: number;
  imageUrl?: string | null;
}

export interface InitiateInput {
  orderId: string;
  orderNumber: string;
  totalMinor: number;
  currency: Currency;
  customerEmail: string;
  artistName: string;
  artistPayoutEmail?: string;
  /** ISO timestamp by which payment must be received */
  dueAt: string;

  // ─── Hosted-checkout providers (Stripe) ──────────────────────────────────
  /** Itemised lines; a provider that shows a receipt uses them. */
  lines?: InitiateLine[];
  successUrl?: string;
  cancelUrl?: string;
  /** A PERSON's connected account to route to; omit for a platform charge. */
  destinationAccountId?: string | null;
  /** The platform's (org-earmarked) cut of a destination charge. */
  applicationFeeMinor?: number;
}

export interface InitiateResult {
  /** Provider-specific payload to display to the buyer */
  display: PaymentDisplay;
  /** Reference string the provider will recognize when reconciling */
  providerReference: string;
  /** Anything provider-specific the order needs to remember */
  metadata?: Record<string, unknown>;
}

export type PaymentDisplay =
  | {
      kind: "etransfer_instructions";
      payoutEmail: string;
      reference: string;
      bodyText: string; // human-readable instructions block
      dueAt: string;
    }
  | {
      /** Send the buyer to a hosted payment page. */
      kind: "redirect";
      url: string;
      expiresAt?: string;
    }
  | {
      kind: "stripe_client_secret";
      clientSecret: string;
      publishableKey: string;
    }
  | {
      kind: "manual";
      message: string;
    };

export interface ConfirmInput {
  order: Pick<Order, "id" | "number" | "totalMinor" | "currency" | "paymentReference">;
  /** Who is confirming (admin user id, or webhook source identifier) */
  actorId: string;
  /** Provider-specific evidence */
  evidence?: Record<string, unknown>;
  /** Optional human note */
  notes?: string;
}

export interface ConfirmResult {
  ok: true;
  paymentReference?: string;
}

export interface RefundInput {
  order: Pick<Order, "id" | "currency" | "paymentReference">;
  amountMinor: number;
  notes?: string;
}

export interface RefundResult {
  ok: true;
  refundReference?: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly displayName: string;
  /** Human-friendly summary shown at checkout */
  readonly description: string;

  initiate(input: InitiateInput): Promise<InitiateResult>;
  confirm(input: ConfirmInput): Promise<ConfirmResult>;
  refund?(input: RefundInput): Promise<RefundResult>;

  /** Optional inbound webhook handler (e.g. Stripe events). eTransfer doesn't have one. */
  webhookHandler?(req: Request): Promise<Response>;
}
