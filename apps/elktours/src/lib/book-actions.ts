"use server";

import { quoteBooking } from "@/lib/tour-slots";
import { bookTourAction } from "@/lib/tour-actions";

/**
 * The phone Pay button (G3b): quote first (it refuses a closed, full or cancelled date, with Jay's wording), then
 * bookTourAction, which creates the order and redirects to Stripe's hosted checkout. A redirect never returns; any
 * refusal comes back as `{ ok: false, error }` for the page to show inline.
 */
export async function payForSlotAction(input: { tourSlug: string; slotId: string; partySize: number; name: string; email: string; note: string }): Promise<{ ok: false; error: string }> {
  const quote = await quoteBooking({ slotId: input.slotId, partySize: input.partySize });
  if (quote.ok === false) return { ok: false, error: quote.error };
  const r = await bookTourAction({ tourSlug: input.tourSlug, departureId: input.slotId, partySize: input.partySize, name: input.name, email: input.email, note: input.note });
  return { ok: false, error: r.ok ? "Something went wrong. Please try again." : r.error };
}
