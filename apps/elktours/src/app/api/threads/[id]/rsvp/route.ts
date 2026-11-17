import { rsvpRoutes } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { getThreadMaterials } from "@/lib/data";
import {
  MEETING_EMAIL_TEMPLATE_KEY,
  getEmailTemplateSettingsForThread,
} from "@/lib/email-template-settings";
import { siteConfig } from "@/config/site";

const EMBLEM_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://amritcanada.ca"}/email/khanda-gold.png`;

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
  label: "elktours",
  shape: "attending",
  followOnRsvp: false,
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, email: v.email, role: v.role } : null;
  },
  emails: {
    fallbackNotifyEmail: siteConfig.fallbackNotifyEmail,
    emblemUrl: EMBLEM_URL,
    emblemAlt: "Khanda",
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
