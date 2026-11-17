/**
 * Paid member RSVP for the org sites, on the one checkout. An app's
 * `threads/[id]/rsvp/route.ts` passes `paid: rsvpPaid({ orgId })` to
 * `rsvpRoutes` (@elkdonis/services). The same path serves a promoted
 * waitlister's pay link: their hold email lands on the thread page, whose
 * button posts here; a held person is not counted as taking a seat, so the
 * RSVP reaches this callback and the order seats them when paid.
 *
 * The app mounts `/api/checkout/return` (checkoutReturn) as for any booking.
 */
import { bookingAvailability, publicOriginFrom, startThreadCheckout } from "./server/thread-checkout";
import { makeRsvpPaid, type RsvpPaidContext, type RsvpPaidDeps } from "./rsvp-paid-core";

export { RSVP_PAID_REFUSAL } from "./rsvp-paid-core";

export function rsvpPaid(opts: { orgId: string }): (ctx: RsvpPaidContext) => Promise<Response> {
  const deps: RsvpPaidDeps = {
    availability: (authorId) => bookingAvailability(authorId),
    start: async ({ threadId, customerEmail, customerId, amountMinor, threadPath, request }) => {
      const started = await startThreadCheckout({
        orgId: opts.orgId,
        threadId,
        kinds: ["workshop", "event"],
        itemNoun: "place",
        customerEmail,
        customerId,
        amountMinor,
        baseUrl: publicOriginFrom(request.headers, process.env.NEXT_PUBLIC_APP_URL),
        returnPath: threadPath,
        cancelPath: threadPath,
      });
      return { orderId: started.orderId, url: started.url };
    },
  };
  return makeRsvpPaid(deps);
}
