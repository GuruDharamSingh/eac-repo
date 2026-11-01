import { db } from "@elkdonis/db";
import { splitCommission } from "../money";

// ============================================================================
// Settlement — who gets paid for one line, and on whose authority.
//
// This is the single answer to "where does this money go", and it exists
// because there are three rails that sell things (artwork, service threads,
// workshop threads) and until now each computed the payee its own way.
//
// Two regimes live here (2026-10-18, ORG_STORE_BRIEF R3):
//
//   artwork (a `storeId` is given)
//     * The maker is the payee; the store is a front.
//     * A flat commission comes off the price: the store's
//       `commission_rate`, which defaults to the marketplace's figure
//       (`marketplace_settings.default_commission_rate`, 5%). No agreement is
//       needed.
//     * Where the commission goes is the buyer's call at checkout (the
//       `support` split over payees); the line only records the amount. A
//       listing's own beneficiary (migration 209) overrides that: scope
//       `commission` sends the commission to it, `all_proceeds` sends the
//       whole price to it and the maker takes nothing.
//     * No maker at all means the store's org takes everything.
//     * The card processor's fee is not known here; `confirmOrderPaid`
//       deducts it from the maker's accrual on the Stripe rail.
//
//   services and workshops (no `storeId`)
//     * As before: the maker is the payee and an org takes a cut only under
//       an accepted agreement (`resolveOrgShare`).
//
// Either way an org's or a charity's share is earmarked inside the host
// account as ledger rows, never sent to an account of its own.
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
  /** The selling store. Present for artwork; selects the flat-commission regime. */
  storeId?: string | null;
  /** The listing's beneficiary, when it has one (artwork_variant, 209). */
  beneficiaryPayeeId?: string | null;
  beneficiaryScope?: "all_proceeds" | "commission" | null;
}

export interface LineSettlement {
  makerUserId: string | null;
  /** The org earmarked: the split counterparty, or the whole payee. */
  payeeOrgId: string | null;
  orgSharePercent: number;
  /** The agreement that authorised the cut. Null = nothing did (flat commission). */
  agreementId: string | null;
  makerShareMinor: number;
  orgShareMinor: number;
  /** A listing beneficiary's take, carved out of the price or the commission. */
  beneficiaryPayeeId: string | null;
  beneficiaryShareMinor: number;
  /**
   * Where a buyer sends an eTransfer. Null when the maker is card-only (a
   * connected Stripe account and no eTransfer address) — the eTransfer rail
   * must refuse such an order rather than invent an address.
   */
  payoutEmail: string | null;
  /** Who the buyer is told they are paying. */
  payeeName: string;
  /** The maker's account email, for notifications. Null for org-owned work. */
  makerEmail: string | null;
  /** The maker's connected account, whether or not onboarding has finished. */
  makerStripeAccountId: string | null;
  /** Whether the maker could take a Stripe destination charge today. */
  makerCanReceiveDestinationCharge: boolean;
}

type Row = Record<string, unknown>;

/** The flat commission for a store: its own rate, else the marketplace default. */
export async function resolveCommissionPercent(storeId: string): Promise<number> {
  const [row] = (await db`
    SELECT COALESCE(s.commission_rate, ms.default_commission_rate, 5)::numeric AS pct
    FROM store s
    LEFT JOIN marketplace_settings ms ON ms.org_id = s.org_id
    WHERE s.id = ${storeId}
    LIMIT 1
  `) as unknown as Row[];
  const pct = row ? Number(row.pct) : 5;
  return Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 5;
}

/**
 * Resolve one line's settlement.
 *
 * Throws when a maker has no way to be paid at all rather than quietly
 * falling back to the host account: silently redirecting an artist's money to
 * the collective is the worst possible failure mode here.
 */
