import { serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/viewer";
import { hrefs, SITE, ACTION_BASE, FORUM_THEME, WIKI_CONSOLE } from "@/lib/site";

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
    // The forum shows the wiki; arts-collective owns editing it. Pointing
    // out rather than duplicating the editor here is what keeps one console.
    wikiConsole: WIKI_CONSOLE,
  });
}
