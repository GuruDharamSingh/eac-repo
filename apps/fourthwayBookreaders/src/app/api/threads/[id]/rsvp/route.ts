import { rsvpRoutes } from "@elkdonis/services";
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
  followOnRsvp: true,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, email: v.email, role: v.role } : null;
  },
});
