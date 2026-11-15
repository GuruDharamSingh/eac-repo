import { checkoutBlock, recordBody, recordFacts, recordHeader, type Block } from "@elkdonis/blocks";
import { WhenForm } from "@/components/booking/when-form";
import { saveBookingTimes } from "@/lib/booking-actions";
import { payForRecord } from "@/lib/record-pay-action";

// ============================================================================
// The shared record blocks as this site offers them (2026-11-11): record-header,
// record-body, record-facts and checkout, from @elkdonis/blocks. No `he-` id:
// the same blocks, with the same ids, on any site that supplies a resolver
// (lib/record-parts.ts) and, for checkout, its own pay action.
//
// Registered through lib/puck/catalogue.ts, so both configs carry them.
// ============================================================================

/** After payment, a one-to-one asks "When would suit you?" (the resolver sends `after` only then). */
function WhenAfter({ after }: { recordRef: string; after: Readonly<Record<string, string>> }) {
  if (!after.slug || !after.orderId) return null;
  return <WhenForm action={saveBookingTimes.bind(null, after.slug, after.orderId)} />;
}

export const checkout = checkoutBlock({
  action: payForRecord,
  After: WhenAfter,
  inputClass: "he-input",
  buttonClass: "he-btn he-primary",
});

export const RECORD_SITE_BLOCKS = [recordHeader, recordFacts, recordBody, checkout] as unknown as Block<never>[];
