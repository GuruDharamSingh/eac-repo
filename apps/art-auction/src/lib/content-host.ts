import { db } from "@elkdonis/db";
import { listStoresForUser } from "@elkdonis/commerce/queries";
import { getStorageSlug, orgStorageRoot, userStorageRoot } from "@elkdonis/services";
import type { ContentHost } from "@elkdonis/content/host";
import { siteConfig } from "@/config/site";
import { getCurrentUserId } from "@/lib/marketplace-auth";

/** The market's domain for display: the configured public URL's host, else the live one. */
function marketDomain(): string {
  try {
    const host = new URL(siteConfig.url).host;
    if (host && !host.startsWith("localhost")) return host;
  } catch {
    // fall through
  }
  return "market.arts-collective.com";
}

/** The org ids behind the stores this person can act for, where they also hold a role in the org (CONTRACT 10.8). */
async function actableOrgs(userId: string): Promise<Array<{ id: string; name: string }>> {
  const stores = await listStoresForUser(userId);
  const ids = [...new Set(stores.filter((s) => s.ownerKind === "org" && s.ownerOrgId).map((s) => s.ownerOrgId as string))];
  if (!ids.length) return [];
  const rows = (await db`
    SELECT o.id, o.name
    FROM organizations o
    JOIN user_organizations uo ON uo.org_id = o.id AND uo.user_id = ${userId}
    WHERE o.id = ANY(${ids}::text[])
  `) as unknown as Array<{ id: string; name: string | null }>;
  return rows.map((r) => ({ id: r.id, name: r.name || r.id }));
}

/**
 * Collect Art as a ContentHost (packages/content CONTRACT 6). The viewer is the session, never a parameter.
 * The market serves artwork pages itself; threads belong to their owning site, so their links stand as the server
 * made them (urls.piece returns null for them).
 */
export const contentHost: ContentHost = {
  viewer: async () => {
    const userId = await getCurrentUserId();
    return userId ? { userId } : null;
  },
  site: {
    orgId: siteConfig.marketplaceOrgId,
    name: siteConfig.name,
    domain: marketDomain(),
    timeZone: "America/Toronto",
    storeOrgIds: [siteConfig.marketplaceOrgId],
  },
  urls: {
    piece: (ref) => (ref.store === "artwork" ? `/artworks/${ref.id}` : null),
    // The seller's edit page. getArtworkForEdit checks the person, so no store is named here.
    studio: (ref) => (ref && ref.store === "artwork" ? `/studio/artworks/${ref.id}/edit` : null),
    siteHome: () => null,
  },
  actions: ["artwork-hide", "artwork-show"],
  fileSources: async (viewer) => {
    const out: Array<{ key: string; label: string; root: string; showPrivate?: boolean }> = [];
    // Their own folder, Private/ included: it is theirs (matches canReadMedia).
    const slug = await getStorageSlug(viewer.userId);
    if (slug) out.push({ key: "mine", label: "My files", root: userStorageRoot(slug), showPrivate: true });
    // One root per org behind a store they act for and hold a role in. Org Private/ stays hidden.
    try {
      for (const org of await actableOrgs(viewer.userId)) {
        out.push({ key: `org:${org.id}`, label: org.name, root: orgStorageRoot(org.id), showPrivate: false });
      }
    } catch (err) {
      console.error("[content-host] org file sources:", err);
    }
    return out;
  },
};
