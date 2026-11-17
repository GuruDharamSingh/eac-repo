import { rsvpRoutes } from "@elkdonis/services";

/** Priced thread, no checkout on this site yet: say so, never dead-end. */
const PAID_REFUSAL = "This event takes payment, and this site can't take it online yet. Please get in touch with the organiser.";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * RSVP to one of this circle's threads, on the one RSVP logic in
 * @elkdonis/services (rsvp-handler.ts). Org scope and the published filter are
 * the handler's. An RSVP makes a person with no role a follower (a `viewer`
 * row, never a role change), which replaces the raw reading-group insert this
 * route used to carry.
 */
export const { POST, DELETE } = rsvpRoutes({
  orgId: siteConfig.orgId,
  orgName: siteConfig.orgName,
  label: "fourthway",
  shape: "ok-status",
  paid: async () => Response.json({ error: PAID_REFUSAL }, { status: 402 }),
  followOnRsvp: true,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, email: v.email, role: v.role } : null;
  },
});
