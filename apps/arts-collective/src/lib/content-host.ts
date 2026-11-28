import { defaultHost, type ContentHost } from "@elkdonis/content/host";
import { getCurrentUser } from "@/lib/session";

/**
 * arts-collective's ContentHost (content cornerstone, MOUNTING §1). The viewer is the session, never a parameter;
 * the site is the network org; URLs are defaultHost()'s.
 */
const base = defaultHost();

export const contentHost: ContentHost = {
  ...base,
  viewer: async () => {
    const u = await getCurrentUser();
    return u ? { userId: u.id } : null;
  },
};
