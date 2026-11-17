import { rsvpRoutes } from "@elkdonis/services";
import { rsvpPaid } from "@elkdonis/checkout/rsvp";
import { getViewer } from "@/lib/auth";
import { getThreadMaterials } from "@/lib/data";
import {
  MEETING_EMAIL_TEMPLATE_KEY,
  getEmailTemplateSettingsForThread,
} from "@/lib/email-template-settings";
import { siteConfig } from "@/config/site";

const EMBLEM_URL = process.env.SUNJAY_EMAIL_EMBLEM_URL || undefined;

/**
 * Member RSVP. Guests use /api/rsvp instead.
 *
 * The one RSVP logic lives in @elkdonis/services (rsvp-handler.ts); this file
 * only says what is particular to this site: its org, its response shape, its
 * confirmation-mail templates and materials.
 */
export const { GET, POST, DELETE } = rsvpRoutes({
  orgId: siteConfig.orgId,
  orgName: siteConfig.orgName,
  label: "sunjay",
  shape: "attending",
  // A priced thread goes to checkout (payee: the thread's author); without a payout route it is refused in words.
  paid: rsvpPaid({ orgId: siteConfig.orgId }),
  followOnRsvp: true,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, email: v.email, role: v.role } : null;
  },
  emails: {
    fallbackNotifyEmail: siteConfig.fallbackNotifyEmail,
    emblemUrl: EMBLEM_URL,
    emblemAlt: undefined,
    confirmationExtras: async (threadId) => {
      const settings = await getEmailTemplateSettingsForThread(
        siteConfig.orgId,
        MEETING_EMAIL_TEMPLATE_KEY,
        threadId
      ).catch(() => null);
      const config = settings?.config ?? {};
      const materials = await getThreadMaterials(threadId);
      const selected = config.materialIds?.length
        ? materials.filter((m) => config.materialIds!.includes(m.id))
        : materials;
      return {
        bodyText: config.bodyText,
        links: [...selected.map((m) => ({ label: m.filename, url: m.url })), ...(config.links ?? [])],
        media: config.media,
      };
    },
  },
});
