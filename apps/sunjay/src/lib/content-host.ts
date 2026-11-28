import { defaultHost, type ContentHost } from "@elkdonis/content/host";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

/**
 * Para Theater's ContentHost (content cornerstone, MOUNTING §1), 2026-11-27. Used by content-library checkout
 * (lib/content-checkout.ts). The viewer is the session, never a parameter; the site is this org, on the
 * domain the app is built for (paratheater.arts-collective.com, also an org_domains row); URLs are defaultHost()'s.
 */
const base = defaultHost();

export const contentHost: ContentHost = {
  ...base,
  viewer: async () => {
    const v = await getViewer().catch(() => null);
    return v ? { userId: v.userId } : null;
  },
  site: {
    ...base.site,
    orgId: siteConfig.orgId,
    name: siteConfig.orgName,
    domain: (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
  },
};
