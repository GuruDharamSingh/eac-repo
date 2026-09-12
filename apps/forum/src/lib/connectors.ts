import { serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/viewer";
import { hrefs, SITE, ACTION_BASE, FORUM_THEME } from "@/lib/site";

/** The network host's connectors: every org, writes on, forms post to /api/forum. */
export async function getConnectors(): Promise<ForumConnectors> {
  const jar = await cookies();
  const pref = jar.get("forum_theme")?.value;
  const theme = pref === "classic" || pref === "modern" ? pref : FORUM_THEME;
  return serviceConnectors({
    scope: { kind: "network" },
    siteName: SITE.name,
    viewer: getViewer,
    hrefs,
    actionBase: ACTION_BASE,
    theme,
  });
}
