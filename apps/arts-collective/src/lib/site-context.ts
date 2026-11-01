import { headers } from "next/headers";
import { canEditOrgIdentity, getOrgIdentity, type OrgIdentity } from "@elkdonis/services";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import { canEditOrgSite, getOrgBySlug, type OrgSummary } from "@/lib/org";
import { isNetworkHost, networkHostWithPort, normalizeDomain } from "@/lib/domain";

/**
 * What every page of an org subdomain works out before it draws anything:
 * the org, its identity row, the viewer and whether they may edit, and the
 * addresses the chrome needs (the org's own domain when it arrived through
 * the network, the login page on the network host).
 *
 * Factored out of `OfferingPage` and `/profile`, which each carried a copy of
 * the host arithmetic, so the landing page's new branches (the designed page,
 * the default page) read the same answers.
 */
export interface SiteContext {
  org: OrgSummary;
  identity: OrgIdentity | null;
  user: SessionUser | null;
  /** Owner or guide of this org (`canEditOrgSite`), or may edit its identity. */
  canEdit: boolean;
  host: string;
  proto: string;
  rootHost: string;
  loginUrl: string;
  hubUrl: string;
  /** The org's own domain, when the visitor is on the network subdomain instead. */
  mainSiteUrl: string | null;
}

export async function loadSiteContext(slug: string): Promise<SiteContext | null> {
  const org = await getOrgBySlug(slug);
  if (!org) return null;

  const [identity, user, h] = await Promise.all([getOrgIdentity(slug), getCurrentUser(), headers()]);
  const host = h.get("host") ?? networkHostWithPort();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const requestDomain = normalizeDomain(host);
  const arrivedOnOwnDomain =
    h.get("x-org-domain") !== null ||
    (identity?.primaryDomain != null && requestDomain === identity.primaryDomain) ||
    (requestDomain !== null && !isNetworkHost(requestDomain));
  const mainSiteUrl = identity?.primaryDomain && !arrivedOnOwnDomain ? `https://${identity.primaryDomain}` : null;

  const canEdit = user
    ? (await canEditOrgSite(user.id, org.id)) || (await canEditOrgIdentity(user.id, org.id))
    : false;

  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  return {
    org,
    identity,
    user,
    canEdit,
    host,
    proto,
    rootHost,
    loginUrl: `${proto}://${rootHost}/login`,
    hubUrl: `${proto}://${rootHost}/hub/organization?org=${encodeURIComponent(slug)}`,
    mainSiteUrl,
  };
}
