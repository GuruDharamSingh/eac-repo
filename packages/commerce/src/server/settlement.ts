import { db } from "@elkdonis/db";
import { splitCommission } from "../money";

// ============================================================================
// Settlement — who gets paid for one line, and on whose authority.
//
// This is the single answer to "where does this money go", and it exists
// because there are three rails that sell things (artwork, service threads,
// workshop threads) and until now each computed the payee its own way:
//
//   artwork   the store's commission_rate, whoever the store belonged to
//   service   the SELLING APP'S CONFIG EMAIL — not the author's, so a
//             practitioner's booking fee went to the site's inbox
//   workshop  an environment variable, and no commerce_order at all
//
// Three answers to one question is how an invoice and a payout drift apart.
// The rules are the ones settled 2026-09-05:
//
//   * The maker is the payee. A front is a shop window, not a recipient.
//   * An org takes a cut only where the maker accepted an agreement with it.
//     No agreement means no claim — not a default rate.
//   * An org's cut is earmarked inside the host account, never sent to an
//     org-held Stripe account, so it needs no payout address of its own.
//   * No maker at all means the org owns the piece outright and takes 100%.
// ============================================================================

/** Where money goes when it is not going to a person — see §9 of the brief. */
export const HOST_PAYOUT_EMAIL =
  process.env.ART_AUCTION_GALLERY_PAYOUT_EMAIL ?? "info@elkdonis-arts.org";

export interface SettlementInput {
  /** Who made the thing. Null means the org owns it outright. */
  makerUserId: string | null;
  /** The org that may claim a cut — the front's owner, or the marketplace. */
  orgId: string;
  amountMinor: number;
}

export interface LineSettlement {
  makerUserId: string | null;
  /** The org earmarked: the split counterparty, or the whole payee. */
  payeeOrgId: string | null;
  orgSharePercent: number;
  /** The agreement that authorised the cut. Null = nothing did. */
  agreementId: string | null;
  makerShareMinor: number;
  orgShareMinor: number;
  /** Where a buyer actually sends an eTransfer. */
  payoutEmail: string;
  /** Who the buyer is told they are paying. */
  payeeName: string;
  /** Whether the maker could take a Stripe destination charge today. */
  makerCanReceiveDestinationCharge: boolean;
}

/**
 * Resolve one line's settlement.
 *
 * Throws when a maker has no payout email rather than quietly falling back to
 * the host account: silently redirecting an artist's money to the collective
 * is the worst possible failure mode here, and it is exactly what the service
 * rail was doing before this existed.
 */
export async function resolveSettlement(
  input: SettlementInput
): Promise<LineSettlement> {
  const { makerUserId, orgId, amountMinor } = input;

  // No maker: the org owns it, takes all of it, and it is earmarked rather
  // than sent — so the buyer pays the host account.
  if (!makerUserId) {
    const [org] = (await db`
      SELECT name FROM organizations WHERE id = ${orgId} LIMIT 1
    `) as unknown as Array<{ name: string }>;
    return {
      makerUserId: null,
      payeeOrgId: orgId,
      orgSharePercent: 100,
      agreementId: null,
      makerShareMinor: 0,
      orgShareMinor: amountMinor,
      payoutEmail: HOST_PAYOUT_EMAIL,
      payeeName: org?.name ?? "the collective",
      makerCanReceiveDestinationCharge: false,
    };
  }

  const [maker] = (await db`
    SELECT display_name, email, payout_email, stripe_account_id, stripe_onboarded_at
    FROM users WHERE id = ${makerUserId} LIMIT 1
  `) as unknown as Array<Record<string, unknown>>;
  if (!maker) throw new Error("The maker of this item no longer has an account.");

  const payoutEmail = (maker.payout_email as string | null) ?? null;
  if (!payoutEmail) {
    throw new Error(
      "This seller has not set up a payout email yet, so we cannot take payment for their work."
    );
  }

  const { resolveOrgShare } = await import("@elkdonis/services/agreements");
  const share = await resolveOrgShare(makerUserId, orgId);
  const split = splitCommission(amountMinor, share.orgSharePercent);

  return {
    makerUserId,
    // Only name an earmarked org when it is actually owed something.
    payeeOrgId: split.galleryShareMinor > 0 ? orgId : null,
    orgSharePercent: share.orgSharePercent,
    agreementId: share.agreementId,
    makerShareMinor: split.artistShareMinor,
    orgShareMinor: split.galleryShareMinor,
    payoutEmail,
    payeeName:
      (maker.display_name as string | null) ?? (maker.email as string) ?? "the seller",
    makerCanReceiveDestinationCharge:
      Boolean(maker.stripe_account_id) && Boolean(maker.stripe_onboarded_at),
  };
}
