import { hubCalendarRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * Events for a window, so the calendar dialog can page between months. The
 * handler is hubCalendarRoutes in @elkdonis/services; the member gate is this
 * app's who.
 */
export const dynamic = "force-dynamic";

export const { GET } = hubCalendarRoutes({ orgId: siteConfig.orgId, who: getApiMember });
