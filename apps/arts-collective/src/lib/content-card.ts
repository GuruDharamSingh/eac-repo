import { searchContent } from "@elkdonis/content/server";
import { contentCardHost } from "@/lib/content-card-host";
import type { ContentCardData, ContentCardRole, ContentCardSource } from "@/lib/content-card-types";

const EDITORS = new Set<string>(["owner", "guide"]);

/**
 * The server loader for the Content card (call it from organization/page.tsx, for every role).
 *
 *   const content = await loadContentCard({ userId: user.id, orgId: selected.orgId, orgSlug: selected.orgSlug,
 *     orgName: selected.orgName, role: selected.role, siteUrl: homeUrl });
 *
 * It reads the face only: the newest few published pieces of this org and the counts, through searchContent
 * (the same rights predicate the routes use, so a member sees what a member may). The surface asks the routes
 * for everything else. Never throws: a search failure draws an empty face rather than losing the page.
 */
export async function loadContentCard(input: {
  userId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: ContentCardRole;
  siteUrl: string;
}): Promise<ContentCardData> {
  const { userId, orgId, role } = input;
  const canEdit = EDITORS.has(role);

  const sources: ContentCardSource[] = [];
  if (role !== "viewer") sources.push({ key: `org:${orgId}`, label: `${input.orgName} team folder`, startPath: "Media" });
  sources.push({ key: "mine", label: "My files" });
  // Editors: the team folder first (the Files view opens there), then their own.
  const uploadTo = [
    ...(canEdit ? [{ key: `org:${orgId}`, label: "Team folder" }] : []),
    { key: "mine", label: "My files" },
  ];

  const base: ContentCardData = {
    orgId,
    orgSlug: input.orgSlug,
    orgName: input.orgName,
    role,
    canEdit,
    total: 0,
    byType: {},
    latest: [],
    sources,
    uploadTo,
    timeZone: contentCardHost.site.timeZone,
    siteUrl: input.siteUrl,
  };

  try {
    const r = await searchContent({ userId }, { scope: { kind: "org", orgId }, view: "published", limit: 8 }, contentCardHost);
    const byType: Record<string, number> = {};
    for (const [t, n] of Object.entries(r.facets.types)) if (n) byType[t] = n;
    return {
      ...base,
      byType,
      total: Object.values(byType).reduce((a, n) => a + n, 0),
      latest: r.items.map((it) => ({ key: it.key, title: it.title, type: it.type, cover: it.cover })),
    };
  } catch (err) {
    console.error("[content-card] load:", err);
    return base;
  }
}
