import "@elkdonis/lms-ui/lms.css";
import { db } from "@elkdonis/db";
import { getOwnedOrgId, getOrgRole, listOrgFeeds } from "@elkdonis/services";
import { SiteShell } from "@/components/site-shell";
import { LearnHost, type LearnOrg } from "@/components/learn/LearnHost";
import { getLmsViewer } from "@/lib/lms/connectors";
import { resolveOrgHomeUrl } from "@/lib/org-url.server";

/**
 * /learn — Sophia's learner pages on the network host, inside the network's
 * own chrome. The `.so-root` wrapper carries the LMS stylesheet's tokens;
 * LearnHost provides the surfaces a task step opens.
 *
 * Org tasks act on the org the learner owns (the step page resolves it the
 * same way, `orgFor(viewer, null)` in lms-ui pages.tsx), so the layout wires
 * compose for that one org (2026-11-06, action layer phase 2).
 */
export const dynamic = "force-dynamic";

async function learnerOrg(userId: string | null): Promise<LearnOrg | null> {
  if (!userId) return null;
  try {
    const orgId = await getOwnedOrgId(userId);
    if (!orgId) return null;
    const [[org], role, feeds] = await Promise.all([
      db<Array<{ slug: string; name: string }>>`SELECT slug, name FROM organizations WHERE id = ${orgId} LIMIT 1`,
      getOrgRole(userId, orgId),
      listOrgFeeds(orgId),
    ]);
    if (!org) return null;
    return {
      orgId,
      slug: org.slug,
      name: org.name,
      homeUrl: await resolveOrgHomeUrl(org.slug),
      feeds: feeds.map((f) => ({ slug: f.slug, name: f.name })),
      canEdit: role === "owner" || role === "guide",
    };
  } catch (err) {
    console.error("[learn] learnerOrg:", err);
    return null;
  }
}

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getLmsViewer();
  const org = await learnerOrg(viewer.userId);
  return (
    <SiteShell wide>
      <LearnHost displayName={viewer.name} signedIn={Boolean(viewer.userId)} org={org}>
        <div className="so-root so-root--hosted">{children}</div>
      </LearnHost>
    </SiteShell>
  );
}
