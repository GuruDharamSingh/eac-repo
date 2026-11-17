import { guestRsvpRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * Guest RSVP, no account. The place counts only after the emailed link is
 * clicked (GET /api/rsvp?verify=...). Rules and mail are in
 * @elkdonis/services (rsvp-handler.ts).
 */
export const { POST, GET } = guestRsvpRoutes({
  orgId: siteConfig.orgId,
  orgName: siteConfig.orgName,
  label: "elktours",
  emails: { fallbackNotifyEmail: siteConfig.fallbackNotifyEmail },
});
