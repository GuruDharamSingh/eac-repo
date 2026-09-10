import { serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { getViewer } from "@/lib/viewer";
import { hrefs, SITE, ACTION_BASE } from "@/lib/site";

/** The network host's connectors: every org, writes on, forms post to /api/forum. */
export function getConnectors(): Promise<ForumConnectors> {
  return serviceConnectors({
    scope: { kind: "network" },
    siteName: SITE.name,
    viewer: getViewer,
    hrefs,
    actionBase: ACTION_BASE,
  });
}
