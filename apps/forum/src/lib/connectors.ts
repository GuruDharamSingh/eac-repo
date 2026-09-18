import { networkHrefs, orgHrefs, serviceConnectors, type ForumConnectors } from "@elkdonis/forum-ui";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/viewer";
import { hrefs, SITE, ACTION_BASE, ARTDIRECT_URL, orgSiteUrl } from "@/lib/site";
import { WikiEditorIsland } from "@/components/WikiEditorIsland";

interface ConnectorOptions {
  /** Where the forum is mounted for these links: "" for the site, "/embed" or "/embed/o/[org]" for a frame. */
  base?: string;
  /** Present for an org-scoped embed: the same scope an org's own site mounts. */
  org?: { orgId: string; name: string };
}

/**
 * The network host's connectors: every org, writes on, forms post to
 * /api/forum, the wiki edited right here with the Tiptap island.
 *
 * The same function serves /embed with a different link base — the action
 * route is shared, and every `back` a form carries is under the base it was
 * rendered with, so a frame stays a frame across a post.
 */
export async function getConnectors(opts: ConnectorOptions = {}): Promise<ForumConnectors> {
  const jar = await cookies();
  const m = jar.get("forum_mode")?.value;
  const mode = m === "dark" || m === "auto" ? m : "light";
  const base = opts.base ?? "";
  const links = !base
    ? hrefs
    : opts.org
      ? orgHrefs({ base, signIn: "/login" })
      : networkHrefs({
          base,
          signIn: "/login",
          profile: (slug) => (slug ? `${ARTDIRECT_URL}/${slug}` : null),
          orgSite: orgSiteUrl,
        });
  return serviceConnectors({
    scope: opts.org ? { kind: "org", orgId: opts.org.orgId } : { kind: "network" },
    siteName: opts.org?.name ?? SITE.name,
    viewer: getViewer,
    hrefs: links,
    actionBase: ACTION_BASE,
    mode,
    wikiEditor: WikiEditorIsland,
  });
}
