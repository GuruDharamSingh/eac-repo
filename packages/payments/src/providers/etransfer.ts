/**
 * Interac eTransfer provider.
 *
 * v1 payment rail. Buyer sends an eTransfer to the artist's payout_email
 * with the order number as the reference. Confirmation is manual (admin or
 * artist clicks "I received it" in the dashboard).
 */

import { buildEtransferInstructions } from "@elkdonis/commerce/etransfer";
import type {
  ConfirmInput,
  ConfirmResult,
  InitiateInput,
  InitiateResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "../types";

export interface EtransferProviderOptions {
  /** Optional fallback email if the artist hasn't set a payout_email yet */
  defaultPayoutEmail?: string;
  /** Optional security Q/A appended to the instructions */
  securityQuestion?: string;
  securityAnswer?: string;
}

export function createEtransferProvider(
  opts: EtransferProviderOptions = {}
): PaymentProvider {
  return {
    id: "etransfer",
    displayName: "Interac eTransfer",
    description:
      "Send an Interac eTransfer to the artist directly. We hold the artwork until payment is received (typically within 72 hours).",

    async initiate(input: InitiateInput): Promise<InitiateResult> {
      const payoutEmail = input.artistPayoutEmail ?? opts.defaultPayoutEmail;
      if (!payoutEmail) {
        throw new Error(
          "Cannot initiate eTransfer: no artist payout_email and no fallback configured."
        );
      }

      const instructions = buildEtransferInstructions({
        orderNumber: input.orderNumber,
        totalMinor: input.totalMinor,
        currency: input.currency,
        artistName: input.artistName,
        payoutEmail,
        paymentDueAt: input.dueAt,
        securityQuestion: opts.securityQuestion,
        securityAnswer: opts.securityAnswer,
      });

      return {
        display: {
          kind: "etransfer_instructions",
          payoutEmail,
          reference: instructions.paymentReference,
          bodyText: instructions.buyerInstructions,
          dueAt: input.dueAt,
        },
        providerReference: instructions.paymentReference,
        metadata: {
          payoutEmail,
          buyerEmailSubject: instructions.buyerEmailSubject,
          artistEmailSubject: instructions.artistEmailSubject,
        },
      };
    },

    async confirm(input: ConfirmInput): Promise<ConfirmResult> {
      // For eTransfer the actual money movement happens out-of-band; this
      // method just records that the artist (or admin) acknowledges receipt.
      // The order state machine is updated by the caller via
      // confirmEtransferReceived() in @elkdonis/commerce/server.
      return {
        ok: true,
        paymentReference: input.order.paymentReference ?? undefined,
      };
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      // Manual: the artist sends an eTransfer back to the customer. We just
      // record that we expect this to happen.
      return { ok: true };
    },
  };
}
