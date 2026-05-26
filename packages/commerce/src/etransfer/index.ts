/**
 * Interac eTransfer instructions composer.
 *
 * Generates the human-readable payment instructions an order's buyer sees on
 * the confirmation page and receives in their email. Also generates the
 * subject/body for an email to the artist letting them know to expect a
 * transfer with the order's reference number.
 */

import type { Currency } from "../types";
import { formatMoney } from "../money";

export interface EtransferInstructionsInput {
  orderNumber: string;
  totalMinor: number;
  currency: Currency;
  artistName: string;
  payoutEmail: string;
  paymentDueAt: string;
  /** Optional security question / answer the buyer should use */
  securityQuestion?: string;
  securityAnswer?: string;
}

export interface EtransferInstructions {
  /** What the buyer sees */
  buyerInstructions: string;
  /** Subject line for the buyer's confirmation email */
  buyerEmailSubject: string;
  /** Subject line for the artist's notification email */
  artistEmailSubject: string;
  /** The reference token the buyer should put in the eTransfer message field */
  paymentReference: string;
}

export function buildEtransferInstructions(
  input: EtransferInstructionsInput
): EtransferInstructions {
  const due = new Date(input.paymentDueAt).toLocaleString("en-CA", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const total = formatMoney(input.totalMinor, input.currency);
  const ref = input.orderNumber; // human-readable order number = the reference

  const buyerInstructions = [
    `To complete order ${input.orderNumber}, please send an Interac eTransfer of ${total}`,
    `to ${input.artistName} at ${input.payoutEmail}.`,
    "",
    `IMPORTANT: include the reference "${ref}" in the message field of your transfer`,
    `so we can match the payment to your order.`,
    "",
    input.securityQuestion && input.securityAnswer
      ? `Use this security Q&A:\n  Question: ${input.securityQuestion}\n  Answer:   ${input.securityAnswer}`
      : `Tip: turn on Autodeposit on the artist's account to skip the security question.`,
    "",
    `Payment is due by ${due}. If we don't receive the transfer by then, the`,
    `reservation on this artwork will be released and the order cancelled.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    buyerInstructions,
    buyerEmailSubject: `Action required: send eTransfer to complete order ${input.orderNumber}`,
    artistEmailSubject: `Sale pending — eTransfer of ${total} incoming for ${input.orderNumber}`,
    paymentReference: ref,
  };
}

/**
 * Generate a short, human-friendly order number.
 * Format: ART-YYYYMMDD-NNNN (where NNNN is a random 4-digit suffix).
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const yyyymmdd =
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");
  const suffix = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `ART-${yyyymmdd}-${suffix}`;
}
