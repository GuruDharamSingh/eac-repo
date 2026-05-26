/**
 * Provider-neutral types for the payment abstraction.
 *
 * The `PaymentProvider` interface lets the rest of the app stay agnostic about
 * which payment rail (eTransfer, Stripe, manual cash, etc.) is in use. v1 ships
 * the eTransfer implementation; Stripe is a stub for later.
 */

import type { Currency, Order } from "@elkdonis/commerce/types";

export type PaymentProviderId = "etransfer" | "stripe" | "manual";

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
