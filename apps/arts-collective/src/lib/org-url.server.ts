import "server-only";
import { getOrgHomeBySlug, listOrgHomes } from "@elkdonis/services";
import { getOrgHomeUrl } from "@/lib/org-url";

/** Home URL for one org by slug — one query. */
export async function resolveOrgHomeUrl(orgSlug: string): Promise<string> {
  const home = await getOrgHomeBySlug(orgSlug);
  return getOrgHomeUrl({ slug: orgSlug, primaryDomain: home?.primaryDomain ?? null });
}

/**
 * slug → home URL for every org, one query — for pages that render many org
 * links. Unknown slugs fall back to the network subdomain via `orgHomeUrl`.
 */
export async function orgHomeUrlMap(): Promise<Map<string, string>> {
  const homes = await listOrgHomes();
  return new Map(
    homes.map((h) => [h.orgSlug, getOrgHomeUrl({ slug: h.orgSlug, primaryDomain: h.primaryDomain })])
  );
}

export function orgHomeUrl(map: Map<string, string>, orgSlug: string): string {
  return map.get(orgSlug) ?? getOrgHomeUrl({ slug: orgSlug });
}