export async function resolveSettlement(
  input: SettlementInput
): Promise<LineSettlement> {
  const { makerUserId, orgId, amountMinor } = input;
  const beneficiary = input.beneficiaryPayeeId ?? null;
  const scope = beneficiary ? (input.beneficiaryScope ?? "all_proceeds") : null;

  // No maker: the org owns it, takes all of it, and it is earmarked rather
  // than sent — so the buyer pays the host account. A listing beneficiary
  // with scope all_proceeds takes it instead.
  if (!makerUserId) {
    const [org] = (await db`
      SELECT name FROM organizations WHERE id = ${orgId} LIMIT 1
    `) as unknown as Array<{ name: string }>;
    const toBeneficiary = scope === "all_proceeds" ? amountMinor : 0;
    return {
      makerUserId: null,
      payeeOrgId: toBeneficiary ? null : orgId,
      orgSharePercent: toBeneficiary ? 0 : 100,
      agreementId: null,
      makerShareMinor: 0,
      orgShareMinor: amountMinor - toBeneficiary,
      beneficiaryPayeeId: beneficiary,
      beneficiaryShareMinor: toBeneficiary,
      payoutEmail: HOST_PAYOUT_EMAIL,
      payeeName: org?.name ?? "the collective",
      makerEmail: null,
      makerStripeAccountId: null,
      makerCanReceiveDestinationCharge: false,
    };
  }

  const [maker] = (await db`
    SELECT display_name, email, payout_email, stripe_account_id, stripe_onboarded_at
    FROM users WHERE id = ${makerUserId} LIMIT 1
  `) as unknown as Array<Record<string, unknown>>;
  if (!maker) throw new Error("The maker of this item no longer has an account.");

  const payoutEmail = (maker.payout_email as string | null) ?? null;
  const stripeAccountId = (maker.stripe_account_id as string | null) ?? null;
  const onboarded = Boolean(stripeAccountId) && Boolean(maker.stripe_onboarded_at);
  const makerName =
    (maker.display_name as string | null) ?? (maker.email as string) ?? "the seller";
  const makerBase = {
    makerUserId,
    makerEmail: (maker.email as string | null) ?? null,
    makerStripeAccountId: stripeAccountId,
    makerCanReceiveDestinationCharge: onboarded,
  };

  // A listing that gives everything away: the maker is credited on the line
  // but paid nothing, so their payout setup does not matter. The buyer pays
  // the host account, which holds the money for the beneficiary.
  if (scope === "all_proceeds") {
    return {
      ...makerBase,
      payeeOrgId: null,
      orgSharePercent: 0,
      agreementId: null,
      makerShareMinor: 0,
      orgShareMinor: 0,
      beneficiaryPayeeId: beneficiary,
      beneficiaryShareMinor: amountMinor,
      payoutEmail: HOST_PAYOUT_EMAIL,
      payeeName: "the collective",
      makerCanReceiveDestinationCharge: false,
    };
  }

  // A started-but-unfinished Stripe account is enough to SELL by card: the
  // charge lands on the platform and the maker's share is held for want of a
  // payout account, releasing itself when KYC completes (ledger, 098). It is
  // not enough to sell by eTransfer — the eTransfer rail checks payoutEmail.
  if (!payoutEmail && !stripeAccountId) {
    throw new Error(
      "This seller has not set up payouts yet (no eTransfer address and no card account), so we cannot take payment for their work."
    );
  }

  let orgSharePercent: number;
  let agreementId: string | null;
  if (input.storeId) {
    orgSharePercent = await resolveCommissionPercent(input.storeId);
    agreementId = null;
  } else {
    const { resolveOrgShare } = await import("@elkdonis/services/agreements");
    const share = await resolveOrgShare(makerUserId, orgId);
    orgSharePercent = share.orgSharePercent;
    agreementId = share.agreementId;
  }
  const split = splitCommission(amountMinor, orgSharePercent);
  const commissionToBeneficiary = scope === "commission" ? split.galleryShareMinor : 0;

  return {
    ...makerBase,
    // Only name an earmarked org when it is actually owed something.
    payeeOrgId: split.galleryShareMinor - commissionToBeneficiary > 0 ? orgId : null,
    orgSharePercent,
    agreementId,
    makerShareMinor: split.artistShareMinor,
    orgShareMinor: split.galleryShareMinor - commissionToBeneficiary,
    beneficiaryPayeeId: commissionToBeneficiary > 0 ? beneficiary : null,
    beneficiaryShareMinor: commissionToBeneficiary,
    payoutEmail,
    payeeName: makerName,
  };
}

/**
 * The card processor's fee the maker bears on the Stripe rail (R3: the
 * artist receives the price less the commission less the Stripe fee). An
 * estimate at Stripe's published Canadian card rate; the actual fee is on the
 * charge's balance transaction and can replace this later.
 */
export function estimateProcessorFeeMinor(amountMinor: number): number {
  if (amountMinor <= 0) return 0;
  return Math.round(amountMinor * 0.029 + 30);
}
